import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getDbClient } from "@/lib/db";
import { getSessionSecret, getSessionTtlMs } from "@/lib/auth/config";
import { createSignedSessionValue, generateSessionToken, hashSessionToken, serializeSessionCookie } from "@/lib/auth/session";
import { createSession } from "@/lib/auth/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const fail = () => NextResponse.json({error:"Enlace caducado o no válido."},{status:401,headers:{"Cache-Control":"no-store"}});
  if (!getSessionSecret()) return fail();
  let token: unknown;
  try { token = (await request.json()).token; } catch { return fail(); }
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) return fail();
  const hash = createHash("sha256").update(token).digest("hex");
  const db = getDbClient();
  try {
    const now = new Date().toISOString();
    const found = await db.execute({sql:"SELECT i.id,i.user_id,i.tenant_id FROM e360_client_invites i JOIN app_users u ON u.id=i.user_id AND u.tenant_id=i.tenant_id WHERE i.token_hash=? AND i.used_at IS NULL AND i.expires_at>? AND u.is_active=1 LIMIT 1",args:[hash,now]});
    if (found.rows.length !== 1) return fail();
    const invitation=found.rows[0];
    const result=await db.execute({sql:"UPDATE e360_client_invites SET used_at=? WHERE id=? AND used_at IS NULL AND expires_at>?",args:[now,String(invitation.id),now]});
    if (result.rowsAffected!==1) return fail();
    const sessionToken=generateSessionToken();
    const signed=createSignedSessionValue(sessionToken);
    if (!signed) return fail();
    await createSession({userId:String(invitation.user_id),tenantId:String(invitation.tenant_id),tokenHash:hashSessionToken(sessionToken),userAgent:request.headers.get("user-agent"),ipHash:null},db);
    const response=NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
    response.headers.set("Set-Cookie",serializeSessionCookie(signed,Math.floor(getSessionTtlMs()/1000),true));
    return response;
  } catch { return NextResponse.json({error:"No se pudo activar el acceso."},{status:503,headers:{"Cache-Control":"no-store"}}); }
}