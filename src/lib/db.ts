import { createClient, Client, InStatement, ResultSet } from "@libsql/client";

export interface SqlExecutor {
  execute(stmt: InStatement): Promise<ResultSet>;
}
import { tmpdir } from "os";
import { join } from "path";
import { MATERIALES_DEMO } from "./materiales-demo";

let client: Client | undefined;

export function getTestDatabaseUrl(): string {
  const suffix = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  return `file:${join(tmpdir(), `autonomo360-test-${suffix}.db`)}`;
}

function isExplicitTestRun(): boolean {
  const argv = process.argv.join(" ");
  return (
    process.env.NODE_ENV === "test" ||
    process.env.npm_lifecycle_event === "test" ||
    Boolean(process.env.JEST_WORKER_ID) ||
    process.env.VITEST === "true" ||
    process.env.TSX_TEST === "true" ||
    argv.includes("tsx --test") ||
    argv.includes("--test") ||
    argv.includes("node:test")
  );
}

/**
 * Resolves the database URL.
 *
 * Priority (highest first):
 * 1. TEST_DATABASE_URL — injected by test helpers; prevents any access to
 *    electricista.db or remote Turso during automated test runs.
 * 2. TURSO_DATABASE_URL — production/staging persistent database.
 * 3. Local SQLite file only for local development.
 *
 * In serverless/production, a non-persistent local file is rejected so a
 * misconfigured deployment fails loudly instead of silently losing data.
 */
function resolveDatabaseUrl(): string {
  const testUrl = process.env.TEST_DATABASE_URL?.trim();
  if (testUrl) {
    return testUrl;
  }

  if (isExplicitTestRun()) {
    return getTestDatabaseUrl();
  }

  if (process.env.DEMO_MODE === "true") {
    return `file:${join(tmpdir(), "autonomo360-demo.db")}`;
  }

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
    throw new Error(
      "Database configuration missing for serverless/production: set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN. Falling back to a local SQLite file is disabled to avoid silent data loss."
    );
  }

  return "file:electricista.db";
}

export function getDbClient(): Client {
  if (!client) {
    client = createClient({
      url: resolveDatabaseUrl(),
      authToken: process.env.TEST_DATABASE_URL ? undefined : process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

/**
 * Replaces the singleton client with a caller-supplied client.
 * ONLY for use in test files — never call from production code.
 * Pass an in-memory libsql client to ensure tests never touch electricista.db.
 *
 * @example
 * import { createClient } from "@libsql/client";
 * import { setDbClientForTesting, resetDbClient } from "@/lib/db";
 * before(async () => {
 *   const db = createClient({ url: "file::memory:" });
 *   setDbClientForTesting(db);
 *   await initializeDatabase(db);
 * });
 * after(() => resetDbClient());
 */
export function setDbClientForTesting(testClient: Client): void {
  client = testClient;
}

/**
 * Clears the singleton so the next getDbClient() call creates a fresh one.
 * ONLY for use in test teardown.
 */
export function resetDbClient(): void {
  client = undefined;
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
    { name: "first_name", def: "TEXT" },
    { name: "last_name", def: "TEXT" },
    { name: "company", def: "TEXT" },
    { name: "source", def: "TEXT" },
    { name: "status", def: "TEXT DEFAULT 'nuevo'" },
    { name: "probability", def: "REAL DEFAULT 0" },
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
    { name: "address_color", def: "TEXT" },
    { name: "notes_color", def: "TEXT" },
  ]);

  await ensureColumns(db, "opportunities", [
    { name: "probability", def: "REAL DEFAULT 0" },
    { name: "assigned_to", def: "TEXT" },
    { name: "responsable", def: "TEXT" },
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
    { name: "source_part_id", def: "TEXT" },
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
    { name: "notes_color", def: "TEXT" },
  ]);

  await ensureColumns(db, "budget_items", [
    { name: "sort_order", def: "INTEGER DEFAULT 0" },
  ]);

  await ensureColumns(db, "communications", [
    { name: "subject", def: "TEXT" },
    { name: "status", def: "TEXT DEFAULT 'sent'" },
    { name: "created_at", def: "TEXT" },
    { name: "subject_color", def: "TEXT" },
    { name: "message_color", def: "TEXT" },
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
    { name: "title_color", def: "TEXT" },
    { name: "description_color", def: "TEXT" },
    { name: "address_color", def: "TEXT" },
  ]);

  await ensureColumns(db, "catalog_items", [
    { name: "description", def: "TEXT" },
    { name: "category", def: "TEXT" },
    { name: "cost_price", def: "REAL DEFAULT 0" },
    { name: "created_at", def: "TEXT" },
    { name: "name_color", def: "TEXT" },
    { name: "description_color", def: "TEXT" },
    { name: "category_color", def: "TEXT" },
  ]);

  await ensureColumns(db, "leads", [
    { name: "name_color", def: "TEXT" },
    { name: "source_color", def: "TEXT" },
    { name: "interest_color", def: "TEXT" },
    { name: "message_color", def: "TEXT" },
  ]);

  await ensureColumns(db, "partes_trabajo", [
    { name: "client_id", def: "TEXT" },
    { name: "budget_id", def: "TEXT" },
    { name: "visit_id", def: "TEXT" },
    { name: "created_at", def: "TEXT" },
    { name: "updated_at", def: "TEXT" },
    { name: "iva_rate", def: "REAL DEFAULT 21" },
    { name: "descuento", def: "REAL DEFAULT 0" },
    { name: "direccion_color", def: "TEXT" },
    { name: "observaciones_color", def: "TEXT" },
  ]);

  await ensureColumns(db, "parte_trabajo_lineas", [
    { name: "sort_order", def: "INTEGER DEFAULT 0" },
    { name: "nombre_trabajo", def: "TEXT" },
    { name: "cantidad", def: "REAL DEFAULT 1" },
    { name: "unidad", def: "TEXT DEFAULT 'unidad'" },
    { name: "precio_unitario", def: "REAL DEFAULT 0" },
    { name: "color", def: "TEXT" },
  ]);

  await ensureColumns(db, "parte_materiales", [
    { name: "sort_order", def: "INTEGER DEFAULT 0" },
    { name: "nombre_material", def: "TEXT" },
    { name: "unidad", def: "TEXT DEFAULT 'unidad'" },
    { name: "precio_coste", def: "REAL DEFAULT 0" },
  ]);

  await ensureColumns(db, "company_settings", [
    { name: "trade_name", def: "TEXT" },
    { name: "legal_name", def: "TEXT" },
    { name: "owner_name", def: "TEXT" },
    { name: "nif", def: "TEXT" },
    { name: "address_line1", def: "TEXT" },
    { name: "address_line2", def: "TEXT" },
    { name: "phone", def: "TEXT" },
    { name: "email", def: "TEXT" },
    { name: "iban", def: "TEXT" },
    { name: "bank_name", def: "TEXT" },
    { name: "invoice_series_prefix", def: "TEXT DEFAULT 'FAC-'" },
    { name: "budget_series_prefix", def: "TEXT DEFAULT 'PRES-'" },
    { name: "work_order_series_prefix", def: "TEXT DEFAULT 'PT-'" },
    { name: "default_tax_rate", def: "REAL DEFAULT 21" },
    { name: "theme_color", def: "TEXT DEFAULT '#2563eb'" },
    { name: "fiscal_territory", def: "TEXT NOT NULL DEFAULT 'common'" },
    { name: "updated_at", def: "TEXT" },
  ]);

  await ensureColumns(db, "feedback_submissions", [
    { name: "type", def: "TEXT NOT NULL DEFAULT 'sugerencia'" },
    { name: "subject", def: "TEXT NOT NULL DEFAULT ''" },
    { name: "message", def: "TEXT NOT NULL DEFAULT ''" },
    { name: "email", def: "TEXT" },
    { name: "status", def: "TEXT DEFAULT 'recibido'" },
    { name: "created_at", def: "TEXT" },
  ]);

  await ensureColumns(db, "suppliers", [
    { name: "nif", def: "TEXT" },
    { name: "email", def: "TEXT" },
    { name: "phone", def: "TEXT" },
    { name: "address", def: "TEXT" },
    { name: "city", def: "TEXT" },
    { name: "province", def: "TEXT" },
    { name: "notes", def: "TEXT" },
    { name: "created_at", def: "TEXT" },
  ]);

  await ensureColumns(db, "expenses", [
    { name: "supplier_id", def: "TEXT" },
    { name: "supplier_name", def: "TEXT" },
    { name: "invoice_number", def: "TEXT" },
    { name: "date", def: "TEXT" },
    { name: "due_date", def: "TEXT" },
    { name: "status", def: "TEXT DEFAULT 'pending'" },
    { name: "subtotal", def: "REAL DEFAULT 0" },
    { name: "tax_rate", def: "REAL DEFAULT 21" },
    { name: "tax_amount", def: "REAL DEFAULT 0" },
    { name: "total", def: "REAL DEFAULT 0" },
    { name: "notes", def: "TEXT" },
    { name: "obra", def: "TEXT" },
    { name: "albaran", def: "TEXT" },
    { name: "created_at", def: "TEXT" },
  ]);

  await ensureColumns(db, "expense_items", [
    { name: "article_code", def: "TEXT" },
    { name: "discount", def: "REAL DEFAULT 0" },
    { name: "sort_order", def: "INTEGER DEFAULT 0" },
  ]);

  await db.execute(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_source_part_id_unique ON invoices(source_part_id) WHERE source_part_id IS NOT NULL;"
  );

  // Migración de budgets.client_id NOT NULL → nullable (BUD-SINCLIENTE-001):
  // En bases NUEVAS, CREATE TABLE ya define client_id TEXT (nullable).
  // En bases EXISTENTES con client_id NOT NULL, ejecutar manualmente:
  //   npx tsx scripts/migrate-budgets-client-nullable.ts --url "file:electricista.db" --yes
  // No se ejecuta automáticamente en arranque para evitar riesgos en producción.
}

export async function initializeDatabase(client?: Client): Promise<void> {
  const db = client || getDbClient();

  try {
    await db.execute("PRAGMA journal_mode = WAL;");
    await db.execute("PRAGMA busy_timeout = 5000;");
  } catch {
    // Ignorar si el driver remoto no soporta PRAGMA
  }

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
      source_part_id TEXT,
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

    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      source TEXT,
      interest TEXT,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'nuevo',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS opportunities (
      id TEXT PRIMARY KEY,
      client_id TEXT,
      lead_id TEXT,
      title TEXT NOT NULL,
      stage TEXT NOT NULL DEFAULT 'nuevo',
      estimated_value REAL DEFAULT 0,
      source TEXT,
      next_action TEXT,
      next_action_at TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (lead_id) REFERENCES leads(id)
    );

    CREATE TABLE IF NOT EXISTS crm_activities (
      id TEXT PRIMARY KEY,
      client_id TEXT,
      opportunity_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      related_type TEXT,
      related_id TEXT,
      occurred_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS crm_tasks (
      id TEXT PRIMARY KEY,
      client_id TEXT,
      opportunity_id TEXT,
      title TEXT NOT NULL,
      due_at TEXT,
      priority TEXT NOT NULL DEFAULT 'normal',
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities(stage);
    CREATE INDEX IF NOT EXISTS idx_opportunities_client ON opportunities(client_id);
    CREATE INDEX IF NOT EXISTS idx_opportunities_next_action ON opportunities(next_action_at);
    CREATE INDEX IF NOT EXISTS idx_crm_activities_client ON crm_activities(client_id, occurred_at);
    CREATE INDEX IF NOT EXISTS idx_crm_activities_opportunity ON crm_activities(opportunity_id, occurred_at);
    CREATE INDEX IF NOT EXISTS idx_crm_tasks_due ON crm_tasks(status, due_at);
    CREATE INDEX IF NOT EXISTS idx_crm_tasks_client ON crm_tasks(client_id);
    CREATE INDEX IF NOT EXISTS idx_crm_tasks_opportunity ON crm_tasks(opportunity_id);

    CREATE TABLE IF NOT EXISTS partes_trabajo (
      id TEXT PRIMARY KEY,
      numero TEXT NOT NULL UNIQUE,
      fecha TEXT NOT NULL,
      tecnico TEXT,
      hora_inicio TEXT,
      hora_fin TEXT,
      cliente TEXT NOT NULL,
      client_id TEXT,
      direccion TEXT,
      telefono TEXT,
      persona_contacto TEXT,
      observaciones TEXT,
      estado TEXT NOT NULL DEFAULT 'borrador',
      iva_rate REAL DEFAULT 21,
      descuento REAL DEFAULT 0,
      budget_id TEXT,
      visit_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (budget_id) REFERENCES budgets(id),
      FOREIGN KEY (visit_id) REFERENCES visits(id)
    );

    CREATE TABLE IF NOT EXISTS parte_trabajo_lineas (
      id TEXT PRIMARY KEY,
      parte_id TEXT NOT NULL,
      nombre_trabajo TEXT,
      hora TEXT,
      descripcion TEXT NOT NULL,
      cantidad REAL DEFAULT 1,
      unidad TEXT DEFAULT 'unidad',
      precio_unitario REAL DEFAULT 0,
      estado TEXT DEFAULT 'completado',
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (parte_id) REFERENCES partes_trabajo(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS parte_materiales (
      id TEXT PRIMARY KEY,
      parte_id TEXT NOT NULL,
      nombre_material TEXT,
      referencia TEXT,
      descripcion TEXT NOT NULL,
      cantidad REAL DEFAULT 1,
      unidad TEXT DEFAULT 'unidad',
      precio_coste REAL DEFAULT 0,
      precio_unitario REAL DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (parte_id) REFERENCES partes_trabajo(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS company_settings (
      id TEXT PRIMARY KEY,
      trade_name TEXT,
      legal_name TEXT,
      owner_name TEXT,
      nif TEXT,
      address_line1 TEXT,
      address_line2 TEXT,
      phone TEXT,
      email TEXT,
      iban TEXT,
      bank_name TEXT,
      invoice_series_prefix TEXT DEFAULT 'FAC-',
      budget_series_prefix TEXT DEFAULT 'PRES-',
      work_order_series_prefix TEXT DEFAULT 'PT-',
      default_tax_rate REAL DEFAULT 21,
      theme_color TEXT DEFAULT '#2563eb',
      fiscal_territory TEXT NOT NULL DEFAULT 'common',
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS feedback_submissions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      email TEXT,
      status TEXT NOT NULL DEFAULT 'recibido',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      nif TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      city TEXT,
      province TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      supplier_id TEXT,
      supplier_name TEXT,
      invoice_number TEXT,
      date TEXT NOT NULL,
      due_date TEXT,
      status TEXT DEFAULT 'pending',
      subtotal REAL DEFAULT 0,
      tax_rate REAL DEFAULT 21,
      tax_amount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      notes TEXT,
      obra TEXT,
      albaran TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS expense_items (
      id TEXT PRIMARY KEY,
      expense_id TEXT NOT NULL,
      article_code TEXT,
      description TEXT NOT NULL,
      quantity REAL DEFAULT 1,
      unit_price REAL NOT NULL,
      discount REAL DEFAULT 0,
      total REAL NOT NULL,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE
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

export async function generateInvoiceNumber(executor?: SqlExecutor): Promise<string> {
  const db = executor || getDbClient();
  const result = await db.execute({
    sql: "SELECT number FROM invoices WHERE number LIKE 'DFB_%' ORDER BY number DESC LIMIT 1",
    args: [],
  });

  if (result.rows.length === 0) {
    return "DFB_0001";
  }

  const lastNum = parseInt(String(result.rows[0].number || "").replace("DFB_", ""), 10);
  if (isNaN(lastNum)) {
    return "DFB_0001";
  }
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

export async function generateParteNumber(): Promise<string> {
  const db = getDbClient();
  const year = new Date().getFullYear();
  const result = await db.execute({
    sql: "SELECT numero FROM partes_trabajo WHERE numero LIKE ? ORDER BY created_at DESC LIMIT 1",
    args: [`PT-${year}-%`],
  });

  if (result.rows.length === 0) {
    return `PT-${year}-001`;
  }

  const lastNum = parseInt((result.rows[0].numero as string).split("-").pop() || "0", 10);
  return `PT-${year}-${String(lastNum + 1).padStart(3, "0")}`;
}
