import { NextRequest, NextResponse } from "next/server";
import { getDb, generateBudgetNumber } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const clientId = searchParams.get("client_id");

    let query = `
      SELECT budgets.*, clients.name as client_name 
      FROM budgets 
      LEFT JOIN clients ON budgets.client_id = clients.id
    `;
    const conditions: string[] = [];
    const params: string[] = [];

    if (status) {
      conditions.push("budgets.status = ?");
      params.push(status);
    }
    if (clientId) {
      conditions.push("budgets.client_id = ?");
      params.push(clientId);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY budgets.date DESC";

    const budgets = db.prepare(query).all(...params);
    return NextResponse.json(budgets);
  } catch {
    return NextResponse.json(
      { error: "Error al obtener presupuestos" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const id = uuidv4();
    const number = generateBudgetNumber();

    const subtotal = body.items.reduce(
      (acc: number, item: { quantity: number; unit_price: number }) =>
        acc + item.quantity * item.unit_price,
      0
    );
    const taxRate = body.tax_rate ?? 21;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    db.prepare(
      `INSERT INTO budgets (id, number, client_id, date, valid_until, status, subtotal, tax_rate, tax_amount, total, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      number,
      body.client_id,
      body.date || new Date().toISOString().split("T")[0],
      body.valid_until || null,
      body.status || "draft",
      subtotal,
      taxRate,
      taxAmount,
      total,
      body.notes || null
    );

    const insertItem = db.prepare(
      `INSERT INTO budget_items (id, budget_id, description, quantity, unit_price, total, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    for (let i = 0; i < body.items.length; i++) {
      const item = body.items[i];
      insertItem.run(
        uuidv4(),
        id,
        item.description,
        item.quantity,
        item.unit_price,
        item.quantity * item.unit_price,
        i
      );
    }

    const budget = db.prepare("SELECT * FROM budgets WHERE id = ?").get(id);
    return NextResponse.json(budget, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Error al crear presupuesto" },
      { status: 500 }
    );
  }
}
