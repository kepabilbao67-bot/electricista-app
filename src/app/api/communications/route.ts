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

    const allowedStatuses = ["draft", "prepared", "opened_external", "follow_up_logged"];
    const status = allowedStatuses.includes(body.status) ? body.status : "prepared";
    await db.batch([
      {
        sql: `INSERT INTO communications (id, client_id, type, subject, message, status, subject_color, message_color)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [id, body.client_id, body.type, body.subject || null, body.message, status,
          body.subject_color || null, body.message_color || null],
      },
      {
        sql: `INSERT INTO crm_activities
              (id, client_id, type, title, description, related_type, related_id)
              VALUES (?, ?, 'communication_prepared', 'Comunicación preparada', ?, 'communication', ?)`,
        args: [uuidv4(), body.client_id, `${body.type}: ${body.subject || "sin asunto"}`, id],
      },
    ], "write");

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
