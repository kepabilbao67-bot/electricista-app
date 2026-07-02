import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(id);

    if (!client) {
      return NextResponse.json(
        { error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(client);
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
    const db = getDb();
    const body = await request.json();

    db.prepare(
      `UPDATE clients SET name = ?, nif = ?, email = ?, phone = ?, address = ?, city = ?, postal_code = ?, province = ?, notes = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      body.name,
      body.nif || null,
      body.email || null,
      body.phone || null,
      body.address || null,
      body.city || null,
      body.postal_code || null,
      body.province || null,
      body.notes || null,
      id
    );

    const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(id);
    return NextResponse.json(client);
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
    const db = getDb();
    db.prepare("DELETE FROM clients WHERE id = ?").run(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Error al eliminar cliente" },
      { status: 500 }
    );
  }
}
