import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  try {
    await initializeDatabase();
    const db = getDbClient();
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

    await db.execute({
      sql: `INSERT INTO catalog_items (id, name, description, unit_price, category)
       VALUES (?, ?, ?, ?, ?)`,
      args: [id, body.name, body.description || null, body.unit_price, body.category || null],
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
