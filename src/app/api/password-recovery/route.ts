import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { createRecoveryToken, tokenHash, hashNewPassword, constantTimeEqual } from "@/lib/electricista-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const respond = (body: object, status = 200) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});
const generic = "Si la dirección está autorizada, recibirás instrucciones para recuperar el acceso.";
const now = () => Math.floor(Date.now() / 1000);

export async function POST(request: NextRequest) {
  let body: { action?: string; email?: string; token?: string; password?: string };
  try {
    if (Number(request.headers.get("content-length") || "0") > 4096) return respond({ error: "Solicitud demasiado grande" }, 413);
    body = await request.json();
  } catch { return respond({ error: "Solicitud no válida" }, 400); }

  const username = process.env.APP_BASIC_AUTH_USER;
  const recoveryEmail = process.env.AUTH_RECOVERY_EMAIL?.trim().toLowerCase();
  if (!username || !process.env.SESSION_SECRET) return respond({ error: "Acceso no configurado" }, 503);

  if (body.action === "request") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return respond({ error: "Introduce un correo válido" }, 400);
    }
    // Never let an arbitrary sender or request hostname determine the recovery link.
    const origin = process.env.APP_PUBLIC_URL;
    const from = process.env.RESEND_FROM_EMAIL;
    const apiKey = process.env.RESEND_API_KEY;
    if (!recoveryEmail || !origin || !from || !apiKey || !/^https:\/\/[^/]+\/?$/.test(origin)) {
      return respond({ error: "Recuperación por correo no configurada todavía" }, 503);
    }
    if (!constantTimeEqual(email, recoveryEmail)) return respond({ message: generic });

    try {
      await initializeDatabase();
      const db = getDbClient();
      const created = now();
      const token = createRecoveryToken();
      const hashed = tokenHash(token);
      const inserted = await db.execute({
        sql: `INSERT INTO electricista_password_resets (token_hash, username, created_at, expires_at)
              SELECT ?, ?, ?, ? WHERE NOT EXISTS
              (SELECT 1 FROM electricista_password_resets WHERE username = ? AND created_at > ?)`,
        args: [hashed, username, created, created + 900, username, created - 600],
      });
      if (inserted.rowsAffected === 0) return respond({ message: generic });
      const url = new URL("/restablecer", origin);
      // URL fragment is not sent in HTTP requests or Referer headers.
      url.hash = "token=" + encodeURIComponent(token);
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          from, to: [recoveryEmail], subject: "Recuperar acceso — Electricista 360",
          text: "Para cambiar tu contraseña, abre este enlace (válido 15 minutos y un solo uso):\n" + url.toString() +
            "\nSi no solicitaste el cambio, ignora este mensaje.",
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        await db.execute({ sql: "UPDATE electricista_password_resets SET consumed_at = ? WHERE token_hash = ?", args: [now(), hashed] });
        return respond({ error: "No se pudo enviar el correo de recuperación" }, 503);
      }
      return respond({ message: generic });
    } catch {
      return respond({ error: "Servicio de recuperación temporalmente no disponible" }, 503);
    }
  }

  if (body.action === "confirm") {
    const token = typeof body.token === "string" ? body.token : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[A-Za-z0-9_-]{40,100}$/.test(token) || password.length < 12 || password.length > 128) {
      return respond({ error: "Enlace inválido o contraseña de longitud insuficiente (mínimo 12 caracteres)" }, 400);
    }
    if (!recoveryEmail) return respond({ error: "Recuperación no configurada" }, 503);
    try {
      await initializeDatabase();
      const db = getDbClient();
      const hashed = tokenHash(token);
      const next = await hashNewPassword(password);
      const transaction = await db.transaction("write");
      try {
        const found = await transaction.execute({
          sql: "SELECT username FROM electricista_password_resets WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ?",
          args: [hashed, now()],
        });
        if (found.rows.length !== 1 || String(found.rows[0].username) !== username) {
          await transaction.rollback();
          return respond({ error: "El enlace ha caducado o ya se ha utilizado" }, 400);
        }
        const changed = await transaction.execute({
          sql: "UPDATE electricista_password_resets SET consumed_at = ? WHERE token_hash = ? AND consumed_at IS NULL",
          args: [now(), hashed],
        });
        if (changed.rowsAffected !== 1) {
          await transaction.rollback();
          return respond({ error: "Enlace ya utilizado" }, 400);
        }
        await transaction.execute({
          sql: `INSERT INTO electricista_auth_credentials (username, password_salt, password_hash, revision, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(username) DO UPDATE SET password_salt = excluded.password_salt,
                  password_hash = excluded.password_hash, revision = excluded.revision,
                  updated_at = excluded.updated_at`,
          args: [username, next.password_salt, next.password_hash, randomUUID(), now()],
        });
        await transaction.execute({
          sql: "UPDATE electricista_password_resets SET consumed_at = ? WHERE username = ? AND consumed_at IS NULL",
          args: [now(), username],
        });
        await transaction.commit();
        return respond({ message: "Contraseña actualizada. Inicia sesión con la nueva contraseña." });
      } catch (error) {
        try { await transaction.rollback(); } catch { /* may be closed */ }
        throw error;
      }
    } catch { return respond({ error: "No se pudo cambiar la contraseña" }, 503); }
  }
  return respond({ error: "Acción no permitida" }, 400);
}
