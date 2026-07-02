import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  try {
    const db = getDb();
    const items = db
      .prepare("SELECT * FROM catalog_items ORDER BY category, name")
      .all();
    return NextResponse.json(items);
  } catch {
    return NextResponse.json(
      { error: "Error al obtener catalogo" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const id = uuidv4();

    db.prepare(
      `INSERT INTO catalog_items (id, name, description, unit_price, category)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, body.name, body.description || null, body.unit_price, body.category || null);

    const item = db.prepare("SELECT * FROM catalog_items WHERE id = ?").get(id);
    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Error al crear item de catalogo" },
      { status: 500 }
    );
  }
}
