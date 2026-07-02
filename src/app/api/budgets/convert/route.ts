import { NextRequest, NextResponse } from "next/server";
import { getDb, generateInvoiceNumber } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const budgetId = body.budget_id;

    // Get budget data
    const budget = db
      .prepare("SELECT * FROM budgets WHERE id = ?")
      .get(budgetId) as Record<string, unknown> | undefined;

    if (!budget) {
      return NextResponse.json(
        { error: "Presupuesto no encontrado" },
        { status: 404 }
      );
    }

    if (budget.converted_invoice_id) {
      return NextResponse.json(
        { error: "Este presupuesto ya fue convertido a factura" },
        { status: 400 }
      );
    }

    const budgetItems = db
      .prepare("SELECT * FROM budget_items WHERE budget_id = ? ORDER BY sort_order")
      .all(budgetId) as Array<Record<string, unknown>>;

    // Create invoice
    const invoiceId = uuidv4();
    const invoiceNumber = generateInvoiceNumber();

    db.prepare(
      `INSERT INTO invoices (id, number, client_id, date, status, subtotal, tax_rate, tax_amount, total, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      invoiceId,
      invoiceNumber,
      budget.client_id,
      new Date().toISOString().split("T")[0],
      "draft",
      budget.subtotal,
      budget.tax_rate,
      budget.tax_amount,
      budget.total,
      budget.notes
    );

    // Copy items
    const insertItem = db.prepare(
      `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    for (const item of budgetItems) {
      insertItem.run(
        uuidv4(),
        invoiceId,
        item.description,
        item.quantity,
        item.unit_price,
        item.total,
        item.sort_order
      );
    }

    // Update budget status
    db.prepare(
      "UPDATE budgets SET status = 'accepted', converted_invoice_id = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(invoiceId, budgetId);

    const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoiceId);
    return NextResponse.json(invoice, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Error al convertir presupuesto a factura" },
      { status: 500 }
    );
  }
}
