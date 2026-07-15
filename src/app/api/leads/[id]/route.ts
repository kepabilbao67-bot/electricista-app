import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";

const VALID_STATUSES = ["nuevo", "contactado", "cualificado", "convertido", "descartado"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const { id } = await params;
    const body = await request.json();

    if (!body.status || !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: `Estado no valido. Permitidos: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    // Check if lead exists
    const existing = await db.execute({
      sql: "SELECT id FROM leads WHERE id = ?",
      args: [id],
    });

    if (existing.rows.length === 0) {
      return NextResponse.json(
        { error: "Lead no encontrado" },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();

    await db.execute({
      sql: "UPDATE leads SET status = ?, updated_at = ? WHERE id = ?",
      args: [body.status, now, id],
    });

    const result = await db.execute({
      sql: "SELECT * FROM leads WHERE id = ?",
      args: [id],
    });

    return NextResponse.json(result.rows[0]);
  } catch {
    return NextResponse.json(
      { error: "Error al actualizar lead" },
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
    await db.execute({ sql: "DELETE FROM leads WHERE id = ?", args: [id] });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Error al eliminar lead" },
      { status: 500 }
    );
  }
}
