import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { hashNewPassword, verifyPassword } from "@/lib/electricista-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  // The proxy validates the signed login session before this endpoint.
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) return reply({ error: "Origen no autorizado" }, 403);
  const user = process.env.APP_BASIC_AUTH_USER;
  if (!user || !process.env.SESSION_SECRET) return reply({ error: "Acceso no configurado" }, 503);
  if (Number(request.headers.get("content-length") || "0") > 4096)
    return reply({ error: "Solicitud demasiado grande" }, 413);
  let body: { currentPassword?: unknown; newPassword?: unknown };
  try { body = await request.json(); } catch { return reply({ error: "Solicitud no válida" }, 400); }
  const current = body.currentPassword;
  const next = body.newPassword;
  if (typeof current !== "string" || typeof next !== "string" || next.length < 12 || next.length > 128)
    return reply({ error: "La nueva contraseña debe tener entre 12 y 128 caracteres" }, 400);
  if (current === next) return reply({ error: "Usa una contraseña diferente" }, 400);
  try {
    await initializeDatabase();
    if (!(await verifyPassword(user, current))) return reply({ error: "Contraseña actual incorrecta" }, 401);
    const hashed = await hashNewPassword(next);
    await getDbClient().execute({
      sql: `INSERT INTO electricista_auth_credentials
        (username, password_salt, password_hash, revision, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(username) DO UPDATE SET password_salt=excluded.password_salt,
        password_hash=excluded.password_hash, revision=excluded.revision,
        updated_at=excluded.updated_at`,
      args: [user, hashed.password_salt, hashed.password_hash, randomUUID(), Math.floor(Date.now()/1000)],
    });
    return reply({ message: "Contraseña cambiada. Inicia sesión con la nueva contraseña." });
  } catch { return reply({ error: "No se pudo cambiar la contraseña" }, 503); }
}
