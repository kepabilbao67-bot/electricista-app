import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";

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
         clients.postal_code as client_postal_code, clients.province as client_province
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

    if (body.status) {
      await db.execute({
        sql: "UPDATE budgets SET status = ?, updated_at = datetime('now') WHERE id = ?",
        args: [body.status, id],
      });
    }

    const result = await db.execute({
      sql: "SELECT * FROM budgets WHERE id = ?",
      args: [id],
    });
    return NextResponse.json(result.rows[0]);
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
