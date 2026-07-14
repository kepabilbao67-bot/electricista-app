import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  try {
    await initializeDatabase();
    const db = getDbClient();

    const result = await db.execute(
      "SELECT * FROM leads ORDER BY created_at DESC"
    );

    return NextResponse.json(result.rows);
  } catch {
    return NextResponse.json(
      { error: "Error al obtener leads" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const body = await request.json();

    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { error: "El nombre es obligatorio" },
        { status: 400 }
      );
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO leads (id, name, email, phone, source, interest, message, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'nuevo', ?, ?)`,
      args: [
        id,
        body.name.trim(),
        body.email || null,
        body.phone || null,
        body.source || null,
        body.interest || null,
        body.message || null,
        now,
        now,
      ],
    });

    const result = await db.execute({
      sql: "SELECT * FROM leads WHERE id = ?",
      args: [id],
    });

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Error al crear lead" },
      { status: 500 }
    );
  }
}
