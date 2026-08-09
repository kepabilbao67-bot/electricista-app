import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase, generateBudgetNumber } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

/**
 * POST /api/asistente/confirm-budget
 *
 * Crea un presupuesto REAL en la base de datos.
 * SOLO debe llamarse después de confirmación humana explícita.
 *
 * Reutiliza exactamente la misma lógica de cálculo que POST /api/budgets.
 * Status siempre "draft".
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validar payload mínimo
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: "Se necesita al menos una línea (items)." },
        { status: 400 }
      );
    }

    for (let i = 0; i < body.items.length; i++) {
      const item = body.items[i];
      if (!item.description || typeof item.quantity !== "number" || typeof item.unit_price !== "number") {
        return NextResponse.json(
          { error: `Línea ${i + 1}: datos incompletos (descripción, cantidad, precio obligatorios).` },
          { status: 400 }
        );
      }
      if (item.quantity <= 0) {
        return NextResponse.json(
          { error: `Línea ${i + 1}: cantidad debe ser positiva.` },
          { status: 400 }
        );
      }
      if (item.unit_price < 0) {
        return NextResponse.json(
          { error: `Línea ${i + 1}: precio no puede ser negativo.` },
          { status: 400 }
        );
      }
    }

    await initializeDatabase();
    const db = getDbClient();

    const id = uuidv4();
    const number = await generateBudgetNumber();
    const taxRate = body.tax_rate ?? 21;
    const clientId = body.client_id || null;

    // Validar que el cliente existe si se proporciona
    if (clientId) {
      const clientCheck = await db.execute({
        sql: "SELECT id FROM clients WHERE id = ?",
        args: [clientId],
      });
      if (clientCheck.rows.length === 0) {
        return NextResponse.json(
          { error: "Cliente no encontrado. Verifica el identificador." },
          { status: 400 }
        );
      }
    }

    // Calcular totales (misma lógica que POST /api/budgets, redondeo a 2 decimales)
    const subtotal = Math.round(
      body.items.reduce(
        (acc: number, item: { quantity: number; unit_price: number }) =>
          acc + item.quantity * item.unit_price,
        0
      ) * 100
    ) / 100;
    const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;

    const today = new Date().toISOString().split("T")[0];

    await db.execute({
      sql: `INSERT INTO budgets (id, number, client_id, date, valid_until, status, subtotal, tax_rate, tax_amount, total, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, number, clientId, today, null, "draft", subtotal, taxRate, taxAmount, total, body.notes || null],
    });

    for (let i = 0; i < body.items.length; i++) {
      const item = body.items[i];
      await db.execute({
        sql: `INSERT INTO budget_items (id, budget_id, description, quantity, unit_price, total, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [uuidv4(), id, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price, i],
      });
    }

    return NextResponse.json({ id, number, status: "draft" }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Error al crear el presupuesto." },
      { status: 500 }
    );
  }
}
