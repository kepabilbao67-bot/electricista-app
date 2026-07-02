import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const budget = db
      .prepare(
        `SELECT budgets.*, clients.name as client_name, clients.nif as client_nif,
         clients.address as client_address, clients.city as client_city,
         clients.postal_code as client_postal_code, clients.province as client_province
         FROM budgets 
         LEFT JOIN clients ON budgets.client_id = clients.id 
         WHERE budgets.id = ?`
      )
      .get(id);

    if (!budget) {
      return NextResponse.json(
        { error: "Presupuesto no encontrado" },
        { status: 404 }
      );
    }

    const items = db
      .prepare(
        "SELECT * FROM budget_items WHERE budget_id = ? ORDER BY sort_order"
      )
      .all(id);

    return NextResponse.json({ ...budget, items });
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
    const db = getDb();
    const body = await request.json();

    if (body.status) {
      db.prepare(
        "UPDATE budgets SET status = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(body.status, id);
    }

    const budget = db.prepare("SELECT * FROM budgets WHERE id = ?").get(id);
    return NextResponse.json(budget);
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
    const db = getDb();
    db.prepare("DELETE FROM budget_items WHERE budget_id = ?").run(id);
    db.prepare("DELETE FROM budgets WHERE id = ?").run(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Error al eliminar presupuesto" },
      { status: 500 }
    );
  }
}
