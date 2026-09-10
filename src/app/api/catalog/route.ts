import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

function parseMoney(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validateCatalogPrice(unitPrice: number | null) {
  if (unitPrice === null || unitPrice <= 0) {
    return "El precio de venta del catálogo debe ser mayor que 0. Un precio pendiente no se guarda como 0 €";
  }
  return null;
}

function validateCostPrice(costPrice: number | null) {
  if (costPrice === null || costPrice < 0) return "El precio de compra no puede ser negativo";
  return null;
}

export async function GET() {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const result = await db.execute("SELECT * FROM catalog_items ORDER BY category, name");
    return NextResponse.json(result.rows);
  } catch {
    return NextResponse.json({ error: "Error al obtener catalogo" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const body = await request.json();
    const name = String(body.name || "").trim();
    const unitPrice = parseMoney(body.unit_price);
    const costPrice = parseMoney(body.cost_price ?? 0);

    if (!name) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    const priceError = validateCatalogPrice(unitPrice);
    if (priceError) return NextResponse.json({ error: priceError }, { status: 400 });
    const costError = validateCostPrice(costPrice);
    if (costError) return NextResponse.json({ error: costError }, { status: 400 });

    const id = uuidv4();
    await db.execute({
      sql: `INSERT INTO catalog_items (id, name, description, unit_price, cost_price, category, name_color, description_color, category_color)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        name,
        body.description || null,
        unitPrice!,
        costPrice!,
        body.category || null,
        body.name_color || null,
        body.description_color || null,
        body.category_color || null,
      ],
    });

    const result = await db.execute({ sql: "SELECT * FROM catalog_items WHERE id = ?", args: [id] });
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error al crear item de catalogo" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const body = await request.json();
    const id = String(body.id || "").trim();

    if (!id) return NextResponse.json({ error: "Falta id del item" }, { status: 400 });

    // Compatibilidad temporal con la UI antigua: el sentinel de borrado sí elimina.
    if (body.name === "_DELETE_") {
      const existing = await db.execute({ sql: "SELECT id FROM catalog_items WHERE id = ?", args: [id] });
      if (existing.rows.length === 0) return NextResponse.json({ error: "Item no encontrado" }, { status: 404 });
      await db.execute({ sql: "DELETE FROM catalog_items WHERE id = ?", args: [id] });
      return NextResponse.json({ success: true });
    }

    const name = String(body.name || "").trim();
    const unitPrice = parseMoney(body.unit_price);
    const costPrice = parseMoney(body.cost_price ?? 0);
    if (!name) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    const priceError = validateCatalogPrice(unitPrice);
    if (priceError) return NextResponse.json({ error: priceError }, { status: 400 });
    const costError = validateCostPrice(costPrice);
    if (costError) return NextResponse.json({ error: costError }, { status: 400 });

    const existing = await db.execute({ sql: "SELECT id FROM catalog_items WHERE id = ?", args: [id] });
    if (existing.rows.length === 0) return NextResponse.json({ error: "Item no encontrado" }, { status: 404 });

    await db.execute({
      sql: `UPDATE catalog_items
            SET name = ?, description = ?, unit_price = ?, cost_price = ?, category = ?, name_color = ?, description_color = ?, category_color = ?
            WHERE id = ?`,
      args: [
        name,
        body.description || null,
        unitPrice!,
        costPrice!,
        body.category || null,
        body.name_color || null,
        body.description_color || null,
        body.category_color || null,
        id,
      ],
    });

    const result = await db.execute({ sql: "SELECT * FROM catalog_items WHERE id = ?", args: [id] });
    return NextResponse.json(result.rows[0]);
  } catch {
    return NextResponse.json({ error: "Error al actualizar item" }, { status: 500 });
  }
}
