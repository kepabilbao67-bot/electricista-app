import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializeDatabase } from "../db";
import { migrateChats,executeChat,chatDetail,listChats,ChatError } from "../communications/chats";
import { assertChatAccess } from "../communications/chat-access";
import { loadVerticalConfig } from "../core/vertical-loader";
import { getActiveModules } from "../core/modules";
import { guardModule } from "../core/module-guard";
import { barymontConfig } from "../verticals/barymont/config";
import { middleware } from "../../../middleware";
import { NextRequest } from "next/server";

async function fixture(url='file:'+join(mkdtempSync(join(tmpdir(),'barymont-fixture-')),'barymont-chats-demo.db')) {
  const db=createClient({url}); await initializeDatabase(db); await migrateChats(db);
  await db.execute("INSERT INTO clients(id,name,email) VALUES('demo-contact','Contacto DEMO','contact@example.invalid')");
  await db.execute("INSERT INTO leads(id,name,status,created_at,updated_at) VALUES('demo-lead','Lead DEMO','nuevo','2026-08-31','2026-08-31')");
  await db.execute("INSERT INTO opportunities(id,client_id,lead_id,title) VALUES('demo-op','demo-contact','demo-lead','Oportunidad DEMO')");
  return db;
}
const incoming={action:'receive',eventId:'event-1',clientId:'demo-contact',content:'Hola DEMO'};
test('Chats: creación, CRM, lead, no leídos, deduplicación y orden',async()=>{
  const db=await fixture();try{
    assert.equal((await listChats(db)).length,0);
    const a=await executeChat(db,incoming,'Operador');const cid=String(a.conversationId);
    const duplicate=await executeChat(db,incoming,'Operador');assert.equal(duplicate.duplicate,true);
    await assert.rejects(executeChat(db,{...incoming,content:'Otro contenido'},'Operador'),(e:unknown)=>e instanceof ChatError&&e.status===409);
    await executeChat(db,{...incoming,eventId:'event-2',content:'Segundo'},'Operador');
    const d=await chatDetail(db,cid);assert.equal(d.conversation.client_id,'demo-contact');assert.equal(d.conversation.lead_id,'demo-lead');assert.equal(d.conversation.unread_count,2);
    assert.deepEqual(d.messages.map(m=>m.content),['Hola DEMO','Segundo']);assert.equal(d.contact?.name,'Contacto DEMO');assert.equal(d.lead?.name,'Lead DEMO');
    assert.equal((await db.execute("SELECT * FROM crm_activities WHERE related_type='chat'")).rows.length,2);
    assert.equal(d.audit.filter(a=>a.action==='received').length,2);
    await executeChat(db,{action:'read',conversationId:cid},'Operador');assert.equal((await chatDetail(db,cid)).conversation.unread_count,0);
  }finally{db.close();}
});
test('Chats: asignación, etiquetas y todos los estados persisten con auditoría',async()=>{
  const db=await fixture();try{const a=await executeChat(db,incoming,'Operador');const conversationId=String(a.conversationId);
    for(const status of ['open','pending','resolved','archived']) {
      await executeChat(db,{action:'update',conversationId,status,assignedTo:'Agente DEMO',tags:['seguimiento','seguimiento','prioridad']},'Operador');
      const d=await chatDetail(db,conversationId);assert.equal(d.conversation.status,status);assert.equal(d.conversation.assigned_to,'Agente DEMO');assert.deepEqual(JSON.parse(String(d.conversation.tags)),['seguimiento','prioridad']);
    }
    await assert.rejects(executeChat(db,{action:'reply',conversationId,eventId:'blocked',content:'Hola'},'Operador'),/Reabre/);
    await executeChat(db,{...incoming,eventId:'reopen'},'Operador');assert.equal((await chatDetail(db,conversationId)).conversation.status,'open');
    assert.equal((await chatDetail(db,conversationId)).audit.filter(a=>a.action==='updated').length,4);
  }finally{db.close();}
});
test('Chats: nota interna no enviada ni reintentable, respuesta idempotente y límite de error',async()=>{
  const db=await fixture();try{const a=await executeChat(db,incoming,'Operador');const conversationId=String(a.conversationId);
    const n=await executeChat(db,{action:'note',conversationId,eventId:'n1',content:'Privada'},'Operador');
    let d=await chatDetail(db,conversationId);const note=d.messages.find(m=>m.id===n.messageId)!;assert.equal(note.status,'internal');assert.equal(note.attempts,0);assert.equal(d.conversation.last_message_text,'Hola DEMO');
    await assert.rejects(executeChat(db,{action:'retry',conversationId,messageId:n.messageId},'Operador'),/no admite/);
    const command={action:'reply',conversationId,eventId:'r1',content:'Respuesta',simulateError:true};
    const r=await executeChat(db,command,'Operador');assert.equal(r.status,'failed');assert.equal((await executeChat(db,command,'Operador')).duplicate,true);
    for(let i=0;i<2;i++) await executeChat(db,{action:'retry',conversationId,messageId:r.messageId,simulateError:true},'Operador');
    await assert.rejects(executeChat(db,{action:'retry',conversationId,messageId:r.messageId},'Operador'),/no admite/);
    const r2=await executeChat(db,{...command,eventId:'r2'},'Operador');
    assert.equal((await executeChat(db,{action:'retry',conversationId,messageId:r2.messageId},'Operador')).status,'sent_demo');
    d=await chatDetail(db,conversationId);assert.equal(d.messages.filter(m=>m.is_internal_note).length,1);assert.equal(d.audit.filter(a=>a.action==='retry_demo').length,3);
  }finally{db.close();}
});
test('Chats: validación, relaciones inválidas y ausencia de efectos tras error',async()=>{
  const db=await fixture();try{
    for(const command of [{...incoming,content:''},{...incoming,extra:'no'},{...incoming,clientId:'missing'},{...incoming,leadId:'missing'},{action:'update',conversationId:'missing',status:'wrong'}]) await assert.rejects(executeChat(db,command,'Operador'));
    assert.equal((await listChats(db)).length,0);assert.equal((await db.execute('SELECT * FROM chat_messages')).rows.length,0);
    await db.execute("INSERT INTO leads(id,name,status,created_at,updated_at) VALUES('unrelated','Otro DEMO','nuevo','2026','2026')");
    await assert.rejects(executeChat(db,{...incoming,leadId:'unrelated'},'Operador'),/no relaciona/);
    await db.execute("CREATE TRIGGER fail_audit BEFORE INSERT ON chat_audit_logs BEGIN SELECT RAISE(ABORT,'test rollback'); END");
    await assert.rejects(executeChat(db,incoming,'Operador'));assert.equal((await listChats(db)).length,0);
  }finally{db.close();}
});
test('Chats: migración aditiva e idempotente conserva registros existentes',async()=>{
  const db=createClient({url:'file::memory:'});try{
    await initializeDatabase(db);
    await db.execute("INSERT INTO chat_conversations(id,contact_name,contact_identifier) VALUES('legacy','Legacy DEMO','test')");
    await db.execute("INSERT INTO chat_messages(id,conversation_id,sender_name,content) VALUES('legacy-message','legacy','Demo','Conservar')");
    await migrateChats(db);await migrateChats(db);await initializeDatabase(db);await migrateChats(db);
    const row=(await db.execute("SELECT * FROM chat_messages WHERE id='legacy-message'")).rows[0];assert.equal(row.content,'Conservar');assert.equal(row.attempts,0);
    const indexes=(await db.execute("PRAGMA index_list(chat_messages)")).rows;assert.ok(indexes.some(i=>i.name==='idx_chat_demo_event'&&i.unique===1));
  }finally{db.close();}
});
test('Chats: persistencia al cerrar y reabrir una base local',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'barymont-persistence-'));const url='file:'+join(dir,'barymont-chats-demo.db');
  const db=await fixture(url);const a=await executeChat(db,incoming,'Operador');db.close();
  const reopened=createClient({url});try{const d=await chatDetail(reopened,String(a.conversationId));assert.equal(d.messages.length,1);assert.equal(d.conversation.unread_count,1);}finally{reopened.close();}
});
test('Chats: índice y transacción bloquean duplicados desde dos conexiones',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'barymont-concurrency-'));const url='file:'+join(dir,'barymont-chats-demo.db');const db=await fixture(url);const second=createClient({url});
  try{await db.execute('PRAGMA busy_timeout=5000');await second.execute('PRAGMA busy_timeout=5000');
    const results=await Promise.allSettled([executeChat(db,incoming,'Operador'),executeChat(second,incoming,'Operador')]);
    assert.ok(results.some(r=>r.status==='fulfilled'));
    await executeChat(second,incoming,'Operador');
    assert.equal((await listChats(db)).length,1);assert.equal((await db.execute('SELECT * FROM chat_messages')).rows.length,1);assert.equal((await listChats(db))[0].unread_count,1);
  }finally{second.close();db.close();}
});
test('Chats: navegación exclusiva y permisos cerrados; auth original conservada',()=>{
  const names=['APP_VERTICAL','CHAT_DEMO_MODE','DEMO_MODE','TURSO_DATABASE_URL','VERCEL','AWS_LAMBDA_FUNCTION_NAME','APP_BASIC_AUTH_USER','APP_BASIC_AUTH_PASSWORD'];const saved=Object.fromEntries(names.map(n=>[n,process.env[n]]));
  const originalModules=[...barymontConfig.modules];
  try{
    for(const n of names)delete process.env[n];
    process.env.CHAT_DEMO_MODE='true';process.env.TURSO_DATABASE_URL='file:barymont-chats-demo.db';
    for(const vertical of ['electricista','general','tecnologia','barymont']){
      process.env.APP_VERTICAL=vertical;const config=loadVerticalConfig();assert.equal(getActiveModules(config.modules).some(m=>m.href==='/comunicaciones/chats'),vertical==='barymont');
      if(vertical==='barymont'){
        assert.doesNotThrow(()=>assertChatAccess(new URL('http://localhost:3000')));
        assert.doesNotThrow(()=>guardModule('chats'));
      }else{
        assert.throws(()=>assertChatAccess(new URL('http://localhost:3000')),/No encontrado/);
        assert.throws(()=>guardModule('chats'));
      }
    }
    // Desacoplamiento explícito: communications activo pero chats deshabilitado en Barymont
    process.env.APP_VERTICAL='barymont';
    barymontConfig.modules=originalModules.filter(m=>m!=='chats');
    assert.equal(barymontConfig.modules.includes('communications'),true);
    assert.equal(barymontConfig.modules.includes('chats'),false);
    assert.throws(()=>assertChatAccess(new URL('http://localhost:3000')),/No encontrado/);
    assert.throws(()=>guardModule('chats'));
    barymontConfig.modules=[...originalModules];

    assert.throws(()=>assertChatAccess(new URL('https://example.com')),/local/);
    assert.throws(()=>assertChatAccess(new URL('http://localhost:3000'),'https://example.com'),/Origen/);
    process.env.TURSO_DATABASE_URL='libsql://example.invalid';assert.throws(()=>assertChatAccess(new URL('http://localhost:3000')),/Configura/);
    process.env.TURSO_DATABASE_URL='file:barymont-chats-demo.db';process.env.DEMO_MODE='true';assert.throws(()=>assertChatAccess(new URL('http://localhost:3000')),/Configura/);delete process.env.DEMO_MODE;
    const url='http://localhost:3000/api/communications/chats';assert.equal(middleware(new NextRequest(url)).status,503);
    process.env.APP_BASIC_AUTH_USER='test-only';process.env.APP_BASIC_AUTH_PASSWORD='local-test-only';assert.equal(middleware(new NextRequest(url)).status,401);
    const headers={authorization:'Basic '+Buffer.from('test-only:local-test-only').toString('base64')};assert.equal(middleware(new NextRequest(url,{method:'POST',headers})).status,200);
    process.env.DEMO_MODE='true';assert.equal(middleware(new NextRequest(url,{method:'POST',headers})).status,403);
  }finally{
    barymontConfig.modules=[...originalModules];
    for(const n of names){if(saved[n]===undefined)delete process.env[n];else process.env[n]=saved[n];}
  }
});
