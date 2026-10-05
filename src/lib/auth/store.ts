/**
 * ELECTRICISTA360 — AUTH FASE 1 · Acceso a datos de autenticación
 *
 * REUTILIZA el cliente de base de datos ya existente (`getDbClient()` de
 * `src/lib/db.ts`) en lugar de crear una conexión propia. No se ha modificado
 * `db.ts`: las tablas de auth se crean con la migración explícita
 * (`scripts/migrate-auth-phase1.ts`), no de forma implícita.
 *
 * TODAS las consultas son parametrizadas. Ninguna interpola entrada del usuario.
 */

import { randomUUID } from "node:crypto";
import type { Client } from "@libsql/client";
import { getDbClient } from "../db";
import { getSessionIdleMs, getSessionTtlMs } from "./config";
import { hashPassword } from "./password";

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  role: string;
  isActive: boolean;
  failedAttempts: number;
  lockedUntil: string | null;
}

export interface AuthSession {
  id: string;
  userId: string;
  tenantId: string;
  expiresAt: string;
  lastSeenAt: string;
}

/** Motivo de rechazo, útil para pruebas y diagnóstico. No se expone al cliente. */
export type SessionRejectionReason =
  | "session_not_found"
  | "session_revoked"
  | "session_expired"
  | "session_idle_timeout"
  | "user_inactive";

export type SessionLookup =
  | { ok: true; user: AuthUser; session: AuthSession }
  | { ok: false; reason: SessionRejectionReason };

function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : String(value);
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mapUserRow(row: Record<string, unknown>): AuthUser {
  return {
    id: toText(row.id),
    tenantId: toText(row.tenant_id),
    email: toText(row.email),
    role: toText(row.role) || "owner",
    isActive: toNumber(row.is_active, 0) === 1,
    failedAttempts: toNumber(row.failed_attempts, 0),
    lockedUntil: row.locked_until ? toText(row.locked_until) : null,
  };
}

/** Normaliza el email para comparaciones estables. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Busca un usuario por email. Devuelve también el hash para poder verificar. */
export async function findUserByEmail(
  email: string,
  db: Client = getDbClient()
): Promise<(AuthUser & { passwordHash: string }) | null> {
  const res = await db.execute({
    sql: "SELECT * FROM app_users WHERE email = ? LIMIT 1",
    args: [normalizeEmail(email)],
  });
  if (res.rows.length === 0) return null;
  const row = res.rows[0] as unknown as Record<string, unknown>;
  return { ...mapUserRow(row), passwordHash: toText(row.password_hash) };
}

/** Primer usuario activo por rol. Uso acotado a flujos internos de sesión. */
export async function findFirstActiveUserByRole(
  role: string,
  db: Client = getDbClient()
): Promise<AuthUser | null> {
  const res = await db.execute({
    sql: `SELECT * FROM app_users
          WHERE role = ? AND is_active = 1
          ORDER BY created_at ASC
          LIMIT 1`,
    args: [role],
  });
  if (res.rows.length === 0) return null;
  return mapUserRow(res.rows[0] as unknown as Record<string, unknown>);
}

/**
 * Crea un usuario. Pensado para la migración/semilla y para las pruebas.
 *
 * ⚠️  NO se ha creado ningún usuario real. Esta función no se invoca en el
 * arranque de la aplicación: solo desde el script de migración (con banderas
 * explícitas) y desde la suite de pruebas sobre una base de datos aislada.
 */
export async function createUser(
  input: {
    tenantId: string;
    email: string;
    password: string;
    role?: string;
  },
  db: Client = getDbClient()
): Promise<AuthUser> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(input.password);

  await db.execute({
    sql: `INSERT INTO app_users (id, tenant_id, email, password_hash, password_algo, role, is_active, failed_attempts, locked_until, created_at, last_login_at)
          VALUES (?, ?, ?, ?, 'scrypt', ?, 1, 0, NULL, ?, NULL)`,
    args: [
      id,
      input.tenantId,
      normalizeEmail(input.email),
      passwordHash,
      input.role ?? "owner",
      now,
    ],
  });

  return {
    id,
    tenantId: input.tenantId,
    email: normalizeEmail(input.email),
    role: input.role ?? "owner",
    isActive: true,
    failedAttempts: 0,
    lockedUntil: null,
  };
}

/** ¿Está la cuenta bloqueada por intentos fallidos? */
export function isAccountLocked(user: AuthUser, now: Date = new Date()): boolean {
  if (!user.lockedUntil) return false;
  const until = Date.parse(user.lockedUntil);
  if (!Number.isFinite(until)) return false;
  return until > now.getTime();
}

/** Incrementa el contador de fallos y bloquea temporalmente al superar el umbral. */
export async function registerFailedLogin(
  userId: string,
  options?: { maxAttempts?: number; lockMinutes?: number },
  db: Client = getDbClient()
): Promise<void> {
  const maxAttempts = options?.maxAttempts ?? 10;
  const lockMinutes = options?.lockMinutes ?? 15;

  const res = await db.execute({
    sql: "SELECT failed_attempts FROM app_users WHERE id = ? LIMIT 1",
    args: [userId],
  });
  if (res.rows.length === 0) return;

  const current = toNumber((res.rows[0] as unknown as Record<string, unknown>).failed_attempts, 0);
  const next = current + 1;
  const lockedUntil =
    next >= maxAttempts ? new Date(Date.now() + lockMinutes * 60 * 1000).toISOString() : null;

  await db.execute({
    sql: "UPDATE app_users SET failed_attempts = ?, locked_until = ? WHERE id = ?",
    args: [next, lockedUntil, userId],
  });
}

/** Limpia el contador de fallos tras un login correcto. */
export async function registerSuccessfulLogin(
  userId: string,
  db: Client = getDbClient()
): Promise<void> {
  await db.execute({
    sql: "UPDATE app_users SET failed_attempts = 0, locked_until = NULL, last_login_at = ? WHERE id = ?",
    args: [new Date().toISOString(), userId],
  });
}

/** Crea una fila de sesión. Se almacena el HASH del token, nunca el token. */
export async function createSession(
  input: {
    userId: string;
    tenantId: string;
    tokenHash: string;
    userAgent?: string | null;
    ipHash?: string | null;
  },
  db: Client = getDbClient()
): Promise<{ id: string; expiresAt: string }> {
  const id = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + getSessionTtlMs()).toISOString();

  await db.execute({
    sql: `INSERT INTO app_sessions (id, user_id, tenant_id, token_hash, created_at, expires_at, last_seen_at, revoked_at, user_agent, ip_hash)
          VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    args: [
      id,
      input.userId,
      input.tenantId,
      input.tokenHash,
      now.toISOString(),
      expiresAt,
      now.toISOString(),
      input.userAgent ?? null,
      input.ipHash ?? null,
    ],
  });

  return { id, expiresAt };
}

/** Umbral de escritura perezosa de `last_seen_at` (evita golpear la BD en cada petición). */
const TOUCH_THROTTLE_MS = 60 * 1000;

/**
 * Comprobación AUTORITATIVA de sesión: es lo que hace efectiva la revocación.
 *
 * Fail-closed: cualquier anomalía (sesión inexistente, revocada, caducada, por
 * inactividad o usuario inactivo) devuelve `ok: false`. Un error de base de
 * datos se propaga hacia arriba para que el llamante responda 503 — NUNCA se
 * convierte en un acceso concedido.
 */
export async function findValidSessionByToken(
  tokenHash: string,
  db: Client = getDbClient()
): Promise<SessionLookup> {
  const res = await db.execute({
    sql: `SELECT s.id AS s_id, s.user_id AS s_user_id, s.tenant_id AS s_tenant_id,
                 s.expires_at AS s_expires_at, s.last_seen_at AS s_last_seen_at, s.revoked_at AS s_revoked_at,
                 u.id AS u_id, u.tenant_id AS u_tenant_id, u.email AS u_email, u.role AS u_role,
                 u.is_active AS u_is_active, u.failed_attempts AS u_failed_attempts, u.locked_until AS u_locked_until
          FROM app_sessions s
          JOIN app_users u ON u.id = s.user_id
          WHERE s.token_hash = ?
          LIMIT 1`,
    args: [tokenHash],
  });

  if (res.rows.length === 0) {
    return { ok: false, reason: "session_not_found" };
  }

  const row = res.rows[0] as unknown as Record<string, unknown>;
  const now = Date.now();

  if (row.s_revoked_at) {
    return { ok: false, reason: "session_revoked" };
  }

  const expiresAt = toText(row.s_expires_at);
  const expiresMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresMs) || expiresMs <= now) {
    return { ok: false, reason: "session_expired" };
  }

  const lastSeenMs = Date.parse(toText(row.s_last_seen_at));
  if (!Number.isFinite(lastSeenMs) || now - lastSeenMs > getSessionIdleMs()) {
    return { ok: false, reason: "session_idle_timeout" };
  }

  const user: AuthUser = {
    id: toText(row.u_id),
    tenantId: toText(row.u_tenant_id),
    email: toText(row.u_email),
    role: toText(row.u_role) || "owner",
    isActive: toNumber(row.u_is_active, 0) === 1,
    failedAttempts: toNumber(row.u_failed_attempts, 0),
    lockedUntil: row.u_locked_until ? toText(row.u_locked_until) : null,
  };

  if (!user.isActive) {
    return { ok: false, reason: "user_inactive" };
  }

  const session: AuthSession = {
    id: toText(row.s_id),
    userId: toText(row.s_user_id),
    tenantId: toText(row.s_tenant_id),
    expiresAt,
    lastSeenAt: toText(row.s_last_seen_at),
  };

  // Escritura perezosa: como máximo una vez por minuto.
  if (now - lastSeenMs > TOUCH_THROTTLE_MS) {
    try {
      await db.execute({
        sql: "UPDATE app_sessions SET last_seen_at = ? WHERE id = ?",
        args: [new Date(now).toISOString(), session.id],
      });
    } catch {
      /* La renovación es best-effort: no debe tumbar una petición válida. */
    }
  }

  // Coherencia tenant usuario/sesión: si no coincide, la sesión es inválida.
  if (session.tenantId !== user.tenantId) {
    return { ok: false, reason: "session_revoked" };
  }

  return { ok: true, user, session };
}

/** Revoca una sesión concreta por el hash de su token. Idempotente. */
export async function revokeSessionByTokenHash(
  tokenHash: string,
  db: Client = getDbClient()
): Promise<boolean> {
  const res = await db.execute({
    sql: "UPDATE app_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL",
    args: [new Date().toISOString(), tokenHash],
  });
  return toNumber(res.rowsAffected, 0) > 0;
}

/** Revoca TODAS las sesiones de un usuario (cierre en todos los dispositivos). */
export async function revokeAllUserSessions(
  userId: string,
  db: Client = getDbClient()
): Promise<number> {
  const res = await db.execute({
    sql: "UPDATE app_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
    args: [new Date().toISOString(), userId],
  });
  return toNumber(res.rowsAffected, 0);
}

/** Elimina sesiones ya caducadas. Mantenimiento. */
export async function purgeExpiredSessions(
  db: Client = getDbClient()
): Promise<number> {
  const res = await db.execute({
    sql: "DELETE FROM app_sessions WHERE expires_at <= ?",
    args: [new Date().toISOString()],
  });
  return toNumber(res.rowsAffected, 0);
}
