/**
 * ELECTRICISTA360 — REINICIO ONE-SHOT DE LA CONTRASEÑA DEL OWNER (TEMPORAL)
 *
 * ⚠️  FICHERO TEMPORAL. Se despliega SOLO en Preview, se usa UNA vez y se
 * elimina inmediatamente después (junto con su variable de entorno).
 *
 * POR QUÉ EXISTE
 * `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` son Secret de Vercel y no se pueden
 * extraer de la plataforma, así que la contraseña del OWNER solo se puede
 * reescribir desde DENTRO del runtime desplegado.
 *
 * GARANTÍAS
 *   · Solo funciona en Preview: si `VERCEL_ENV` no es "preview", responde 404.
 *   · Exige el token en el cuerpo o en la cabecera `x-bootstrap-token`.
 *   · Sin token configurado responde 404: el endpoint no existe.
 *   · La contraseña nueva llega en el CUERPO de la petición: no está en el
 *     repositorio, no se registra en logs y NUNCA se devuelve en la respuesta.
 *   · Escribe EXCLUSIVAMENTE en `app_users` (+ revoca sesiones en `app_sessions`
 *     del propio usuario). No toca ninguna tabla de negocio.
 */

import { NextRequest, NextResponse } from "next/server";

import { getDbClient } from "@/lib/db";
import { applyAuthSchema, authSchemaExists } from "@/lib/auth/schema";
import { hashPassword } from "@/lib/auth/password";
import { createUser, findUserByEmail, normalizeEmail, revokeAllUserSessions } from "@/lib/auth/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OWNER_EMAIL = "owner@electricista360.invalid";
const OWNER_TENANT = "electricista360-main";
const OWNER_ROLE = "owner";

function json(status: number, body: Record<string, unknown>): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function notFound(): NextResponse {
  return json(404, { error: "Not found" });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (process.env.VERCEL_ENV !== "preview") return notFound();

  const esperado = process.env.E360_BOOTSTRAP_TOKEN?.trim();
  if (!esperado) return notFound();

  let cuerpo: { token?: unknown; password?: unknown } = {};
  try {
    cuerpo = (await request.clone().json()) as { token?: unknown; password?: unknown };
  } catch {
    cuerpo = {};
  }

  const tokenRecibido =
    typeof cuerpo.token === "string" && cuerpo.token.length > 0
      ? cuerpo.token
      : (request.headers.get("x-bootstrap-token") ?? "");
  if (tokenRecibido !== esperado) return notFound();

  const password = typeof cuerpo.password === "string" ? cuerpo.password : "";
  if (password.length < 12) {
    return json(400, { error: "Contraseña demasiado corta (mínimo 12 caracteres)." });
  }

  const db = getDbClient();

  try {
    if (!(await authSchemaExists(db))) await applyAuthSchema(db);
  } catch {
    return json(503, { error: "No se pudo asegurar el esquema de auth." });
  }

  const email = normalizeEmail(OWNER_EMAIL);

  try {
    const existente = await findUserByEmail(email, db);
    let accion: "password_actualizada" | "owner_creado";
    let userId: string;

    if (existente) {
      const passwordHash = await hashPassword(password);
      await db.execute({
        sql: `UPDATE app_users
                 SET password_hash = ?, password_algo = 'scrypt', role = ?,
                     is_active = 1, failed_attempts = 0, locked_until = NULL
               WHERE id = ?`,
        args: [passwordHash, OWNER_ROLE, existente.id],
      });
      userId = existente.id;
      accion = "password_actualizada";
    } else {
      const creado = await createUser(
        { tenantId: OWNER_TENANT, email, password, role: OWNER_ROLE },
        db
      );
      userId = creado.id;
      accion = "owner_creado";
    }

    const sesionesRevocadas = await revokeAllUserSessions(userId, db);

    const comprobacion = await db.execute({
      sql: "SELECT email, role, tenant_id, is_active, failed_attempts, locked_until FROM app_users WHERE id = ? LIMIT 1",
      args: [userId],
    });
    const fila = comprobacion.rows[0] as unknown as Record<string, unknown> | undefined;
    const total = await db.execute("SELECT COUNT(*) AS n FROM app_users");

    return json(201, {
      ok: true,
      accion,
      owner: {
        email: fila ? String(fila.email) : null,
        role: fila ? String(fila.role) : null,
        tenantId: fila ? String(fila.tenant_id) : null,
        isActive: fila ? Number(fila.is_active) === 1 : null,
        failedAttempts: fila ? Number(fila.failed_attempts) : null,
        lockedUntil: fila && fila.locked_until ? String(fila.locked_until) : null,
      },
      sesionesRevocadas,
      appUsers: Number((total.rows[0] as unknown as Record<string, unknown>).n ?? 0),
    });
  } catch {
    return json(503, { error: "No se pudo escribir en la base de datos." });
  }
}