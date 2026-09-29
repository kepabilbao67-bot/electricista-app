import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { parseConseguidos, parseFaltantes } from "@/lib/faltantes-parser";

const InputSchema = z.object({
  input: z.string().trim().min(2).max(4000),
  parte_id: z.string().trim().min(1).nullable().optional(),
});

const PatchSchema = z.object({
  item_id: z.string().trim().min(1),
  status: z.enum(["pendiente", "conseguido"]),
});

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/^(?:los|las|el|la|unos|unas)\s+/i, "")
    .replace(/[\s,.;:-]+$/g, "")
    .trim();
}

async function listItems(parteId?: string | null) {
  await initializeDatabase();
  const db = getDbClient();
  const conditions = ["po.source = 'missing_work'"];
  const args: string[] = [];

  if (parteId) {
    conditions.push("po.parte_id = ?");
    args.push(parteId);
  }

  const result = await db.execute({
    sql: `
      SELECT
        poi.id,
        poi.order_id,
        poi.product,
        poi.quantity,
        poi.unit,
        COALESCE(poi.status, 'pendiente') AS status,
        po.parte_id,
        po.original_text,
        po.created_at,
        pt.numero AS parte_numero,
        pt.cliente AS parte_cliente
      FROM purchase_order_items poi
      INNER JOIN purchase_orders po ON po.id = poi.order_id
      LEFT JOIN partes_trabajo pt ON pt.id = po.parte_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY po.created_at DESC, poi.sort_order ASC
    `,
    args,
  });

  return result.rows.map((row) => ({
    id: String(row.id),
    order_id: String(row.order_id),
    product: String(row.product),
    quantity: Number(row.quantity),
    unit: String(row.unit || "ud"),
    status: String(row.status || "pendiente"),
    parte_id: row.parte_id ? String(row.parte_id) : null,
    original_text: row.original_text ? String(row.original_text) : "",
    created_at: row.created_at ? String(row.created_at) : "",
    parte_numero: row.parte_numero ? String(row.parte_numero) : "",
    parte_cliente: row.parte_cliente ? String(row.parte_cliente) : "",
  }));
}

export async function GET(request: NextRequest) {
  try {
    const parteId = request.nextUrl.searchParams.get("parte_id");
    const items = await listItems(parteId);
    return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error listando faltantes de obra", error);
    return NextResponse.json({ error: "No se pudieron cargar los faltantes" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = InputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Orden de voz no válida" }, { status: 400 });
    }

    const input = parsed.data.input.trim();
    const parteId = parsed.data.parte_id || null;
    if (!parteId) {
      return NextResponse.json(
        { error: "Selecciona primero la obra o parte de trabajo" },
        { status: 400 }
      );
    }

    const normalizedInput = normalize(input);
    const isQuery = /^(?:que|qué)\s+me\s+falta\b|(?:que|qué)\s+me\s+falta\s+para\s+(?:esta|este)\s+(?:obra|trabajo)/i.test(normalizedInput);
    const isMarkDone = /^(?:ya\s+tengo|ya\s+he\s+conseguido|marca\s+como\s+conseguido)/i.test(normalizedInput);

    await initializeDatabase();
    const db = getDbClient();

    if (isQuery) {
      const items = (await listItems(parteId)).filter((item) => item.status === "pendiente");
      const answer = items.length
        ? `Te falta: ${items.map((item) => `${item.quantity} ${item.unit} de ${item.product.toLocaleLowerCase("es")}`).join(", ")}.`
        : "No tienes materiales pendientes para esta obra.";
      return NextResponse.json({ action: "query", answer, items });
    }

    if (isMarkDone) {
      const requested = parseConseguidos(input).map(normalize);
      const current = (await listItems(parteId)).filter((item) => item.status === "pendiente");
      const matches = current.filter((item) => requested.includes(normalize(item.product)));

      if (matches.length === 0) {
        return NextResponse.json(
          { error: "No he encontrado esos materiales entre los pendientes de esta obra" },
          { status: 422 }
        );
      }

      await db.batch(
        matches.map((item) => ({
          sql: "UPDATE purchase_order_items SET status = 'conseguido', updated_at = ? WHERE id = ?",
          args: [new Date().toISOString(), item.id],
        })),
        "write"
      );

      const items = await listItems(parteId);
      return NextResponse.json({
        action: "mark_acquired",
        answer: `Marcado como conseguido: ${matches.map((item) => item.product).join(", ")}.`,
        items,
      });
    }

    const items = parseFaltantes(input);
    const orderId = uuidv4();
    const now = new Date().toISOString();

    const statements = [
      {
        sql: `INSERT INTO purchase_orders
          (id, parte_id, source, original_text, status, created_at, updated_at)
          VALUES (?, ?, 'missing_work', ?, 'confirmed', ?, ?)`,
        args: [orderId, parteId, input, now, now],
      },
      ...items.map((item, index) => ({
        sql: `INSERT INTO purchase_order_items
          (id, order_id, status, product, quantity, unit, observations, sort_order, created_at, updated_at)
          VALUES (?, ?, 'pendiente', ?, ?, ?, NULL, ?, ?, ?)`,
        args: [uuidv4(), orderId, item.product, item.quantity, item.unit, index, now, now],
      })),
    ];

    await db.batch(statements, "write");
    const saved = await listItems(parteId);

    return NextResponse.json(
      {
        action: "add",
        answer: `Apuntado: ${items.map((item) => `${item.quantity} ${item.unit} de ${item.product.toLocaleLowerCase("es")}`).join(", ")}.`,
        items: saved,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo procesar la orden";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const parsed = PatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Cambio no válido" }, { status: 400 });
    }

    await initializeDatabase();
    const db = getDbClient();
    await db.execute({
      sql: "UPDATE purchase_order_items SET status = ?, updated_at = ? WHERE id = ?",
      args: [parsed.data.status, new Date().toISOString(), parsed.data.item_id],
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error actualizando faltante", error);
    return NextResponse.json({ error: "No se pudo actualizar el material" }, { status: 500 });
  }
}
