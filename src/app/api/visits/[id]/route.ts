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
    const result = await db.execute({
      sql: `SELECT visits.*, clients.name as client_name 
         FROM visits 
         LEFT JOIN clients ON visits.client_id = clients.id 
         WHERE visits.id = ?`,
      args: [id],
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Visita no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch {
    return NextResponse.json(
      { error: "Error al obtener visita" },
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

    await db.execute({
      sql: `UPDATE visits SET title = ?, description = ?, date = ?, time = ?, duration = ?, status = ?, address = ?, notes = ?, client_id = ?, updated_at = datetime('now')
       WHERE id = ?`,
      args: [
        body.title,
        body.description || null,
        body.date,
        body.time || null,
        body.duration || 60,
        body.status || "scheduled",
        body.address || null,
        body.notes || null,
        body.client_id || null,
        id,
      ],
    });

    const result = await db.execute({
      sql: "SELECT * FROM visits WHERE id = ?",
      args: [id],
    });
    return NextResponse.json(result.rows[0]);
  } catch {
    return NextResponse.json(
      { error: "Error al actualizar visita" },
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
    await db.execute({ sql: "DELETE FROM visits WHERE id = ?", args: [id] });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Error al eliminar visita" },
      { status: 500 }
    );
  }
}
