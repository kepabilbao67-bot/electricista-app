import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";

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
        sql: "UPDATE expenses SET status = ? WHERE id = ?",
        args: [body.status, id],
      });
    }

    const result = await db.execute({ sql: "SELECT * FROM expenses WHERE id = ?", args: [id] });
    return NextResponse.json(result.rows[0]);
  } catch {
    return NextResponse.json({ error: "Error al actualizar gasto" }, { status: 500 });
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
    await db.execute({ sql: "DELETE FROM expenses WHERE id = ?", args: [id] });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Error al eliminar gasto" },
      { status: 500 }
    );
  }
}
