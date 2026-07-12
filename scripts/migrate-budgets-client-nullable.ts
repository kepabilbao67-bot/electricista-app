/**
 * MIGRACION OPERATIVA: BUD_CLIENT_ID_NULLABLE_001
 *
 * Hace budgets.client_id nullable en bases de datos existentes donde fue
 * creada con NOT NULL por versiones anteriores de la aplicacion.
 *
 * EJECUCION MANUAL. UNICA VEZ. NO se ejecuta en arranque, build ni deploy.
 *
 * USO:
 *   npx tsx scripts/migrate-budgets-client-nullable.ts --url "file:electricista.db"
 *   npx tsx scripts/migrate-budgets-client-nullable.ts --url "libsql://..." --token "..."
 *
 * PREREQUISITOS:
 *   1. Detener la aplicacion (sin escrituras concurrentes).
 *   2. Realizar backup verificado (ver instrucciones en pantalla).
 *   3. Ejecutar este script.
 *   4. Verificar resultado.
 *   5. Reiniciar la aplicacion.
 */

import { createClient, type Client } from "@libsql/client";
import { parseArgs } from "node:util";
import { copyFileSync, existsSync } from "node:fs";
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
  if (url.startsWith("file:")) {
    return url;
  }
  // Para URLs remotas, ocultar despues del host
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname.slice(0, 8)}***`;
  } catch {
    return url.slice(0, 12) + "***";
  }
}

async function confirm(question: string): Promise<boolean> {
  // Si stdin no es interactivo (pipe), aceptar automaticamente
  if (!process.stdin.isTTY) {
    console.log(`${question} (s/n): s [auto-aceptado: stdin no interactivo]`);
    return true;
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

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      url: { type: "string" },
      token: { type: "string" },
    },
    strict: true,
  });

  if (!values.url) {
    console.error("ERROR: Proporciona --url (file:... o libsql://...)");
    console.error("Ejemplo: npx tsx scripts/migrate-budgets-client-nullable.ts --url \"file:electricista.db\"");
    process.exit(1);
  }

  const dbUrl = values.url;
  const isLocal = dbUrl.startsWith("file:");
  const displayUrl = maskUrl(dbUrl);

  console.log("");
  console.log("================================================================");
  console.log(`  MIGRACION: ${MIGRATION_ID}`);
  console.log(`  Base: ${displayUrl}`);
  console.log(`  Tipo: ${isLocal ? "LOCAL (file:)" : "REMOTA (Turso)"}`);
  console.log("================================================================");
  console.log("");

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
      console.error("  O ejecutar un checkpoint manual: sqlite3 DB \"PRAGMA wal_checkpoint(TRUNCATE);\"");
      process.exit(1);
    }
    const backupPath = `${filePath}.bak.${Date.now()}`;
    copyFileSync(filePath, backupPath);
    console.log(`OK Backup creado: ${backupPath}`);
  } else {
    console.log("BASE REMOTA: Asegurate de haber ejecutado ANTES:");
    console.log("    turso db shell <database> .dump > backup.sql");
    console.log("  o:");
    console.log("    turso db export <database> --output backup.db");
    console.log("");
    console.log("Verifica el backup con:");
    console.log("    sqlite3 backup.db \"PRAGMA integrity_check;\"");
    console.log("    sqlite3 backup.db \"SELECT COUNT(*) FROM budgets;\"");
    console.log("    sqlite3 backup.db \"SELECT COUNT(*) FROM budget_items;\"");
    console.log("");
    if (!(await confirm("Backup realizado y verificado?"))) {
      console.log("Abortado.");
      process.exit(0);
    }
  }

  // ──── CONFIRMACION APP DETENIDA ──────────────────────────────────────────
  if (!(await confirm("La aplicacion esta DETENIDA (sin escrituras)?"))) {
    console.log("Abortado. Deten la aplicacion antes de migrar.");
    process.exit(0);
  }

  // ──── CONECTAR ───────────────────────────────────────────────────────────
  const db: Client = createClient({
    url: dbUrl,
    authToken: values.token,
  });

  try {
    await runMigration(db);
  } finally {
    db.close();
  }
}

async function runMigration(db: Client): Promise<void> {
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

  // ──── VERIFICAR SI MIGRACION ES NECESARIA ──────────────────────────────
  const tableInfo = await db.execute("PRAGMA table_info(budgets)");
  const clientIdCol = tableInfo.rows.find((r) => getRowValue(r, "name") === "client_id");

  if (!clientIdCol) {
    console.log("OK Tabla budgets no tiene client_id. CREATE TABLE la creara correctamente.");
    await db.execute({
      sql: "INSERT OR IGNORE INTO schema_migrations (id, applied_by) VALUES (?, ?)",
      args: [MIGRATION_ID, "scripts/migrate-budgets-client-nullable.ts"],
    });
    return;
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
    console.error("");
    console.error("ERROR: La tabla budgets_new ya existe (migracion interrumpida previa).");
    console.error(`  budgets_new: ${Number(getRowValue(newCount.rows[0], "cnt"))} filas`);
    console.error(`  budgets:     ${Number(getRowValue(origCount.rows[0], "cnt"))} filas`);
    console.error("");
    console.error("Requiere intervencion manual. Inspecciona ambas tablas y decide:");
    console.error("  - Si budgets_new es basura: DROP TABLE budgets_new;");
    console.error("  - Si budgets_new es valida: inspeccionar datos antes de actuar.");
    console.error("");
    console.error("NO EJECUTAR");
    process.exit(1);
  }

  // ──── VERIFICAR PRAGMA foreign_keys (informativo) ───────────────────────
  // NOTA: db.migrate() gestiona automaticamente PRAGMA foreign_keys=OFF antes
  // del batch y =ON despues. No es necesario desactivarlo manualmente.
  const fkResult = await db.execute("PRAGMA foreign_keys");
  const fkVal = Number(fkResult.rows[0]?.[0] ?? getRowValue(fkResult.rows[0], "foreign_keys") ?? 0);
  console.log(`INFO PRAGMA foreign_keys = ${fkVal} (db.migrate() lo desactiva automaticamente)`);

  // ──── CONTEOS PRE-MIGRACION ────────────────────────────────────────────
  const budgetCountRes = await db.execute("SELECT COUNT(*) as cnt FROM budgets");
  const budgetCount = Number(getRowValue(budgetCountRes.rows[0], "cnt"));

  const itemsCountRes = await db.execute("SELECT COUNT(*) as cnt FROM budget_items");
  const itemsCount = Number(getRowValue(itemsCountRes.rows[0], "cnt"));

  console.log(`Conteo pre-migracion: budgets=${budgetCount}, budget_items=${itemsCount}`);

  // ──── CONFIRMACION FINAL ───────────────────────────────────────────────
  if (!(await confirm(`Ejecutar migracion sobre ${budgetCount} presupuestos?`))) {
    console.log("Abortado por usuario.");
    return;
  }

  // ──── EJECUTAR MIGRACION ATOMICA ───────────────────────────────────────
  // Usa migrate() que es un batch atomico con PRAGMA foreign_keys=OFF/ON
  // automatico. Si cualquier sentencia falla, ROLLBACK completo.
  const colsList = BUDGETS_COLUMNS.join(", ");

  console.log("");
  console.log("Ejecutando migracion atomica (transaccion con rollback automatico)...");

  try {
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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("");
    console.error("ERROR: Migracion fallida. ROLLBACK automatico. Base intacta.");
    console.error(`  Detalle: ${msg}`);
    process.exit(1);
  }

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

  // V7: INSERT con client_id NULL (con UUID unico)
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
    console.error("");
    console.error("================================================================");
    console.error("  VERIFICACIONES FALLIDAS");
    console.error("  RESTAURAR BACKUP INMEDIATAMENTE");
    console.error("================================================================");
    console.error("");
    console.error("NO se registra la migracion como completada.");
    process.exit(1);
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
  console.log("Este script puede eliminarse del repositorio tras verificar.");
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`Error fatal: ${msg}`);
  process.exit(1);
});
