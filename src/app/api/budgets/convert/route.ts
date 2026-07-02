import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase, generateInvoiceNumber } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const body = await request.json();
    const budgetId = body.budget_id;

    const budgetResult = await db.execute({
      sql: "SELECT * FROM budgets WHERE id = ?",
      args: [budgetId],
    });

    if (budgetResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Presupuesto no encontrado" },
        { status: 404 }
      );
    }

    const budget = budgetResult.rows[0];

    if (budget.converted_invoice_id) {
      return NextResponse.json(
        { error: "Este presupuesto ya fue convertido a factura" },
        { status: 400 }
      );
    }

    const budgetItemsResult = await db.execute({
      sql: "SELECT * FROM budget_items WHERE budget_id = ? ORDER BY sort_order",
      args: [budgetId],
    });

    const invoiceId = uuidv4();
    const invoiceNumber = await generateInvoiceNumber();

    await db.execute({
      sql: `INSERT INTO invoices (id, number, client_id, date, status, subtotal, tax_rate, tax_amount, total, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        invoiceId,
        invoiceNumber,
        budget.client_id,
        new Date().toISOString().split("T")[0],
        "draft",
        budget.subtotal,
        budget.tax_rate,
        budget.tax_amount,
        budget.total,
        budget.notes,
      ],
    });

    for (const item of budgetItemsResult.rows) {
      await db.execute({
        sql: `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          uuidv4(),
          invoiceId,
          item.description,
          item.quantity,
          item.unit_price,
          item.total,
          item.sort_order,
        ],
      });
    }

    await db.execute({
      sql: "UPDATE budgets SET status = 'accepted', converted_invoice_id = ?, updated_at = datetime('now') WHERE id = ?",
      args: [invoiceId, budgetId],
    });

    const result = await db.execute({
      sql: "SELECT * FROM invoices WHERE id = ?",
      args: [invoiceId],
    });
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Error al convertir presupuesto a factura" },
      { status: 500 }
    );
  }
}
