import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await initializeDatabase();
    const db = getDbClient();
    const budgetResult = await db.execute({
      sql: `SELECT budgets.*, clients.name as client_name, clients.nif as client_nif,
         clients.address as client_address, clients.city as client_city,
         clients.postal_code as client_postal_code, clients.province as client_province,
         clients.email as client_email
         FROM budgets 
         LEFT JOIN clients ON budgets.client_id = clients.id 
         WHERE budgets.id = ?`,
      args: [id],
    });

    if (budgetResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Presupuesto no encontrado" },
        { status: 404 }
      );
    }

    const itemsResult = await db.execute({
      sql: "SELECT * FROM budget_items WHERE budget_id = ? ORDER BY sort_order",
      args: [id],
    });

    return NextResponse.json({ ...budgetResult.rows[0], items: itemsResult.rows });
  } catch {
    return NextResponse.json(
      { error: "Error al obtener presupuesto" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await initializeDatabase();
    const db = getDbClient();
    const body = await request.json();

    // Si solo cambia el status
    if (body.status && !body.items) {
      await db.execute({
        sql: "UPDATE budgets SET status = ?, updated_at = datetime('now') WHERE id = ?",
        args: [body.status, id],
      });
      const result = await db.execute({
        sql: "SELECT * FROM budgets WHERE id = ?",
        args: [id],
      });
      return NextResponse.json(result.rows[0]);
    }

    // Edición completa del presupuesto (con items)
    if (body.items) {
      const subtotal = body.items.reduce(
        (acc: number, item: { quantity: number; unit_price: number }) =>
          acc + item.quantity * item.unit_price,
        0
      );
      const taxRate = body.tax_rate ?? 21;
      const taxAmount = subtotal * (taxRate / 100);
      const total = subtotal + taxAmount;

      // Actualizar datos del presupuesto
      await db.execute({
        sql: `UPDATE budgets SET 
          client_id = ?, date = ?, valid_until = ?, notes = ?,
          subtotal = ?, tax_rate = ?, tax_amount = ?, total = ?,
          updated_at = datetime('now')
          WHERE id = ?`,
        args: [
          body.client_id,
          body.date,
          body.valid_until || null,
          body.notes || null,
          subtotal,
          taxRate,
          taxAmount,
          total,
          id,
        ],
      });

      // Eliminar items antiguos y crear nuevos
      await db.execute({
        sql: "DELETE FROM budget_items WHERE budget_id = ?",
        args: [id],
      });

      for (let i = 0; i < body.items.length; i++) {
        const item = body.items[i];
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
      return NextResponse.json(result.rows[0]);
    }

    return NextResponse.json({ error: "No se han proporcionado datos para actualizar" }, { status: 400 });
  } catch {
    return NextResponse.json(
      { error: "Error al actualizar presupuesto" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await initializeDatabase();
    const db = getDbClient();
    await db.execute({ sql: "DELETE FROM budget_items WHERE budget_id = ?", args: [id] });
    await db.execute({ sql: "DELETE FROM budgets WHERE id = ?", args: [id] });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Error al eliminar presupuesto" },
      { status: 500 }
    );
  }
}
