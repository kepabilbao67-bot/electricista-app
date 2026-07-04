import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  try {
    await initializeDatabase();
    const db = getDbClient();

    // Add cost_price column if it doesn't exist
    try {
      await db.execute("ALTER TABLE catalog_items ADD COLUMN cost_price REAL DEFAULT 0");
    } catch {
      // Column already exists, ignore
    }

    const result = await db.execute(
      "SELECT * FROM catalog_items ORDER BY category, name"
    );
    return NextResponse.json(result.rows);
  } catch {
    return NextResponse.json(
      { error: "Error al obtener catalogo" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const body = await request.json();
    const id = uuidv4();

    // Ensure column exists
    try {
      await db.execute("ALTER TABLE catalog_items ADD COLUMN cost_price REAL DEFAULT 0");
    } catch { /* ignore */ }

    await db.execute({
      sql: `INSERT INTO catalog_items (id, name, description, unit_price, cost_price, category)
       VALUES (?, ?, ?, ?, ?, ?)`,
      args: [id, body.name, body.description || null, body.unit_price, body.cost_price || 0, body.category || null],
    });

    const result = await db.execute({
      sql: "SELECT * FROM catalog_items WHERE id = ?",
      args: [id],
    });
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Error al crear item de catalogo" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const body = await request.json();

    // Ensure column exists
    try {
      await db.execute("ALTER TABLE catalog_items ADD COLUMN cost_price REAL DEFAULT 0");
    } catch { /* ignore */ }

    await db.execute({
      sql: `UPDATE catalog_items SET name = ?, description = ?, unit_price = ?, cost_price = ?, category = ? WHERE id = ?`,
      args: [body.name, body.description || null, body.unit_price, body.cost_price || 0, body.category || null, body.id],
    });

    const result = await db.execute({
      sql: "SELECT * FROM catalog_items WHERE id = ?",
      args: [body.id],
    });
    return NextResponse.json(result.rows[0]);
  } catch {
    return NextResponse.json(
      { error: "Error al actualizar item" },
      { status: 500 }
    );
  }
}
