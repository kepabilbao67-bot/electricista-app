import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase, generateInvoiceNumber } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import type { Transaction } from "@libsql/client";

/**
 * AUTÓNOMO360 — Conversión Atómica de Presupuesto a Factura
 *
 * Realiza la conversión bajo una transacción de escritura interactiva con rollback:
 * 1. Verifica estado no convertido y carga presupuesto.
 * 2. Carga y valida líneas de presupuesto.
 * 3. Genera correlativo de factura secuencial seguro.
 * 4. Inserta cabecera y líneas en la misma transacción.
 * 5. Actualiza presupuesto a 'accepted' con converted_invoice_id.
 */
export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const body = await request.json();
    const budgetId = body.budget_id;

    if (!budgetId) {
      return NextResponse.json(
        { error: "Se requiere budget_id para la conversión." },
        { status: 400 }
      );
    }

    let tx: Transaction | null = null;

    try {
      tx = await db.transaction("write");

      const budgetResult = await tx.execute({
        sql: "SELECT * FROM budgets WHERE id = ?",
        args: [budgetId],
      });

      if (budgetResult.rows.length === 0) {
        await tx.rollback();
        return NextResponse.json(
          { error: "Presupuesto no encontrado" },
          { status: 404 }
        );
      }

      const budget = budgetResult.rows[0];

      if (budget.converted_invoice_id) {
        await tx.rollback();
        return NextResponse.json(
          { error: "Este presupuesto ya fue convertido a factura previamente" },
          { status: 400 }
        );
      }

      if (!budget.client_id) {
        await tx.rollback();
        return NextResponse.json(
          { error: "El presupuesto no tiene un cliente asignado válido para facturación." },
          { status: 422 }
        );
      }

      const budgetItemsResult = await tx.execute({
        sql: "SELECT * FROM budget_items WHERE budget_id = ? ORDER BY sort_order ASC",
        args: [budgetId],
      });

      const invoiceId = uuidv4();
      const invoiceNumber = await generateInvoiceNumber(tx);
      const today = new Date().toISOString().split("T")[0];
      const now = new Date().toISOString();

      const subtotal = Number(budget.subtotal || 0);
      const taxRate = typeof budget.tax_rate === "number" ? budget.tax_rate : 21;
      const taxAmount = Number(budget.tax_amount || 0);
      const total = Number(budget.total || (subtotal + taxAmount));

      await tx.execute({
        sql: `INSERT INTO invoices (
          id, number, client_id, date, due_date, status, subtotal, tax_rate, tax_amount, total, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          invoiceId,
          invoiceNumber,
          budget.client_id,
          today,
          null,
          "draft",
          subtotal,
          taxRate,
          taxAmount,
          total,
          budget.notes || `Factura generada desde presupuesto ${budget.number}`,
          now,
          now,
        ],
      });

      let sortOrder = 0;
      for (const item of budgetItemsResult.rows) {
        await tx.execute({
          sql: `INSERT INTO invoice_items (
            id, invoice_id, description, quantity, unit_price, total, discount, discount_type, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            uuidv4(),
            invoiceId,
            item.description,
            item.quantity,
            item.unit_price,
            item.total,
            Number(item.discount || 0),
            String(item.discount_type || "percent"),
            sortOrder++,
          ],
        });
      }

      await tx.execute({
        sql: "UPDATE budgets SET status = 'accepted', converted_invoice_id = ?, updated_at = ? WHERE id = ?",
        args: [invoiceId, now, budgetId],
      });

      const createdInvoice = await tx.execute({
        sql: "SELECT * FROM invoices WHERE id = ?",
        args: [invoiceId],
      });

      await tx.commit();

      return NextResponse.json(createdInvoice.rows[0], { status: 201 });
    } catch (txError) {
      if (tx) {
        try {
          await tx.rollback();
        } catch {
          // Ya revertido
        }
      }
      throw txError;
    }
  } catch (error) {
    console.error("Error al convertir presupuesto a factura:", error);
    return NextResponse.json(
      { error: "Error al convertir presupuesto a factura de forma atómica" },
      { status: 500 }
    );
  }
}
