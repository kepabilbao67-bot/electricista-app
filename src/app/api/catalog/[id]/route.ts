import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";

function parseMoney(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await initializeDatabase();
    const db = getDbClient();
    const result = await db.execute({ sql: "SELECT * FROM catalog_items WHERE id = ?", args: [id] });
    if (result.rows.length === 0) return NextResponse.json({ error: "Item no encontrado" }, { status: 404 });
    return NextResponse.json(result.rows[0]);
  } catch {
    return NextResponse.json({ error: "Error al obtener item" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await initializeDatabase();
    const db = getDbClient();
    const body = await request.json();
    const name = String(body.name || "").trim();
    const unitPrice = parseMoney(body.unit_price);

    if (!name) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    if (unitPrice === null || unitPrice <= 0) {
      return NextResponse.json(
        { error: "El precio de venta del catálogo debe ser mayor que 0. Un precio pendiente no se guarda como 0 €" },
        { status: 400 }
      );
    }

    const existing = await db.execute({ sql: "SELECT id FROM catalog_items WHERE id = ?", args: [id] });
    if (existing.rows.length === 0) return NextResponse.json({ error: "Item no encontrado" }, { status: 404 });

    await db.execute({
      sql: `UPDATE catalog_items SET name = ?, description = ?, unit_price = ?, category = ? WHERE id = ?`,
      args: [name, body.description || null, unitPrice, body.category || null, id],
    });

    const result = await db.execute({ sql: "SELECT * FROM catalog_items WHERE id = ?", args: [id] });
    return NextResponse.json(result.rows[0]);
  } catch {
    return NextResponse.json({ error: "Error al actualizar item" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await initializeDatabase();
    const db = getDbClient();
    const existing = await db.execute({ sql: "SELECT id FROM catalog_items WHERE id = ?", args: [id] });
    if (existing.rows.length === 0) return NextResponse.json({ error: "Item no encontrado" }, { status: 404 });
    await db.execute({ sql: "DELETE FROM catalog_items WHERE id = ?", args: [id] });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error al eliminar item" }, { status: 500 });
  }
}
