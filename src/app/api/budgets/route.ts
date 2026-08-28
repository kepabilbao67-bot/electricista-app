import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase, generateBudgetNumber } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { budgetSchema } from "@/lib/validations/budget-schema";

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const clientId = searchParams.get("client_id");

    let query = `
      SELECT budgets.*, clients.name as client_name 
      FROM budgets 
      LEFT JOIN clients ON budgets.client_id = clients.id
    `;
    const conditions: string[] = [];
    const args: string[] = [];

    if (status) {
      conditions.push("budgets.status = ?");
      args.push(status);
    }
    if (clientId) {
      conditions.push("budgets.client_id = ?");
      args.push(clientId);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY budgets.date DESC";

    const result = await db.execute({ sql: query, args });
    return NextResponse.json(result.rows);
  } catch {
    return NextResponse.json(
      { error: "Error al obtener presupuestos" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const validationResult = budgetSchema.safeParse(rawBody);

    if (!validationResult.success) {
      const errorMessages = validationResult.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ");
      return NextResponse.json(
        {
          error: "Datos de presupuesto inválidos",
          details: errorMessages,
          issues: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;
    await initializeDatabase();
    const db = getDbClient();
    const id = uuidv4();
    const number = await generateBudgetNumber();

    const subtotal = data.items.reduce(
      (acc: number, item: { quantity: number; unit_price: number }) =>
        acc + item.quantity * item.unit_price,
      0
    );
    const taxRate = data.tax_rate ?? 21;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    await db.execute({
      sql: `INSERT INTO budgets (id, number, client_id, date, valid_until, status, subtotal, tax_rate, tax_amount, total, notes, notes_color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        number,
        data.client_id,
        data.date || new Date().toISOString().split("T")[0],
        data.valid_until || null,
        data.status || "draft",
        subtotal,
        taxRate,
        taxAmount,
        total,
        data.notes || null,
        data.notes_color || null,
      ],
    });

    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      await db.execute({
        sql: `INSERT INTO budget_items (id, budget_id, description, quantity, unit_price, total, sort_order)
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
      sql: "SELECT * FROM budgets WHERE id = ?",
      args: [id],
    });
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Error al crear presupuesto" },
      { status: 500 }
    );
  }
}
