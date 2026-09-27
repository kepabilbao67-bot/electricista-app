/**
 * ELECTRICISTA360 — TENANT FASE 2A · Esquema aditivo
 *
 * ⚠️  ALCANCE ESTRICTO DE ESTA FASE
 *
 * Esta fase SOLO añade una columna `tenant_id` NULLABLE y un índice por tabla.
 * NO es aislamiento multi-tenant. La existencia de la columna NO cambia el
 * comportamiento de ninguna consulta: las 302 sentencias existentes siguen sin
 * filtrar por tenant. El aislamiento real llega cuando las consultas filtren; eso
 * NO se ha hecho y NO debe afirmarse.
 *
 * NO se hace aquí, deliberadamente:
 *   - backfill especulativo (ninguna fila se asigna);
 *   - reconstrucción de tablas fiscales;
 *   - cambio de ninguna restricción UNIQUE existente.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * SEMÁNTICA DE `tenant_id` (decidida y aprobada)
 *
 *   tenant_id IS NULL   → fila SIN PROPIETARIO DEMOSTRABLE. No se sabe de quién
 *                         es y NO se le asigna ninguno. Con filtrado estricto
 *                         (`tenant_id = ?`) estas filas quedan INVISIBLES para
 *                         todos los tenants: se falla cerrado, nunca abierto.
 *   tenant_id = '<id>'  → fila privada de ese tenant.
 *
 * CASO ESPECIAL `catalog_items` (tabla única, decisión aprobada):
 *   tenant_id IS NULL   → CATÁLOGO GLOBAL COMPARTIDO (las 57 filas sembradas).
 *                         Las consultas deben usar `tenant_id IS NULL OR tenant_id = ?`.
 *   tenant_id = '<id>'  → elemento privado de ese tenant.
 *   Es la ÚNICA tabla donde NULL tiene significado funcional (global) además de
 *   "sin propietario". Se documenta aquí porque es una excepción deliberada.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUÉ NULLABLE Y NO `NOT NULL`
 *
 * Añadir `NOT NULL` obligaría a inventar un propietario para las 3 filas de
 * `purchase_orders`/`purchase_order_items` y para las 57 de `catalog_items`.
 * Ambas asociaciones están marcadas como BLOQUEADAS y asignarlas sería una
 * suposición. Con NULL la migración se aplica sin suposiciones y sin pérdida.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IDEMPOTENCIA Y REVERSIBILIDAD
 *
 * SQLite no admite `ADD COLUMN IF NOT EXISTS`, así que se comprueba
 * `PRAGMA table_info` antes de actuar — el mismo patrón que `ensureColumns()` en
 * `src/lib/db.ts`. Repetir la migración no cambia nada.
 *
 * La reversión elimina el índice ANTES que la columna, porque SQLite no permite
 * `DROP COLUMN` sobre una columna indexada. La reversión no toca datos de
 * negocio: solo desaparece una columna que antes no existía.
 */

import type { Client } from "@libsql/client";

/** Identificador de versión del bloque de esquema. */
export const TENANT_SCHEMA_VERSION = "tenant-phase2a-v1";

/** Sufijo del índice por tabla. */
export const TENANT_INDEX_SUFFIX = "_tenant";

/**
 * Tablas que reciben `tenant_id`.
 *
 * Son las 23 tablas de negocio reales del proyecto. Se incluyen las tablas hijas
 * (`*_items`, `parte_*`) porque sus consultas también necesitarán filtrar; el
 * padre sigue siendo la fuente de verdad y el valor debe salir siempre de la
 * sesión, nunca del cuerpo de la petición.
 */
export const TENANT_TABLES: string[] = [
  // Raíz / clientes
  "clients",
  // Facturación
  "invoices",
  "invoice_items",
  // Presupuestos
  "budgets",
  "budget_items",
  // Comunicación y agenda
  "communications",
  "calls",
  "visits",
  // CRM
  "leads",
  "opportunities",
  "crm_activities",
  "crm_tasks",
  // Partes de trabajo
  "partes_trabajo",
  "parte_trabajo_lineas",
  "parte_materiales",
  // Configuración y compras
  "company_settings",
  "purchase_orders",
  "purchase_order_items",
  // Varios
  "feedback_submissions",
  "suppliers",
  "expenses",
  "expense_items",
  // Catálogo: tabla ÚNICA, NULL = catálogo global (ver cabecera)
  "catalog_items",
];

/** Tabla con semántica especial: NULL significa "global", no "sin propietario". */
export const TENANT_GLOBAL_CATALOG_TABLE = "catalog_items";

/** Nombre canónico del índice de tenant de una tabla. */
export function tenantIndex(table: string): string {
  return `idx_${table}_tenant`;
}

/** ¿Existe la tabla? */
export async function tableExists(db: Client, table: string): Promise<boolean> {
  try {
    const res = await db.execute({
      sql: "SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1",
      args: [table],
    });
    return res.rows.length > 0;
  } catch {
    return false;
  }
}

/** ¿Existe la columna `tenant_id` en la tabla? */
export async function tenantColumnExists(db: Client, table: string): Promise<boolean> {
  try {
    const info = await db.execute(`PRAGMA table_info("${table}")`);
    return info.rows.some((r) => String((r as unknown as Record<string, unknown>).name) === "tenant_id");
  } catch {
    return false;
  }
}

/** ¿Existe el índice de tenant? */
export async function tenantIndexExists(db: Client, table: string): Promise<boolean> {
  try {
    const res = await db.execute({
      sql: "SELECT name FROM sqlite_master WHERE type='index' AND name = ? LIMIT 1",
      args: [tenantIndex(table)],
    });
    return res.rows.length > 0;
  } catch {
    return false;
  }
}

export interface TenantSchemaState {
  table: string;
  exists: boolean;
  hasColumn: boolean;
  hasIndex: boolean;
}

/** Estado por tabla. Solo lee. */
export async function tenantSchemaState(db: Client): Promise<TenantSchemaState[]> {
  const out: TenantSchemaState[] = [];
  for (const table of TENANT_TABLES) {
    const exists = await tableExists(db, table);
    if (!exists) {
      out.push({ table, exists: false, hasColumn: false, hasIndex: false });
      continue;
    }
    out.push({
      table,
      exists: true,
      hasColumn: await tenantColumnExists(db, table),
      hasIndex: await tenantIndexExists(db, table),
    });
  }
  return out;
}

export interface ApplyResult {
  tablesProcessed: string[];
  tablesSkippedMissing: string[];
  columnsAdded: string[];
  indexesAdded: string[];
}

/**
 * Aplica la Fase 2A. Idempotente.
 *
 * - Añade `tenant_id TEXT` NULLABLE (sin DEFAULT, sin NOT NULL).
 * - Crea `idx_<tabla>_tenant`.
 * - Si la tabla no existe, la omite y lo reporta (no falla).
 * - NO hace backfill. NO asigna ninguna fila.
 */
export async function applyTenantSchema(db: Client): Promise<ApplyResult> {
  const result: ApplyResult = {
    tablesProcessed: [],
    tablesSkippedMissing: [],
    columnsAdded: [],
    indexesAdded: [],
  };

  for (const table of TENANT_TABLES) {
    if (!(await tableExists(db, table))) {
      result.tablesSkippedMissing.push(table);
      continue;
    }

    // ADD COLUMN nullable: sin NOT NULL y sin DEFAULT. No toca ninguna fila.
    if (!(await tenantColumnExists(db, table))) {
      await db.execute(`ALTER TABLE "${table}" ADD COLUMN tenant_id TEXT`);
      result.columnsAdded.push(table);
    }

    if (!(await tenantIndexExists(db, table))) {
      await db.execute(
        `CREATE INDEX IF NOT EXISTS "${tenantIndex(table)}" ON "${table}"(tenant_id)`
      );
      result.indexesAdded.push(table);
    }

    result.tablesProcessed.push(table);
  }

  return result;
}

export interface RollbackResult {
  columnsDropped: string[];
  indexesDropped: string[];
  tablesSkippedMissing: string[];
}

/**
 * Revierte la Fase 2A. Idempotente.
 *
 * Orden obligatorio: primero el ÍNDICE, después la COLUMNA. SQLite no permite
 * `DROP COLUMN` si la columna está indexada.
 * No elimina ninguna fila ni ninguna tabla de negocio.
 */
export async function rollbackTenantSchema(db: Client): Promise<RollbackResult> {
  const result: RollbackResult = {
    columnsDropped: [],
    indexesDropped: [],
    tablesSkippedMissing: [],
  };

  for (const table of TENANT_TABLES) {
    if (!(await tableExists(db, table))) {
      result.tablesSkippedMissing.push(table);
      continue;
    }

    if (await tenantIndexExists(db, table)) {
      await db.execute(`DROP INDEX IF EXISTS "${tenantIndex(table)}"`);
      result.indexesDropped.push(table);
    }

    if (await tenantColumnExists(db, table)) {
      await db.execute(`ALTER TABLE "${table}" DROP COLUMN tenant_id`);
      result.columnsDropped.push(table);
    }
  }

  return result;
}
