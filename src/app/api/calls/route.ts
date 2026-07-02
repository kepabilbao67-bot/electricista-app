import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get("client_id");

    let query = "SELECT * FROM calls";
    if (clientId) {
      query += " WHERE client_id = ?";
      const calls = db.prepare(query + " ORDER BY created_at DESC").all(clientId);
      return NextResponse.json(calls);
    }

    const calls = db.prepare(query + " ORDER BY created_at DESC").all();
    return NextResponse.json(calls);
  } catch {
    return NextResponse.json(
      { error: "Error al obtener llamadas" },
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
      `INSERT INTO calls (id, client_id, client_name, phone, direction, duration, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      body.client_id || null,
      body.client_name || null,
      body.phone || null,
      body.direction || "incoming",
      body.duration || null,
      body.notes || null
    );

    const call = db.prepare("SELECT * FROM calls WHERE id = ?").get(id);
    return NextResponse.json(call, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Error al registrar llamada" },
      { status: 500 }
    );
  }
}
