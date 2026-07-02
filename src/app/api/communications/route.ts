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
        sql: `SELECT communications.*, clients.name as client_name 
              FROM communications 
              LEFT JOIN clients ON communications.client_id = clients.id
              WHERE communications.client_id = ?
              ORDER BY communications.created_at DESC`,
        args: [clientId],
      });
    } else {
      result = await db.execute(
        `SELECT communications.*, clients.name as client_name 
         FROM communications 
         LEFT JOIN clients ON communications.client_id = clients.id
         ORDER BY communications.created_at DESC`
      );
    }

    return NextResponse.json(result.rows);
  } catch {
    return NextResponse.json(
      { error: "Error al obtener comunicaciones" },
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
      sql: `INSERT INTO communications (id, client_id, type, subject, message, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        body.client_id,
        body.type,
        body.subject || null,
        body.message,
        body.status || "sent",
      ],
    });

    const result = await db.execute({
      sql: "SELECT * FROM communications WHERE id = ?",
      args: [id],
    });
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Error al crear comunicacion" },
      { status: 500 }
    );
  }
}
