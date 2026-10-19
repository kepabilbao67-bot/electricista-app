import { NextRequest,NextResponse } from "next/server";
import { randomUUID,createHash } from "node:crypto";
import { z } from "zod";
import { getDbClient } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { normalizeEmail } from "@/lib/auth/store";
export const runtime="nodejs";export const dynamic="force-dynamic";
const schema=z.object({token:z.string().regex(/^[A-Za-z0-9_-]{43}$/),password:z.string().min(12).max(128)});
export async function POST(req:NextRequest){
 const body=schema.safeParse(await req.json().catch(()=>null));
 if(!body.success)return NextResponse.json({error:"Enlace o contraseña incorrectos (mínimo 12 caracteres)."},{status:400});
 const db=getDbClient(),now=new Date().toISOString(),hash=createHash("sha256").update(body.data.token).digest("hex");
 try{
  const invite=await db.execute({sql:"SELECT id,email,tenant_id FROM e360_password_invites WHERE token_hash=? AND used_at IS NULL AND expires_at>? LIMIT 1",args:[hash,now]});
  if(invite.rows.length!==1)return NextResponse.json({error:"Enlace caducado o utilizado."},{status:401});
  const row=invite.rows[0],email=normalizeEmail(String(row.email)),tenant=String(row.tenant_id);
  const existing=await db.execute({sql:"SELECT id FROM app_users WHERE email=? LIMIT 1",args:[email]});
  if(existing.rows.length) return NextResponse.json({error:"Este correo ya tiene cuenta. Utiliza el acceso habitual."},{status:409});
  const passwordHash=await hashPassword(body.data.password);
  const tx=await db.transaction("write");
  try {
    const consumed=await tx.execute({sql:"UPDATE e360_password_invites SET used_at=? WHERE id=? AND token_hash=? AND used_at IS NULL AND expires_at>?",args:[now,String(row.id),hash,now]});
    if(Number(consumed.rowsAffected)!==1)throw Error("INVITACION_UTILIZADA");
    await tx.execute({sql:"INSERT INTO app_users(id,tenant_id,email,password_hash,password_algo,role,is_active,failed_attempts,locked_until,created_at,last_login_at) VALUES(?,?,?,?,'scrypt','owner',1,0,NULL,?,NULL)",args:[randomUUID(),tenant,email,passwordHash,now]});
    await tx.commit();
  } catch(error) { await tx.rollback().catch(()=>{}); throw error; }
  return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"No se pudo completar el alta. Si ya existe, inicia sesión."},{status:503});}
}
