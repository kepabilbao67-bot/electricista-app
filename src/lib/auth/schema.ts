/**
 * ELECTRICISTA360 — AUTH FASE 1 · Esquema de base de datos
 *
 * ⚠️  MIGRACIÓN PREPARADA PERO **NO APLICADA**.
 *
 * Este módulo SOLO declara el DDL. No se ejecuta automáticamente en el arranque
 * de la aplicación y NO se ha añadido a `src/lib/db.ts`, deliberadamente:
 * añadirlo allí haría que las tablas se creasen en la base de datos real en la
 * primera petición, es decir, aplicaría la migración de forma implícita.
 *
 * Para aplicarla hay que ejecutar EXPLÍCITAMENTE:
 *     npx tsx scripts/migrate-auth-phase1.ts --url "<URL>" --yes
 * y para revertirla:
 *     npx tsx scripts/migrate-auth-phase1.ts --url "<URL>" --yes --down
 *
 * Las tablas de autenticación son ADITIVAS: ningún DROP afecta a datos de
 * negocio. El rollback solo elimina `app_sessions` y `app_users`, que la
 * aplicación no usaba antes de esta fase.
 *
 * DISEÑO DE TENANT (Fase 1):
 * - `tenant_id` existe en ambas tablas desde el inicio.
 * - `email` es único GLOBALMENTE (no por tenant). Motivo: el formulario de login
 *   pide solo email + contraseña; si el email fuese único por tenant, un mismo
 *   email en dos tenants sería ambiguo y obligaría a elegir tenant en el login,
 *   lo que es un vector de confusión y de fuga de información (revelaría qué
 *   tenants existen). El tenant se DERIVA del registro del usuario, nunca lo
 *   elige el cliente.
 */

import type { Client } from "@libsql/client";

/** Identificador de versión de este bloque de esquema. */
export const AUTH_SCHEMA_VERSION = "auth-phase1-v1";

/** Sentencias de creación (idempotentes). */
export const AUTH_SCHEMA_UP: string[] = [
  `CREATE TABLE IF NOT EXISTS app_users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    password_algo TEXT NOT NULL DEFAULT 'scrypt',
    role TEXT NOT NULL DEFAULT 'owner',
    is_active INTEGER NOT NULL DEFAULT 1,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    created_at TEXT NOT NULL,
    last_login_at TEXT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email)`,
  `CREATE INDEX IF NOT EXISTS idx_app_users_tenant ON app_users(tenant_id)`,

  `CREATE TABLE IF NOT EXISTS app_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    revoked_at TEXT,
    user_agent TEXT,
    ip_hash TEXT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_app_sessions_token_hash ON app_sessions(token_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_app_sessions_user ON app_sessions(user_id, expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_app_sessions_tenant ON app_sessions(tenant_id)`,
];

/** Sentencias de reversión. Solo afectan a tablas creadas por esta fase. */
export const AUTH_SCHEMA_DOWN: string[] = [
  `DROP INDEX IF EXISTS idx_app_sessions_tenant`,
  `DROP INDEX IF EXISTS idx_app_sessions_user`,
  `DROP INDEX IF EXISTS idx_app_sessions_token_hash`,
  `DROP TABLE IF EXISTS app_sessions`,
  `DROP INDEX IF EXISTS idx_app_users_tenant`,
  `DROP INDEX IF EXISTS idx_app_users_email`,
  `DROP TABLE IF EXISTS app_users`,
];

/** Aplica el esquema. Idempotente: repetirlo no cambia nada. */
export async function applyAuthSchema(db: Client): Promise<void> {
  for (const statement of AUTH_SCHEMA_UP) {
    await db.execute(statement);
  }
}

/** Revierte el esquema. Destruye solo las tablas de autenticación. */
export async function rollbackAuthSchema(db: Client): Promise<void> {
  for (const statement of AUTH_SCHEMA_DOWN) {
    await db.execute(statement);
  }
}

/**
 * Indica si el esquema de autenticación está aplicado.
 *
 * Se usa para FAIL-CLOSED: si las tablas no existen, toda ruta privada debe
 * denegar en lugar de asumir que no hay sesiones.
 */
export async function authSchemaExists(db: Client): Promise<boolean> {
  try {
    const res = await db.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('app_users','app_sessions')`
    );
    return res.rows.length === 2;
  } catch {
    return false;
  }
}
