import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { getDbClient, initializeDatabase } from "@/lib/db";

const OrderSchema = z.object({
  originalText: z.string().trim().min(1).max(4000),
  neededDate: z.string().date().nullable(),
  observations: z.string().trim().max(2000).default(""),
  items: z.array(z.object({
    product: z.string().trim().min(1).max(500),
    quantity: z.number().positive().max(1_000_000),
    unit: z.string().trim().min(1).max(40),
    observations: z.string().trim().max(1000).default(""),
  })).min(1).max(100),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = OrderSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Revisa los datos del pedido" }, { status: 400 });
    }

    await initializeDatabase();
    const db = getDbClient();
    const orderId = uuidv4();
    const statements = [
      {
        sql: `INSERT INTO purchase_orders (id, source, original_text, needed_date, observations, status)
              VALUES (?, 'voice', ?, ?, ?, 'confirmed')`,
        args: [orderId, parsed.data.originalText, parsed.data.neededDate, parsed.data.observations || null],
      },
      ...parsed.data.items.map((item, index) => ({
        sql: `INSERT INTO purchase_order_items
              (id, order_id, product, quantity, unit, observations, sort_order)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [uuidv4(), orderId, item.product, item.quantity, item.unit, item.observations || null, index],
      })),
    ];

    await db.batch(statements, "write");
    return NextResponse.json({ id: orderId, status: "confirmed" }, { status: 201 });
  } catch (error) {
    console.error("Error al guardar pedido por voz", error);
    return NextResponse.json({ error: "No se pudo guardar el pedido" }, { status: 500 });
  }
}
