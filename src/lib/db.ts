import { createClient, Client } from "@libsql/client";

let client: Client;

export function getDbClient(): Client {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL || "file:electricista.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
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
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      number TEXT NOT NULL UNIQUE,
      client_id TEXT NOT NULL,
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

  // Seed catalog items if empty
  const result = await db.execute("SELECT COUNT(*) as count FROM catalog_items");
  const count = result.rows[0].count as number;

  if (count === 0) {
    const catalogItems = [
      ["cat_01", "Cableado estructural", 150, "Instalacion"],
      ["cat_02", "Cuadro electrico empotrar pladur", 130, "Cuadros"],
      ["cat_03", "Magnetotermico general 2x25", 45.5, "Proteccion"],
      ["cat_04", "Diferencial 2x40", 39.25, "Proteccion"],
      ["cat_05", "Magnetotermico 2x16", 36.5, "Proteccion"],
      ["cat_06", "Magnetotermico 2x10", 34.5, "Proteccion"],
      ["cat_07", "Rotulacion cuadro", 50, "Cuadros"],
      ["cat_08", "Linea alumbrado 3x1.5", 20, "Lineas"],
      ["cat_09", "Linea fuerza 3x2.5", 20, "Lineas"],
      ["cat_10", "Enchufes Niessen Zenit blanca", 25, "Mecanismos"],
      ["cat_11", "Interruptores Niessen Zenit", 20, "Mecanismos"],
      ["cat_12", "Material conexionado", 65, "Material"],
      ["cat_13", "Apuntamiento proyectores", 800, "Instalacion"],
    ];

    for (const item of catalogItems) {
      await db.execute({
        sql: "INSERT INTO catalog_items (id, name, unit_price, category) VALUES (?, ?, ?, ?)",
        args: [item[0], item[1], item[2], item[3]],
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
