/**
 * MIGRACION OPERATIVA: BUD_CLIENT_ID_NULLABLE_001
 *
 * Hace budgets.client_id nullable en bases de datos existentes donde fue
 * creada con NOT NULL por versiones anteriores de la aplicacion.
 *
 * EJECUCION MANUAL. UNICA VEZ. NO se ejecuta en arranque, build ni deploy.
 *
 * USO:
 *   npx tsx scripts/migrate-budgets-client-nullable.ts --url "file:electricista.db" --yes
 *   npx tsx scripts/migrate-budgets-client-nullable.ts --url "libsql://..." --token "..." --yes --backup-verified
 *
 * FLAGS:
 *   --url       (obligatorio) URL de la base de datos
 *   --token     Token de autenticacion para Turso remoto
 *   --yes       Confirma ejecucion (obligatorio en modo no interactivo)
 *   --backup-verified  Confirma que el operador ya realizo y verifico un backup (obligatorio para Turso)
 *
 * PREREQUISITOS:
 *   1. Detener la aplicacion (sin escrituras concurrentes).
 *   2. Realizar backup verificado.
 *   3. Ejecutar este script con --yes.
 *   4. Verificar resultado.
 *   5. Reiniciar la aplicacion.
 */

import { createClient, type Client } from "@libsql/client";
import { parseArgs } from "node:util";
import { copyFileSync, existsSync, statSync } from "node:fs";
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";

const MIGRATION_ID = "BUD_CLIENT_ID_NULLABLE_001";

const BUDGETS_COLUMNS = [
  "id",
  "number",
  "client_id",
  "date",
  "valid_until",
  "status",
  "subtotal",
  "tax_rate",
  "tax_amount",
  "total",
  "notes",
  "converted_invoice_id",
  "created_at",
  "updated_at",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────────────────────

function maskUrl(url: string): string {
  if (url.startsWith("file:")) return url;
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname.slice(0, 8)}***`;
  } catch {
    return url.slice(0, 12) + "***";
  }
}

async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    return false; // No interactivo: nunca auto-aceptar
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${question} (s/n): `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "s");
    });
  });
}

function getRowValue(row: Record<string, unknown>, key: string): unknown {
  return (row as Record<string, unknown>)[key];
}

class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MigrationError";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      url: { type: "string" },
      token: { type: "string" },
      yes: { type: "boolean", default: false },
      "backup-verified": { type: "boolean", default: false },
    },
    strict: true,
  });

  if (!values.url) {
    console.error("ERROR: Proporciona --url (file:... o libsql://...)");
    console.error("USO: npx tsx scripts/migrate-budgets-client-nullable.ts --url \"file:electricista.db\" --yes");
    process.exit(1);
  }

  const dbUrl = values.url;
  const isLocal = dbUrl.startsWith("file:");
  const autoConfirm = values.yes === true;
  const backupVerified = values["backup-verified"] === true;
  const displayUrl = maskUrl(dbUrl);
  const isInteractive = Boolean(process.stdin.isTTY);

  console.log("");
  console.log("================================================================");
  console.log(`  MIGRACION: ${MIGRATION_ID}`);
  console.log(`  Base: ${displayUrl}`);
  console.log(`  Tipo: ${isLocal ? "LOCAL (file:)" : "REMOTA (Turso)"}`);
  console.log(`  Modo: ${isInteractive ? "INTERACTIVO" : (autoConfirm ? "NO-INTERACTIVO (--yes)" : "NO-INTERACTIVO (sin --yes)")}`);
  console.log("================================================================");
  console.log("");

  // ──── VERIFICAR --yes EN MODO NO INTERACTIVO ─────────────────────────────
  if (!isInteractive && !autoConfirm) {
    console.error("ERROR: Modo no interactivo requiere --yes para confirmar ejecucion.");
    console.error("  Agrega --yes para autorizar la migracion explicitamente.");
    process.exit(1);
  }

  // ──── BACKUP ─────────────────────────────────────────────────────────────
  if (isLocal) {
    const filePath = dbUrl.replace(/^file:/, "");
    if (!existsSync(filePath)) {
      console.error(`ERROR: Archivo no encontrado: ${filePath}`);
      process.exit(1);
    }
    // Verificar WAL/SHM (conexion activa)
    if (existsSync(`${filePath}-wal`) || existsSync(`${filePath}-shm`)) {
      console.error("ERROR: Existen archivos WAL/SHM junto a la base de datos.");
      console.error("  Esto indica una conexion activa o shutdown incompleto.");
      console.error("  Detener TODA la aplicacion y esperar a que desaparezcan:");
      console.error(`    ${filePath}-wal`);
      console.error(`    ${filePath}-shm`);
      console.error("  O ejecutar: sqlite3 DB \"PRAGMA wal_checkpoint(TRUNCATE);\"");
      process.exit(1);
    }
    // Validar que el archivo no este vacio
    const stat = statSync(filePath);
    if (stat.size === 0) {
      console.error("ERROR: El archivo de base de datos esta vacio.");
      process.exit(1);
    }
    const backupPath = `${filePath}.bak.${Date.now()}`;
    copyFileSync(filePath, backupPath);
    // Validar backup creado correctamente
    if (!existsSync(backupPath) || statSync(backupPath).size !== stat.size) {
      console.error("ERROR: No se pudo crear backup valido.");
      process.exit(1);
    }
    console.log(`OK Backup creado: ${backupPath} (${stat.size} bytes)`);
  } else {
    // Turso remoto: requiere --backup-verified
    if (!backupVerified) {
      console.error("ERROR: Base remota requiere --backup-verified para confirmar backup.");
      console.error("");
      console.error("  Antes de ejecutar, realiza:");
      console.error("    turso db shell <database> .dump > backup.sql");
      console.error("  o:");
      console.error("    turso db export <database> --output backup.db");
      console.error("");
      console.error("  Verifica con:");
      console.error("    sqlite3 backup.db \"PRAGMA integrity_check;\"");
      console.error("    sqlite3 backup.db \"SELECT COUNT(*) FROM budgets;\"");
      console.error("");
      console.error("  Luego ejecuta con: --backup-verified");
      process.exit(1);
    }
    console.log("OK --backup-verified proporcionado por operador.");
  }

  // ──── CONFIRMACION APP DETENIDA ──────────────────────────────────────────
  if (!autoConfirm) {
    if (!(await confirm("La aplicacion esta DETENIDA (sin escrituras)?"))) {
      console.log("Abortado.");
      process.exit(0);
    }
  } else {
    console.log("INFO --yes proporcionado: asumiendo aplicacion detenida.");
  }

  // ──── CONECTAR Y EJECUTAR CON CIERRE GARANTIZADO ─────────────────────────
  const db: Client = createClient({
    url: dbUrl,
    authToken: values.token,
  });

  try {
    await runMigration(db, autoConfirm);
  } finally {
    db.close();
  }
}

async function runMigration(db: Client, autoConfirm: boolean): Promise<void> {
  // ──── CREAR schema_migrations ──────────────────────────────────────────
  await db.execute(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT DEFAULT (datetime('now')),
      applied_by TEXT
    )`
  );

  // ──── VERIFICAR SI YA APLICADA ─────────────────────────────────────────
  const applied = await db.execute({
    sql: "SELECT id FROM schema_migrations WHERE id = ?",
    args: [MIGRATION_ID],
  });

  if (applied.rows.length > 0) {
    const info = await db.execute("PRAGMA table_info(budgets)");
    const clientIdRow = info.rows.find((r) => getRowValue(r, "name") === "client_id");
    if (clientIdRow && Number(getRowValue(clientIdRow, "notnull")) === 0) {
      console.log("OK Migracion ya aplicada. client_id es nullable. Nada que hacer.");
      return;
    }
    console.log("AVISO: Migracion registrada pero client_id sigue NOT NULL. Re-ejecutando...");
  }

  // ──── VERIFICAR SI TABLA budgets EXISTE ────────────────────────────────
  const tableExists = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='budgets'"
  );
  if (tableExists.rows.length === 0) {
    // Tabla no existe: no registrar migración, el CREATE TABLE la creará correcta
    console.log("OK Tabla budgets no existe aun. CREATE TABLE la creara con client_id nullable.");
    return;
  }

  // ──── VERIFICAR SI MIGRACION ES NECESARIA ──────────────────────────────
  const tableInfo = await db.execute("PRAGMA table_info(budgets)");
  const clientIdCol = tableInfo.rows.find((r) => getRowValue(r, "name") === "client_id");

  if (!clientIdCol) {
    // Columna no existe: esquema inesperado, no registrar, no migrar
    throw new MigrationError(
      "Tabla budgets existe pero no tiene columna client_id. Esquema inesperado."
    );
  }

  if (Number(getRowValue(clientIdCol, "notnull")) === 0) {
    console.log("OK client_id ya es nullable. Registrando migracion.");
    await db.execute({
      sql: "INSERT OR IGNORE INTO schema_migrations (id, applied_by) VALUES (?, ?)",
      args: [MIGRATION_ID, "scripts/migrate-budgets-client-nullable.ts"],
    });
    return;
  }

  console.log(`MIGRACION NECESARIA: client_id tiene notnull=1`);

  // ──── VERIFICAR budgets_new RESIDUAL ───────────────────────────────────
  const residual = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='budgets_new'"
  );

  if (residual.rows.length > 0) {
    const newCount = await db.execute("SELECT COUNT(*) as cnt FROM budgets_new");
    const origCount = await db.execute("SELECT COUNT(*) as cnt FROM budgets");
    throw new MigrationError(
      `Tabla budgets_new ya existe (migracion interrumpida previa). ` +
      `budgets_new: ${Number(getRowValue(newCount.rows[0], "cnt"))} filas, ` +
      `budgets: ${Number(getRowValue(origCount.rows[0], "cnt"))} filas. ` +
      `Requiere intervencion manual.`
    );
  }

  // ──── PRAGMA foreign_keys (informativo) ────────────────────────────────
  const fkResult = await db.execute("PRAGMA foreign_keys");
  const fkVal = Number(fkResult.rows[0]?.[0] ?? getRowValue(fkResult.rows[0], "foreign_keys") ?? 0);
  console.log(`INFO PRAGMA foreign_keys = ${fkVal} (db.migrate() lo gestiona automaticamente)`);

  // ──── CONTEOS PRE-MIGRACION ────────────────────────────────────────────
  const budgetCountRes = await db.execute("SELECT COUNT(*) as cnt FROM budgets");
  const budgetCount = Number(getRowValue(budgetCountRes.rows[0], "cnt"));

  const itemsCountRes = await db.execute("SELECT COUNT(*) as cnt FROM budget_items");
  const itemsCount = Number(getRowValue(itemsCountRes.rows[0], "cnt"));

  console.log(`Conteo pre-migracion: budgets=${budgetCount}, budget_items=${itemsCount}`);

  // ──── CONFIRMACION FINAL ───────────────────────────────────────────────
  if (!autoConfirm) {
    if (!(await confirm(`Ejecutar migracion sobre ${budgetCount} presupuestos?`))) {
      console.log("Abortado por usuario.");
      return;
    }
  }

  // ──── EJECUTAR MIGRACION ATOMICA ───────────────────────────────────────
  const colsList = BUDGETS_COLUMNS.join(", ");

  console.log("");
  console.log("Ejecutando migracion atomica (transaccion con rollback automatico)...");

  await db.migrate([
    `CREATE TABLE budgets_new (
      id TEXT PRIMARY KEY,
      number TEXT NOT NULL UNIQUE,
      client_id TEXT,
      date TEXT NOT NULL,
      valid_until TEXT,
      status TEXT DEFAULT 'draft',
      subtotal REAL DEFAULT 0,
      tax_rate REAL DEFAULT 21,
      tax_amount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      notes TEXT,
      converted_invoice_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (converted_invoice_id) REFERENCES invoices(id)
    )`,
    `INSERT INTO budgets_new (${colsList}) SELECT ${colsList} FROM budgets`,
    "DROP TABLE budgets",
    "ALTER TABLE budgets_new RENAME TO budgets",
  ]);

  console.log("OK Batch ejecutado (COMMIT realizado).");
  console.log("");

  // ──── VERIFICACIONES POST-MIGRACION ────────────────────────────────────
  console.log("Verificando resultado...");
  let allOk = true;

  // V1: client_id nullable
  const infoAfter = await db.execute("PRAGMA table_info(budgets)");
  const clientIdAfter = infoAfter.rows.find((r) => getRowValue(r, "name") === "client_id");
  if (!clientIdAfter || Number(getRowValue(clientIdAfter, "notnull")) !== 0) {
    console.error("  FALLO: client_id NO es nullable despues de migracion.");
    allOk = false;
  } else {
    console.log("  OK budgets.client_id -> notnull=0 (nullable)");
  }

  // V2: conteo budgets
  const countAfterRes = await db.execute("SELECT COUNT(*) as cnt FROM budgets");
  const countAfter = Number(getRowValue(countAfterRes.rows[0], "cnt"));
  if (countAfter !== budgetCount) {
    console.error(`  FALLO: Conteo budgets: esperado=${budgetCount}, actual=${countAfter}`);
    allOk = false;
  } else {
    console.log(`  OK budgets: ${countAfter} filas (sin cambio)`);
  }

  // V3: conteo budget_items
  const itemsAfterRes = await db.execute("SELECT COUNT(*) as cnt FROM budget_items");
  const itemsAfter = Number(getRowValue(itemsAfterRes.rows[0], "cnt"));
  if (itemsAfter !== itemsCount) {
    console.error(`  FALLO: Conteo budget_items: esperado=${itemsCount}, actual=${itemsAfter}`);
    allOk = false;
  } else {
    console.log(`  OK budget_items: ${itemsAfter} filas (sin cambio)`);
  }

  // V4: FK check budget_items
  const fkCheck = await db.execute("PRAGMA foreign_key_check(budget_items)");
  if (fkCheck.rows.length > 0) {
    console.error(`  FALLO: foreign_key_check(budget_items): ${fkCheck.rows.length} violaciones`);
    allOk = false;
  } else {
    console.log("  OK foreign_key_check(budget_items): 0 violaciones");
  }

  // V5: invoices.client_id NOT NULL
  const invInfo = await db.execute("PRAGMA table_info(invoices)");
  const invClientId = invInfo.rows.find((r) => getRowValue(r, "name") === "client_id");
  if (invClientId && Number(getRowValue(invClientId, "notnull")) !== 1) {
    console.error("  FALLO: invoices.client_id dejo de ser NOT NULL");
    allOk = false;
  } else {
    console.log("  OK invoices.client_id -> notnull=1 (sin cambio)");
  }

  // V6: integrity_check
  const integrity = await db.execute("PRAGMA integrity_check");
  const intVal = String(integrity.rows[0]?.[0] ?? getRowValue(integrity.rows[0], "integrity_check") ?? "");
  if (intVal !== "ok") {
    console.error(`  FALLO: integrity_check: ${intVal}`);
    allOk = false;
  } else {
    console.log("  OK integrity_check: ok");
  }

  // V7: INSERT con client_id NULL (UUID unico)
  const testId = randomUUID();
  const testNumber = `TEST_MIGR_${Date.now()}`;
  try {
    await db.execute({
      sql: "INSERT INTO budgets (id, number, client_id, date) VALUES (?, ?, NULL, ?)",
      args: [testId, testNumber, "2026-07-12"],
    });
    try {
      await db.execute({ sql: "DELETE FROM budgets WHERE id = ?", args: [testId] });
      console.log("  OK INSERT con client_id=NULL: funciona correctamente");
    } catch (delErr: unknown) {
      const delMsg = delErr instanceof Error ? delErr.message : String(delErr);
      console.error(`  FALLO: INSERT exitoso pero DELETE fallo: ${delMsg}`);
      console.error(`  ID temporal pendiente de limpieza manual: ${testId}`);
      allOk = false;
    }
  } catch (insErr: unknown) {
    const insMsg = insErr instanceof Error ? insErr.message : String(insErr);
    console.error(`  FALLO: INSERT con client_id=NULL: ${insMsg}`);
    allOk = false;
  }

  // ──── RESULTADO FINAL ──────────────────────────────────────────────────
  if (!allOk) {
    throw new MigrationError(
      "VERIFICACIONES FALLIDAS. RESTAURAR BACKUP INMEDIATAMENTE. " +
      "NO se registra la migracion como completada."
    );
  }

  // ──── REGISTRAR MIGRACION COMPLETADA ───────────────────────────────────
  await db.execute({
    sql: "INSERT OR IGNORE INTO schema_migrations (id, applied_by) VALUES (?, ?)",
    args: [MIGRATION_ID, "scripts/migrate-budgets-client-nullable.ts"],
  });

  console.log("");
  console.log("================================================================");
  console.log("  MIGRACION COMPLETADA EXITOSAMENTE");
  console.log(`  ${MIGRATION_ID}`);
  console.log("================================================================");
  console.log("");
  console.log("Puedes reiniciar la aplicacion.");
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\nERROR: ${msg}`);
  process.exit(1);
});
