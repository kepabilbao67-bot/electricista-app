import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { SOKOEL_CATALOG, SOKOEL_PRICE_DATE, SOKOEL_SOURCE_DOCUMENT, SOKOEL_SUPPLIER } from "@/lib/sokoel-catalog";

function catalogId(reference: string): string {
  return `sokoel:${reference}`;
}

export async function GET() {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const existing = await db.execute(
      "SELECT id, unit_price FROM catalog_items WHERE id LIKE 'sokoel:%'"
    );
    const salePrices = new Map(
      existing.rows.map((row) => [String(row.id), Number(row.unit_price)])
    );

    return NextResponse.json(
      SOKOEL_CATALOG.map((item) => ({
        ...item,
        supplier: SOKOEL_SUPPLIER,
        priceDate: SOKOEL_PRICE_DATE,
        sourceDocument: SOKOEL_SOURCE_DOCUMENT,
        catalogId: catalogId(item.supplierReference),
        imported: salePrices.has(catalogId(item.supplierReference)),
        salePrice: salePrices.get(catalogId(item.supplierReference)) ?? null,
      }))
    );
  } catch {
    return NextResponse.json(
      { error: "Error al obtener el catálogo SOKOEL" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supplierReference = String(body.supplierReference || "").trim();
    const unitPrice = Number(body.unit_price);

    if (!supplierReference) {
      return NextResponse.json({ error: "Falta la referencia SOKOEL" }, { status: 400 });
    }
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return NextResponse.json(
        { error: "El precio de venta debe ser mayor que 0" },
        { status: 400 }
      );
    }

    const sourceItem = SOKOEL_CATALOG.find(
      (item) => item.supplierReference === supplierReference
    );
    if (!sourceItem) {
      return NextResponse.json({ error: "Referencia SOKOEL no encontrada" }, { status: 404 });
    }

    await initializeDatabase();
    const db = getDbClient();
    const id = catalogId(sourceItem.supplierReference);
    const description = `${SOKOEL_SUPPLIER} · Ref. ${sourceItem.supplierReference} · ${SOKOEL_SOURCE_DOCUMENT} · ${SOKOEL_PRICE_DATE}`;

    await db.execute({
      sql: `INSERT INTO catalog_items (id, name, description, unit_price, cost_price, category)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              description = excluded.description,
              unit_price = excluded.unit_price,
              cost_price = excluded.cost_price,
              category = excluded.category`,
      args: [
        id,
        sourceItem.description,
        description,
        unitPrice,
        sourceItem.costPrice,
        "SOKOEL",
      ],
    });

    const result = await db.execute({
      sql: "SELECT * FROM catalog_items WHERE id = ?",
      args: [id],
    });

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Error al guardar el producto SOKOEL en el catálogo" },
      { status: 500 }
    );
  }
}
