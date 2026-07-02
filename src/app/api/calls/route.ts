import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get("client_id");

    let result;
    if (clientId) {
      result = await db.execute({
        sql: "SELECT * FROM calls WHERE client_id = ? ORDER BY created_at DESC",
        args: [clientId],
      });
    } else {
      result = await db.execute("SELECT * FROM calls ORDER BY created_at DESC");
    }

    return NextResponse.json(result.rows);
  } catch {
    return NextResponse.json(
      { error: "Error al obtener llamadas" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const body = await request.json();
    const id = uuidv4();

    await db.execute({
      sql: `INSERT INTO calls (id, client_id, client_name, phone, direction, duration, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        body.client_id || null,
        body.client_name || null,
        body.phone || null,
        body.direction || "incoming",
        body.duration || null,
        body.notes || null,
      ],
    });

    const result = await db.execute({
      sql: "SELECT * FROM calls WHERE id = ?",
      args: [id],
    });
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Error al registrar llamada" },
      { status: 500 }
    );
  }
}
