import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const visit = db
      .prepare(
        `SELECT visits.*, clients.name as client_name 
         FROM visits 
         LEFT JOIN clients ON visits.client_id = clients.id 
         WHERE visits.id = ?`
      )
      .get(id);

    if (!visit) {
      return NextResponse.json(
        { error: "Visita no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(visit);
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
    const db = getDb();
    const body = await request.json();

    db.prepare(
      `UPDATE visits SET title = ?, description = ?, date = ?, time = ?, duration = ?, status = ?, address = ?, notes = ?, client_id = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      body.title,
      body.description || null,
      body.date,
      body.time || null,
      body.duration || 60,
      body.status || "scheduled",
      body.address || null,
      body.notes || null,
      body.client_id || null,
      id
    );

    const visit = db.prepare("SELECT * FROM visits WHERE id = ?").get(id);
    return NextResponse.json(visit);
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
    const db = getDb();
    db.prepare("DELETE FROM visits WHERE id = ?").run(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Error al eliminar visita" },
      { status: 500 }
    );
  }
}
