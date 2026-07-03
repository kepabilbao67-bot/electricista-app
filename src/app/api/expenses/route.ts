import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  try {
    await initializeDatabase();
    const db = getDbClient();

    // Create expenses table if not exists
    await db.executeMultiple(`
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

    const result = await db.execute(
      "SELECT * FROM expenses ORDER BY date DESC"
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error al obtener gastos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();
    const db = getDbClient();

    // Ensure tables exist
    await db.executeMultiple(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, nif TEXT, email TEXT, phone TEXT,
        address TEXT, city TEXT, province TEXT, notes TEXT, created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY, supplier_id TEXT, supplier_name TEXT, invoice_number TEXT,
        date TEXT NOT NULL, due_date TEXT, status TEXT DEFAULT 'pending',
        subtotal REAL DEFAULT 0, tax_rate REAL DEFAULT 21, tax_amount REAL DEFAULT 0,
        total REAL DEFAULT 0, notes TEXT, obra TEXT, albaran TEXT,
        created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
      );
      CREATE TABLE IF NOT EXISTS expense_items (
        id TEXT PRIMARY KEY, expense_id TEXT NOT NULL, article_code TEXT,
        description TEXT NOT NULL, quantity REAL DEFAULT 1, unit_price REAL NOT NULL,
        discount REAL DEFAULT 0, total REAL NOT NULL, sort_order INTEGER DEFAULT 0,
        FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE
      );
    `);

    const body = await request.json();
    const id = uuidv4();

    // Create or find supplier
    let supplierId = body.supplier_id || null;
    if (!supplierId && body.supplier_name) {
      const existing = await db.execute({
        sql: "SELECT id FROM suppliers WHERE LOWER(name) = LOWER(?)",
        args: [body.supplier_name],
      });
      if (existing.rows.length > 0) {
        supplierId = existing.rows[0].id as string;
      } else {
        supplierId = uuidv4();
        await db.execute({
          sql: "INSERT INTO suppliers (id, name, nif) VALUES (?, ?, ?)",
          args: [supplierId, body.supplier_name, body.supplier_nif || null],
        });
      }
    }

    const subtotal = body.items?.reduce(
      (acc: number, item: { quantity: number; unit_price: number; discount?: number }) => {
        const itemTotal = item.quantity * item.unit_price * (1 - (item.discount || 0) / 100);
        return acc + itemTotal;
      },
      0
    ) || body.subtotal || 0;

    const taxRate = body.tax_rate ?? 21;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    await db.execute({
      sql: `INSERT INTO expenses (id, supplier_id, supplier_name, invoice_number, date, due_date, status, subtotal, tax_rate, tax_amount, total, notes, obra, albaran)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id, supplierId, body.supplier_name || null, body.invoice_number || null,
        body.date, body.due_date || null, body.status || "pending",
        subtotal, taxRate, taxAmount, total,
        body.notes || null, body.obra || null, body.albaran || null,
      ],
    });

    if (body.items && body.items.length > 0) {
      for (let i = 0; i < body.items.length; i++) {
        const item = body.items[i];
        const itemTotal = item.quantity * item.unit_price * (1 - (item.discount || 0) / 100);
        await db.execute({
          sql: `INSERT INTO expense_items (id, expense_id, article_code, description, quantity, unit_price, discount, total, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            uuidv4(), id, item.article_code || null, item.description,
            item.quantity, item.unit_price, item.discount || 0, itemTotal, i,
          ],
        });
      }
    }

    const result = await db.execute({ sql: "SELECT * FROM expenses WHERE id = ?", args: [id] });
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error al crear gasto" }, { status: 500 });
  }
}
