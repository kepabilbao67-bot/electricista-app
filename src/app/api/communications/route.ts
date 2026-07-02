import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get("client_id");

    let query = `
      SELECT communications.*, clients.name as client_name 
      FROM communications 
      LEFT JOIN clients ON communications.client_id = clients.id
    `;

    if (clientId) {
      query += " WHERE communications.client_id = ?";
      const comms = db.prepare(query + " ORDER BY communications.created_at DESC").all(clientId);
      return NextResponse.json(comms);
    }

    const comms = db.prepare(query + " ORDER BY communications.created_at DESC").all();
    return NextResponse.json(comms);
  } catch {
    return NextResponse.json(
      { error: "Error al obtener comunicaciones" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const id = uuidv4();

    db.prepare(
      `INSERT INTO communications (id, client_id, type, subject, message, status)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      body.client_id,
      body.type,
      body.subject || null,
      body.message,
      body.status || "sent"
    );

    const comm = db.prepare("SELECT * FROM communications WHERE id = ?").get(id);
    return NextResponse.json(comm, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Error al crear comunicacion" },
      { status: 500 }
    );
  }
}
