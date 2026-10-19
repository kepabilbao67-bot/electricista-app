import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/require-session";
import { findUserByEmail } from "@/lib/auth/store";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getDbClient } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({actual:z.string().min(1).max(1024),nueva:z.string().min(12).max(128)});
export async function POST(request:NextRequest){
 const auth=await requireSession(request);if(!auth.ok)return auth.response;
 const input=schema.safeParse(await request.json().catch(()=>null));
 if(!input.success)return NextResponse.json({error:"La nueva contraseña debe tener entre 12 y 128 caracteres."},{status:400});
 if(input.data.actual===input.data.nueva)return NextResponse.json({error:"Elige una contraseña distinta."},{status:400});
 try{
  const user=await findUserByEmail(auth.user.email);
  if(!user||user.id!==auth.user.id||!await verifyPassword(input.data.actual,user.passwordHash))return NextResponse.json({error:"La contraseña actual no es correcta."},{status:403});
  const nuevoHash=await hashPassword(input.data.nueva);
  const result=await getDbClient().execute({sql:"UPDATE app_users SET password_hash = ? WHERE id = ? AND tenant_id = ? AND password_hash = ? AND is_active = 1",args:[nuevoHash,auth.user.id,auth.tenantId,user.passwordHash]});
  if(Number(result.rowsAffected)!==1)return NextResponse.json({error:"La cuenta ha cambiado; vuelve a intentarlo."},{status:409});
  return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"No se pudo cambiar la contraseña."},{status:503});}
}
