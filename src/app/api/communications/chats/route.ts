import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { assertChatAccess } from "@/lib/communications/chat-access";
import { ChatError, migrateChats, executeChat, listChats, chatDetail } from "@/lib/communications/chats";

export const dynamic="force-dynamic";
let ready: Promise<void> | undefined;
async function database(request: NextRequest) {
  assertChatAccess(request.nextUrl,request.headers.get("origin"));
  const db=getDbClient();
  ready ??= initializeDatabase(db).then(()=>migrateChats(db)).catch(error=>{ready=undefined;throw error;});
  await ready;
  return db;
}
function failure(error: unknown) {
  const status=error instanceof ChatError ? error.status : error instanceof ZodError || error instanceof SyntaxError ? 400 : 500;
  return NextResponse.json({error:error instanceof ChatError ? error.message : status===400 ? "Entrada no válida" : "No se pudo completar la operación"},{status,headers:{"Cache-Control":"no-store"}});
}
export async function GET(request: NextRequest) {
  try {
    const db=await database(request);
    const id=request.nextUrl.searchParams.get("id");
    const data=id ? await chatDetail(db,id) : {conversations:await listChats(db),contacts:(await db.execute("SELECT id,name FROM clients ORDER BY name")).rows};
    return NextResponse.json(data,{headers:{"Cache-Control":"no-store"}});
  } catch(error) {return failure(error);}
}
export async function POST(request: NextRequest) {
  try {
    const db=await database(request);
    const raw=await request.text();
    if(raw.length>16000) throw new ChatError("Solicitud demasiado grande",413);
    return NextResponse.json(await executeChat(db,JSON.parse(raw),process.env.APP_BASIC_AUTH_USER || "Agente local"),{headers:{"Cache-Control":"no-store"}});
  } catch(error) {return failure(error);}
}
