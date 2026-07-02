import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase, generateInvoiceNumber } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const clientId = searchParams.get("client_id");

    let query = `
      SELECT invoices.*, clients.name as client_name 
      FROM invoices 
      LEFT JOIN clients ON invoices.client_id = clients.id
    `;
    const conditions: string[] = [];
    const args: string[] = [];

    if (status) {
      conditions.push("invoices.status = ?");
      args.push(status);
    }
    if (clientId) {
      conditions.push("invoices.client_id = ?");
      args.push(clientId);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY invoices.date DESC";

    const result = await db.execute({ sql: query, args });
    return NextResponse.json(result.rows);
  } catch {
    return NextResponse.json(
      { error: "Error al obtener facturas" },
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
    const number = await generateInvoiceNumber();

    const subtotal = body.items.reduce(
      (acc: number, item: { quantity: number; unit_price: number }) =>
        acc + item.quantity * item.unit_price,
      0
    );
    const taxRate = body.tax_rate ?? 21;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    await db.execute({
      sql: `INSERT INTO invoices (id, number, client_id, date, due_date, status, subtotal, tax_rate, tax_amount, total, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        number,
        body.client_id,
        body.date || new Date().toISOString().split("T")[0],
        body.due_date || null,
        body.status || "draft",
        subtotal,
        taxRate,
        taxAmount,
        total,
        body.notes || null,
      ],
    });

    for (let i = 0; i < body.items.length; i++) {
      const item = body.items[i];
      await db.execute({
        sql: `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          uuidv4(),
          id,
          item.description,
          item.quantity,
          item.unit_price,
          item.quantity * item.unit_price,
          i,
        ],
      });
    }

    const result = await db.execute({
      sql: "SELECT * FROM invoices WHERE id = ?",
      args: [id],
    });
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Error al crear factura" },
      { status: 500 }
    );
  }
}
