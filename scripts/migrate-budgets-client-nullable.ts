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
 *   --url              (obligatorio) URL de la base de datos
 *   --token            Token de autenticacion para Turso remoto
 *   --yes              Confirma ejecucion (obligatorio en modo no interactivo)
 *   --backup-verified  Confirma backup manual realizado (obligatorio para Turso)
 */

import { createClient, type Client } from "@libsql/client";
import { parseArgs } from "node:util";
import { copyFileSync, existsSync, statSync } from "node:fs";
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";

const MIGRATION_ID = "BUD_CLIENT_ID_NULLABLE_001";

const BUDGETS_COLUMNS = [
  "id", "number", "client_id", "date", "valid_until", "status",
  "subtotal", "tax_rate", "tax_amount", "total", "notes",
  "converted_invoice_id", "created_at", "updated_at",
] as const;

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
  if (!process.stdin.isTTY) return false;
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
  constructor(message: string) { super(message); this.name = "MigrationError"; }
}

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
  const isInteractive = Boolean(process.stdin.isTTY);

  console.log("");
  console.log("================================================================");
  console.log(`  MIGRACION: ${MIGRATION_ID}`);
  console.log(`  Base: ${maskUrl(dbUrl)}`);
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
    if (existsSync(`${filePath}-wal`) || existsSync(`${filePath}-shm`)) {
      console.error("ERROR: Existen archivos WAL/SHM (conexion activa o shutdown incompleto).");
      console.error(`  ${filePath}-wal / ${filePath}-shm`);
      console.error("  Detener app o ejecutar: sqlite3 DB \"PRAGMA wal_checkpoint(TRUNCATE);\"");
      process.exit(1);
    }
    const stat = statSync(filePath);
    if (stat.size === 0) {
      console.error("ERROR: El archivo de base de datos esta vacio.");
      process.exit(1);
    }
    // Copiar backup
    const backupPath = `${filePath}.bak.${Date.now()}`;
    copyFileSync(filePath, backupPath);
    if (!existsSync(backupPath) || statSync(backupPath).size !== stat.size) {
      console.error("ERROR: No se pudo crear copia del backup.");
      process.exit(1);
    }
    // Verificar backup con cliente independiente
    const backupDb = createClient({ url: `file:${backupPath}` });
    try {
      const bkIntegrity = await backupDb.execute("PRAGMA integrity_check");
      const bkIntVal = String(bkIntegrity.rows[0]?.[0] ?? getRowValue(bkIntegrity.rows[0], "integrity_check") ?? "");
      if (bkIntVal !== "ok") {
        console.error(`ERROR: Backup corrupto. integrity_check: ${bkIntVal}`);
        console.error(`  Backup conservado en: ${backupPath}`);
        process.exit(1);
      }
      const bkBudgets = Number(getRowValue((await backupDb.execute("SELECT COUNT(*) as cnt FROM budgets")).rows[0], "cnt"));
      const bkItems = Number(getRowValue((await backupDb.execute("SELECT COUNT(*) as cnt FROM budget_items")).rows[0], "cnt"));
      // Comparar con original
      const origDb = createClient({ url: dbUrl });
      try {
        const origBudgets = Number(getRowValue((await origDb.execute("SELECT COUNT(*) as cnt FROM budgets")).rows[0], "cnt"));
        const origItems = Number(getRowValue((await origDb.execute("SELECT COUNT(*) as cnt FROM budget_items")).rows[0], "cnt"));
        if (bkBudgets !== origBudgets || bkItems !== origItems) {
          console.error("ERROR: Conteos del backup no coinciden con la base original.");
          console.error(`  Original: budgets=${origBudgets}, budget_items=${origItems}`);
          console.error(`  Backup:   budgets=${bkBudgets}, budget_items=${bkItems}`);
          console.error(`  Backup conservado en: ${backupPath}`);
          process.exit(1);
        }
      } finally {
        origDb.close();
      }
      console.log(`OK Backup verificado: ${backupPath}`);
      console.log(`   integrity_check: ok | budgets: ${bkBudgets} | budget_items: ${bkItems}`);
    } finally {
      backupDb.close();
    }
  } else {
    if (!backupVerified) {
      console.error("ERROR: Base remota requiere --backup-verified para confirmar backup.");
      console.error("  Realiza antes: turso db export <database> --output backup.db");
      console.error("  Verifica: sqlite3 backup.db \"PRAGMA integrity_check;\"");
      console.error("  Luego agrega: --backup-verified");
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
    console.log("INFO --yes: asumiendo aplicacion detenida.");
  }

  // ──── CONECTAR Y EJECUTAR ────────────────────────────────────────────────
  const db: Client = createClient({ url: dbUrl, authToken: values.token });
  try {
    await runMigration(db, autoConfirm);
  } finally {
    db.close();
  }
}

async function runMigration(db: Client, autoConfirm: boolean): Promise<void> {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY, applied_at TEXT DEFAULT (datetime('now')), applied_by TEXT
    )`
  );

  // ──── VERIFICAR SI YA APLICADA ─────────────────────────────────────────
  const applied = await db.execute({ sql: "SELECT id FROM schema_migrations WHERE id = ?", args: [MIGRATION_ID] });
  if (applied.rows.length > 0) {
    const info = await db.execute("PRAGMA table_info(budgets)");
    const col = info.rows.find((r) => getRowValue(r, "name") === "client_id");
    if (col && Number(getRowValue(col, "notnull")) === 0) {
      console.log("OK Migracion ya aplicada. client_id es nullable. Nada que hacer.");
      return;
    }
    console.log("AVISO: Registrada pero client_id sigue NOT NULL. Re-ejecutando...");
  }

  // ──── VERIFICAR TABLA budgets ──────────────────────────────────────────
  const tableExists = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='budgets'");
  if (tableExists.rows.length === 0) {
    console.log("OK Tabla budgets no existe. CREATE TABLE la creara con client_id nullable.");
    return;
  }

  const tableInfo = await db.execute("PRAGMA table_info(budgets)");
  const clientIdCol = tableInfo.rows.find((r) => getRowValue(r, "name") === "client_id");
  if (!clientIdCol) {
    throw new MigrationError("Tabla budgets existe pero no tiene columna client_id. Esquema inesperado.");
  }
  if (Number(getRowValue(clientIdCol, "notnull")) === 0) {
    console.log("OK client_id ya es nullable. Registrando migracion.");
    await db.execute({ sql: "INSERT OR IGNORE INTO schema_migrations (id, applied_by) VALUES (?, ?)", args: [MIGRATION_ID, "script"] });
    return;
  }

  console.log("MIGRACION NECESARIA: client_id tiene notnull=1");

  // ──── VERIFICAR budgets_new RESIDUAL ───────────────────────────────────
  const residual = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='budgets_new'");
  if (residual.rows.length > 0) {
    const nc = Number(getRowValue((await db.execute("SELECT COUNT(*) as cnt FROM budgets_new")).rows[0], "cnt"));
    const oc = Number(getRowValue((await db.execute("SELECT COUNT(*) as cnt FROM budgets")).rows[0], "cnt"));
    throw new MigrationError(`budgets_new ya existe (budgets_new: ${nc}, budgets: ${oc}). Intervencion manual requerida.`);
  }

  // ──── CONTEOS PRE-MIGRACION ────────────────────────────────────────────
  const budgetCount = Number(getRowValue((await db.execute("SELECT COUNT(*) as cnt FROM budgets")).rows[0], "cnt"));
  const itemsCount = Number(getRowValue((await db.execute("SELECT COUNT(*) as cnt FROM budget_items")).rows[0], "cnt"));
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
  console.log("\nEjecutando migracion atomica...");

  await db.migrate([
    `CREATE TABLE budgets_new (
      id TEXT PRIMARY KEY, number TEXT NOT NULL UNIQUE, client_id TEXT,
      date TEXT NOT NULL, valid_until TEXT, status TEXT DEFAULT 'draft',
      subtotal REAL DEFAULT 0, tax_rate REAL DEFAULT 21, tax_amount REAL DEFAULT 0,
      total REAL DEFAULT 0, notes TEXT, converted_invoice_id TEXT,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (converted_invoice_id) REFERENCES invoices(id)
    )`,
    `INSERT INTO budgets_new (${colsList}) SELECT ${colsList} FROM budgets`,
    "DROP TABLE budgets",
    "ALTER TABLE budgets_new RENAME TO budgets",
  ]);

  console.log("OK Batch ejecutado (COMMIT).\n");

  // ──── VERIFICACIONES POST-MIGRACION ────────────────────────────────────
  console.log("Verificando resultado...");
  let allOk = true;

  // V1: client_id nullable
  const infoAfter = await db.execute("PRAGMA table_info(budgets)");
  const colAfter = infoAfter.rows.find((r) => getRowValue(r, "name") === "client_id");
  if (!colAfter || Number(getRowValue(colAfter, "notnull")) !== 0) {
    console.error("  FALLO: client_id NO es nullable.");
    allOk = false;
  } else {
    console.log("  OK budgets.client_id -> notnull=0");
  }

  // V2: conteo budgets
  const cntAfter = Number(getRowValue((await db.execute("SELECT COUNT(*) as cnt FROM budgets")).rows[0], "cnt"));
  if (cntAfter !== budgetCount) {
    console.error(`  FALLO: budgets esperado=${budgetCount}, actual=${cntAfter}`);
    allOk = false;
  } else {
    console.log(`  OK budgets: ${cntAfter} filas`);
  }

  // V3: conteo budget_items
  const itemsAfter = Number(getRowValue((await db.execute("SELECT COUNT(*) as cnt FROM budget_items")).rows[0], "cnt"));
  if (itemsAfter !== itemsCount) {
    console.error(`  FALLO: budget_items esperado=${itemsCount}, actual=${itemsAfter}`);
    allOk = false;
  } else {
    console.log(`  OK budget_items: ${itemsAfter} filas`);
  }

  // V4: FK check
  const fkCheck = await db.execute("PRAGMA foreign_key_check(budget_items)");
  if (fkCheck.rows.length > 0) {
    console.error(`  FALLO: foreign_key_check: ${fkCheck.rows.length} violaciones`);
    allOk = false;
  } else {
    console.log("  OK foreign_key_check(budget_items): 0 violaciones");
  }

  // V5: invoices.client_id NOT NULL (estricto)
  const invTableExists = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='invoices'");
  if (invTableExists.rows.length === 0) {
    console.error("  FALLO: tabla invoices no existe.");
    allOk = false;
  } else {
    const invInfo = await db.execute("PRAGMA table_info(invoices)");
    const invCol = invInfo.rows.find((r) => getRowValue(r, "name") === "client_id");
    if (!invCol) {
      console.error("  FALLO: invoices no tiene columna client_id.");
      allOk = false;
    } else if (Number(getRowValue(invCol, "notnull")) !== 1) {
      console.error("  FALLO: invoices.client_id dejo de ser NOT NULL.");
      allOk = false;
    } else {
      console.log("  OK invoices.client_id -> notnull=1");
    }
  }

  // V6: integrity_check
  const ic = await db.execute("PRAGMA integrity_check");
  const icVal = String(ic.rows[0]?.[0] ?? getRowValue(ic.rows[0], "integrity_check") ?? "");
  if (icVal !== "ok") {
    console.error(`  FALLO: integrity_check: ${icVal}`);
    allOk = false;
  } else {
    console.log("  OK integrity_check: ok");
  }

  // V7: INSERT con client_id NULL
  const testId = randomUUID();
  const testNum = `TEST_MIGR_${Date.now()}`;
  try {
    await db.execute({ sql: "INSERT INTO budgets (id, number, client_id, date) VALUES (?, ?, NULL, ?)", args: [testId, testNum, "2026-07-12"] });
    try {
      await db.execute({ sql: "DELETE FROM budgets WHERE id = ?", args: [testId] });
      console.log("  OK INSERT client_id=NULL funciona");
    } catch (e: unknown) {
      console.error(`  FALLO: DELETE test: ${e instanceof Error ? e.message : e}`);
      console.error(`  ID limpieza manual: ${testId}`);
      allOk = false;
    }
  } catch (e: unknown) {
    console.error(`  FALLO: INSERT client_id=NULL: ${e instanceof Error ? e.message : e}`);
    allOk = false;
  }

  if (!allOk) {
    throw new MigrationError("VERIFICACIONES FALLIDAS. RESTAURAR BACKUP.");
  }

  // ──── REGISTRAR ────────────────────────────────────────────────────────
  await db.execute({ sql: "INSERT OR IGNORE INTO schema_migrations (id, applied_by) VALUES (?, ?)", args: [MIGRATION_ID, "script"] });

  console.log("\n================================================================");
  console.log("  MIGRACION COMPLETADA EXITOSAMENTE");
  console.log(`  ${MIGRATION_ID}`);
  console.log("================================================================\n");
  console.log("Reiniciar la aplicacion.");
}

main().catch((err: unknown) => {
  console.error(`\nERROR: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
