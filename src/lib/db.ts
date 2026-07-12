import { createClient, Client } from "@libsql/client";
import { tmpdir } from "os";
import { join } from "path";
import { MATERIALES_DEMO } from "./materiales-demo";

let client: Client;

/**
 * Resolves the database URL.
 *
 * - If TURSO_DATABASE_URL is configured, use it (persistent, recommended for
 *   production).
 * - Otherwise fall back to a local SQLite file. On serverless platforms such as
 *   Vercel the project directory is READ-ONLY, so writing to "file:electricista.db"
 *   throws and every API route fails with a 500 (the app appears "stuck"). In
 *   that case we write to a writable temp directory so the app keeps working.
 *
 *   NOTE: the temp file is ephemeral and is NOT shared between serverless
 *   instances or preserved across deployments. Configure TURSO_DATABASE_URL for
 *   durable storage.
 */
function resolveDatabaseUrl(): string {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  if (tursoUrl) {
    return tursoUrl;
  }

  const isServerless = Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.AWS_REGION ||
      process.env.NETLIFY
  );

  if (isServerless) {
    return `file:${join(tmpdir(), "electricista.db")}`;
  }

  return "file:electricista.db";
}

export function getDbClient(): Client {
  if (!client) {
    client = createClient({
      url: resolveDatabaseUrl(),
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

/**
 * Anade columnas faltantes a una tabla ya existente, de forma idempotente.
 * Usa PRAGMA table_info para saber que columnas existen y solo hace ALTER de
 * las que falten. Los defaults deben ser constantes (SQLite no permite
 * defaults no constantes como datetime('now') al hacer ADD COLUMN).
 */
async function ensureColumns(
  db: Client,
  table: string,
  columns: { name: string; def: string }[]
): Promise<void> {
  try {
    const info = await db.execute(`PRAGMA table_info(${table})`);
    const existing = new Set(info.rows.map((r) => String(r.name)));
    for (const col of columns) {
      if (!existing.has(col.name)) {
        try {
          await db.execute(`ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.def}`);
        } catch {
          /* la columna ya existe o no se puede anadir; se ignora */
        }
      }
    }
  } catch {
    /* la tabla puede no existir todavia; se ignora */
  }
}

async function migrateSchema(db: Client): Promise<void> {
  await ensureColumns(db, "clients", [
    { name: "nif", def: "TEXT" },
    { name: "email", def: "TEXT" },
    { name: "phone", def: "TEXT" },
    { name: "address", def: "TEXT" },
    { name: "city", def: "TEXT" },
    { name: "postal_code", def: "TEXT" },
    { name: "province", def: "TEXT" },
    { name: "notes", def: "TEXT" },
    { name: "client_type", def: "TEXT DEFAULT 'particular'" },
    { name: "created_at", def: "TEXT" },
    { name: "updated_at", def: "TEXT" },
  ]);

  await ensureColumns(db, "invoices", [
    { name: "due_date", def: "TEXT" },
    { name: "status", def: "TEXT DEFAULT 'draft'" },
    { name: "subtotal", def: "REAL DEFAULT 0" },
    { name: "tax_rate", def: "REAL DEFAULT 21" },
    { name: "tax_amount", def: "REAL DEFAULT 0" },
    { name: "total", def: "REAL DEFAULT 0" },
    { name: "notes", def: "TEXT" },
    { name: "payment_method", def: "TEXT DEFAULT 'transferencia'" },
    { name: "ticketbai_id", def: "TEXT" },
    { name: "ticketbai_signature", def: "TEXT" },
    { name: "ticketbai_qr", def: "TEXT" },
    { name: "ticketbai_description", def: "TEXT" },
    { name: "ticketbai_tipo_operacion", def: "TEXT" },
    { name: "created_at", def: "TEXT" },
    { name: "updated_at", def: "TEXT" },
  ]);

  await ensureColumns(db, "invoice_items", [
    { name: "discount", def: "REAL DEFAULT 0" },
    { name: "discount_type", def: "TEXT DEFAULT 'percent'" },
    { name: "sort_order", def: "INTEGER DEFAULT 0" },
  ]);

  await ensureColumns(db, "budgets", [
    { name: "valid_until", def: "TEXT" },
    { name: "status", def: "TEXT DEFAULT 'draft'" },
    { name: "subtotal", def: "REAL DEFAULT 0" },
    { name: "tax_rate", def: "REAL DEFAULT 21" },
    { name: "tax_amount", def: "REAL DEFAULT 0" },
    { name: "total", def: "REAL DEFAULT 0" },
    { name: "notes", def: "TEXT" },
    { name: "converted_invoice_id", def: "TEXT" },
    { name: "created_at", def: "TEXT" },
    { name: "updated_at", def: "TEXT" },
  ]);

  await ensureColumns(db, "budget_items", [
    { name: "sort_order", def: "INTEGER DEFAULT 0" },
  ]);

  await ensureColumns(db, "communications", [
    { name: "subject", def: "TEXT" },
    { name: "status", def: "TEXT DEFAULT 'sent'" },
    { name: "created_at", def: "TEXT" },
  ]);

  await ensureColumns(db, "calls", [
    { name: "client_name", def: "TEXT" },
    { name: "phone", def: "TEXT" },
    { name: "direction", def: "TEXT DEFAULT 'incoming'" },
    { name: "duration", def: "INTEGER" },
    { name: "notes", def: "TEXT" },
    { name: "created_at", def: "TEXT" },
  ]);

  await ensureColumns(db, "visits", [
    { name: "description", def: "TEXT" },
    { name: "time", def: "TEXT" },
    { name: "duration", def: "INTEGER DEFAULT 60" },
    { name: "status", def: "TEXT DEFAULT 'scheduled'" },
    { name: "address", def: "TEXT" },
    { name: "notes", def: "TEXT" },
    { name: "created_at", def: "TEXT" },
    { name: "updated_at", def: "TEXT" },
  ]);

  await ensureColumns(db, "catalog_items", [
    { name: "description", def: "TEXT" },
    { name: "category", def: "TEXT" },
    { name: "cost_price", def: "REAL DEFAULT 0" },
    { name: "created_at", def: "TEXT" },
  ]);

  // Migración de budgets.client_id NOT NULL → nullable:
  // En bases NUEVAS, CREATE TABLE ya define client_id TEXT (nullable).
  // En bases EXISTENTES, ejecutar manualmente:
  //   npx tsx scripts/migrate-budgets-client-nullable.ts --url "file:electricista.db"
  // Ver scripts/migrate-budgets-client-nullable.ts para detalles.
}

export async function initializeDatabase(): Promise<void> {
  const db = getDbClient();

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      nif TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      city TEXT,
      postal_code TEXT,
      province TEXT,
      notes TEXT,
      client_type TEXT DEFAULT 'particular',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      number TEXT NOT NULL UNIQUE,
      client_id TEXT NOT NULL,
      date TEXT NOT NULL,
      due_date TEXT,
      status TEXT DEFAULT 'draft',
      subtotal REAL DEFAULT 0,
      tax_rate REAL DEFAULT 21,
      tax_amount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      notes TEXT,
      payment_method TEXT DEFAULT 'transferencia',
      ticketbai_id TEXT,
      ticketbai_signature TEXT,
      ticketbai_qr TEXT,
      ticketbai_description TEXT,
      ticketbai_tipo_operacion TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id)
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      description TEXT NOT NULL,
      quantity REAL DEFAULT 1,
      unit_price REAL NOT NULL,
      total REAL NOT NULL,
      discount REAL DEFAULT 0,
      discount_type TEXT DEFAULT 'percent',
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS budgets (
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
    );

    CREATE TABLE IF NOT EXISTS budget_items (
      id TEXT PRIMARY KEY,
      budget_id TEXT NOT NULL,
      description TEXT NOT NULL,
      quantity REAL DEFAULT 1,
      unit_price REAL NOT NULL,
      total REAL NOT NULL,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS communications (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      type TEXT NOT NULL,
      subject TEXT,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'sent',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id)
    );

    CREATE TABLE IF NOT EXISTS calls (
      id TEXT PRIMARY KEY,
      client_id TEXT,
      client_name TEXT,
      phone TEXT,
      direction TEXT DEFAULT 'incoming',
      duration INTEGER,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS visits (
      id TEXT PRIMARY KEY,
      client_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      date TEXT NOT NULL,
      time TEXT,
      duration INTEGER DEFAULT 60,
      status TEXT DEFAULT 'scheduled',
      address TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id)
    );

    CREATE TABLE IF NOT EXISTS catalog_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      unit_price REAL NOT NULL,
      category TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migracion: anade columnas que puedan faltar en tablas creadas por versiones
  // antiguas de la app (el CREATE TABLE IF NOT EXISTS no modifica tablas ya
  // existentes, asi que si la base de datos es vieja le faltan columnas nuevas
  // y los INSERT fallan). Cada columna se anade solo si no existe.
  await migrateSchema(db);

  // Seed catalog items if empty (usa materiales profesionales de MAT-001)
  const result = await db.execute("SELECT COUNT(*) as count FROM catalog_items");
  const count = result.rows[0].count as number;

  if (count === 0) {
    for (const mat of MATERIALES_DEMO) {
      await db.execute({
        sql: "INSERT INTO catalog_items (id, name, unit_price, category) VALUES (?, ?, ?, ?)",
        args: [mat.id, mat.name, mat.unit_price, mat.category],
      });
    }
  }
}

export async function generateInvoiceNumber(): Promise<string> {
  const db = getDbClient();
  const result = await db.execute(
    "SELECT number FROM invoices ORDER BY created_at DESC LIMIT 1"
  );

  if (result.rows.length === 0) {
    return "DFB_0001";
  }

  const lastNum = parseInt((result.rows[0].number as string).replace("DFB_", ""), 10);
  return `DFB_${String(lastNum + 1).padStart(4, "0")}`;
}

export async function generateBudgetNumber(): Promise<string> {
  const db = getDbClient();
  const result = await db.execute(
    "SELECT number FROM budgets ORDER BY created_at DESC LIMIT 1"
  );

  if (result.rows.length === 0) {
    return "PRES_0001";
  }

  const lastNum = parseInt((result.rows[0].number as string).replace("PRES_", ""), 10);
  return `PRES_${String(lastNum + 1).padStart(4, "0")}`;
}
