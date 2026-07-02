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
      sql: "SELECT * FROM clients WHERE id = ?",
      args: [id],
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch {
    return NextResponse.json(
      { error: "Error al obtener cliente" },
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
      sql: `UPDATE clients SET name = ?, nif = ?, email = ?, phone = ?, address = ?, city = ?, postal_code = ?, province = ?, notes = ?, client_type = ?, updated_at = datetime('now')
       WHERE id = ?`,
      args: [
        body.name,
        body.nif || null,
        body.email || null,
        body.phone || null,
        body.address || null,
        body.city || null,
        body.postal_code || null,
        body.province || null,
        body.notes || null,
        body.client_type || "particular",
        id,
      ],
    });

    const result = await db.execute({
      sql: "SELECT * FROM clients WHERE id = ?",
      args: [id],
    });
    return NextResponse.json(result.rows[0]);
  } catch {
    return NextResponse.json(
      { error: "Error al actualizar cliente" },
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
    await db.execute({ sql: "DELETE FROM clients WHERE id = ?", args: [id] });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Error al eliminar cliente" },
      { status: 500 }
    );
  }
}
