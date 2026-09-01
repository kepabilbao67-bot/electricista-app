import { randomUUID } from "node:crypto";
import type { Client, Transaction, InValue } from "@libsql/client";
import { z } from "zod";

const text = z.string().trim().min(1).max(4000);
const id = z.string().trim().min(1).max(160);
export const chatCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("receive"), eventId: id, clientId: id, leadId: id.optional(), content: text }).strict(),
  z.object({ action: z.literal("reply"), conversationId: id, eventId: id, content: text, simulateError: z.boolean().default(false) }).strict(),
  z.object({ action: z.literal("note"), conversationId: id, eventId: id, content: text }).strict(),
  z.object({ action: z.literal("retry"), conversationId: id, messageId: id, simulateError: z.boolean().default(false) }).strict(),
  z.object({ action: z.literal("read"), conversationId: id }).strict(),
  z.object({ action: z.literal("update"), conversationId: id, status: z.enum(["open", "pending", "resolved", "archived"]).optional(), assignedTo: z.string().trim().max(100).optional(), tags: z.array(z.string().trim().min(1).max(40)).max(12).optional() }).strict(),
]);
export class ChatError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/** Additive, repeatable migration; never edits existing records or hides failures. */
export async function migrateChats(db: Client) {
  const info = await db.execute("PRAGMA table_info(chat_messages)");
  if (!info.rows.length) throw new ChatError("Falta el esquema de comunicaciones", 503);
  if (!info.rows.some(r => r.name === "attempts")) {
    await db.execute("ALTER TABLE chat_messages ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0");
  }
  await db.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_demo_event ON chat_messages(channel, external_message_id) WHERE channel = 'DEMO' AND external_message_id IS NOT NULL");
  await db.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_demo_contact ON chat_conversations(channel, external_id) WHERE channel = 'DEMO' AND external_id IS NOT NULL");
}

type Executor = Pick<Transaction, "execute">;
async function query(db: Executor, sql: string, args: InValue[] = []) { return (await db.execute({sql, args})).rows; }
async function audit(db: Executor, conversationId: string, action: string, actor: string, details: unknown) {
  await query(db, "INSERT INTO chat_audit_logs(id,conversation_id,action,actor,details,created_at) VALUES(?,?,?,?,?,?)", [randomUUID(),conversationId,action,actor,JSON.stringify(details),new Date().toISOString()]);
}
async function conversation(db: Executor, conversationId: string) {
  const [row] = await query(db, "SELECT * FROM chat_conversations WHERE id=? AND channel='DEMO'", [conversationId]);
  if (!row) throw new ChatError("Conversación no encontrada",404);
  return row;
}

/** All writes, including deduplication and unread counters, share a write transaction. */
// SQLite writes are serialized in this process; unique indexes also guard other processes.
let writeQueue: Promise<unknown> = Promise.resolve();
export async function executeChat(db: Client, input: unknown, actor: string) {
  const result = writeQueue.then(() => executeChatTransaction(db, input, actor));
  writeQueue = result.catch(() => undefined);
  return result;
}
async function executeChatTransaction(db: Client, input: unknown, actor: string) {
  const c = chatCommand.parse(input);
  const tx = await db.transaction("write");
  try {
    const now = new Date().toISOString();
    let conversationId: string;
    let result: Record<string, unknown> = {};
    if (c.action === "receive") {
      const [contact] = await query(tx,"SELECT id,name,email,phone FROM clients WHERE id=?",[c.clientId]);
      if (!contact) throw new ChatError("Selecciona un contacto existente",404);
      let leadId = c.leadId;
      if (leadId) {
        const [lead] = await query(tx,"SELECT id FROM leads WHERE id=?",[leadId]);
        if (!lead) throw new ChatError("Lead no encontrado",404);
        const linked = await query(tx,"SELECT id FROM opportunities WHERE client_id=? AND lead_id=?",[c.clientId,leadId]);
        if (!linked.length) throw new ChatError("El CRM no relaciona ese lead con el contacto",409);
      } else {
        const linked = await query(tx,"SELECT DISTINCT lead_id FROM opportunities WHERE client_id=? AND lead_id IS NOT NULL",[c.clientId]);
        if (linked.length === 1) leadId = String(linked[0].lead_id);
      }
      const externalId = c.clientId + ":" + (leadId || "");
      const eventKey = "in:" + c.eventId;
      const [duplicate] = await query(tx,"SELECT m.*,c.external_id AS contact_key FROM chat_messages m JOIN chat_conversations c ON c.id=m.conversation_id WHERE m.channel='DEMO' AND m.external_message_id=?",[eventKey]);
      if (duplicate) {
        if (duplicate.content !== c.content || duplicate.contact_key !== externalId) throw new ChatError("Evento reutilizado con datos distintos",409);
        await tx.commit();
        return {conversationId: duplicate.conversation_id, duplicate:true};
      }
      const [existing] = await query(tx,"SELECT id FROM chat_conversations WHERE channel='DEMO' AND external_id=?",[externalId]);
      conversationId = existing ? String(existing.id) : randomUUID();
      if (!existing) {
        await query(tx,"INSERT INTO chat_conversations(id,client_id,lead_id,channel,external_id,contact_name,contact_identifier,assigned_to,created_at,updated_at) VALUES(?,?,?,'DEMO',?,?,?,NULL,?,?)",[conversationId,c.clientId,leadId || null,externalId,String(contact.name),String(contact.email || contact.phone || contact.id),now,now]);
        await audit(tx,conversationId,"created",actor,{clientId:c.clientId,leadId});
      }
      await query(tx,"INSERT INTO chat_messages(id,conversation_id,sender_type,sender_name,content,channel,external_message_id,status,created_at) VALUES(?,?,'client',?,?,'DEMO',?,'delivered',?)",[randomUUID(),conversationId,String(contact.name),c.content,eventKey,now]);
      await query(tx,"UPDATE chat_conversations SET unread_count=COALESCE(unread_count,0)+1,last_message_text=?,last_message_at=?,updated_at=?,status='open' WHERE id=?",[c.content,now,now,conversationId]);
      await query(tx,"INSERT INTO crm_activities(id,client_id,type,title,description,related_type,related_id) VALUES(?,?,'chat_demo','Mensaje recibido · DEMO',?,'chat',?)",[randomUUID(),c.clientId,c.content,conversationId]);
      await audit(tx,conversationId,"received",actor,{eventId:c.eventId});
    } else {
      conversationId = c.conversationId;
      const conv = await conversation(tx,conversationId);
      if (c.action === "read") {
        await query(tx,"UPDATE chat_conversations SET unread_count=0 WHERE id=?",[conversationId]);
        if (Number(conv.unread_count)>0) await audit(tx,conversationId,"read",actor,{});
      } else if (c.action === "update") {
        const tags = c.tags ? JSON.stringify([...new Set(c.tags)]) : String(conv.tags || "[]");
        await query(tx,"UPDATE chat_conversations SET status=?,assigned_to=?,tags=?,updated_at=? WHERE id=?",[c.status || conv.status,c.assignedTo === undefined ? conv.assigned_to : c.assignedTo || null,tags,now,conversationId]);
        await audit(tx,conversationId,"updated",actor,{before:{status:conv.status,assignedTo:conv.assigned_to,tags:conv.tags},after:c});
      } else if (c.action === "retry") {
        const [msg] = await query(tx,"SELECT * FROM chat_messages WHERE id=? AND conversation_id=? AND channel='DEMO'",[c.messageId,conversationId]);
        if (!msg) throw new ChatError("Mensaje no encontrado",404);
        if (msg.is_internal_note || msg.sender_type !== "agent" || msg.status !== "failed" || Number(msg.attempts)>=3) throw new ChatError("Este mensaje no admite más reintentos",409);
        const status = c.simulateError ? "failed" : "sent_demo";
        await query(tx,"UPDATE chat_messages SET status=?,attempts=attempts+1 WHERE id=?",[status,c.messageId]);
        await audit(tx,conversationId,"retry_demo",actor,{messageId:c.messageId,status,attempt:Number(msg.attempts)+1});
        result = {messageId:c.messageId,status};
      } else {
        const internal = c.action === "note";
        const eventKey = (internal ? "note:" : "out:")+c.eventId;
        const [duplicate] = await query(tx,"SELECT * FROM chat_messages WHERE channel='DEMO' AND external_message_id=?",[eventKey]);
        if (duplicate) {
          if (duplicate.conversation_id !== conversationId || duplicate.content !== c.content) throw new ChatError("Evento reutilizado con datos distintos",409);
          await tx.commit(); return {conversationId,duplicate:true,messageId:duplicate.id,status:duplicate.status};
        }
        if (!internal && conv.status === "archived") throw new ChatError("Reabre la conversación antes de responder",409);
        const status = internal ? "internal" : c.simulateError ? "failed" : "sent_demo";
        const messageId=randomUUID();
        await query(tx,"INSERT INTO chat_messages(id,conversation_id,sender_type,sender_name,content,channel,external_message_id,status,is_internal_note,attempts,created_at) VALUES(?,?,'agent',?,?,'DEMO',?,?,?,?,?)",[messageId,conversationId,actor,c.content,eventKey,status,internal?1:0,internal?0:1,now]);
        if (!internal) await query(tx,"UPDATE chat_conversations SET last_message_text=?,last_message_at=?,updated_at=? WHERE id=?",[c.content,now,now,conversationId]);
        await audit(tx,conversationId,internal?"internal_note":"reply_demo",actor,{messageId,status});
        result={messageId,status};
      }
    }
    await tx.commit();
    return {conversationId,duplicate:false,...result};
  } catch(error) { await tx.rollback(); throw error; } finally { tx.close(); }
}

export async function listChats(db: Client) {
  return query(db,"SELECT * FROM chat_conversations WHERE channel='DEMO' ORDER BY last_message_at DESC,id");
}
export async function chatDetail(db: Client, conversationId: string) {
  const conv=await conversation(db,conversationId);
  const [contact]=await query(db,"SELECT id,name,email,phone FROM clients WHERE id=?",[conv.client_id]);
  const [lead]=conv.lead_id ? await query(db,"SELECT id,name,status FROM leads WHERE id=?",[conv.lead_id]) : [];
  return {conversation:conv,contact,lead,messages:await query(db,"SELECT * FROM chat_messages WHERE conversation_id=? ORDER BY created_at,rowid",[conversationId]),audit:await query(db,"SELECT * FROM chat_audit_logs WHERE conversation_id=? ORDER BY created_at,rowid",[conversationId])};
}
