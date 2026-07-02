import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get("client_id");
    const status = searchParams.get("status");

    let query = `
      SELECT visits.*, clients.name as client_name 
      FROM visits 
      LEFT JOIN clients ON visits.client_id = clients.id
    `;
    const conditions: string[] = [];
    const params: string[] = [];

    if (clientId) {
      conditions.push("visits.client_id = ?");
      params.push(clientId);
    }
    if (status) {
      conditions.push("visits.status = ?");
      params.push(status);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY visits.date ASC, visits.time ASC";

    const visits = db.prepare(query).all(...params);
    return NextResponse.json(visits);
  } catch {
    return NextResponse.json(
      { error: "Error al obtener visitas" },
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
      `INSERT INTO visits (id, client_id, title, description, date, time, duration, status, address, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      body.client_id || null,
      body.title,
      body.description || null,
      body.date,
      body.time || null,
      body.duration || 60,
      body.status || "scheduled",
      body.address || null,
      body.notes || null
    );

    const visit = db.prepare("SELECT * FROM visits WHERE id = ?").get(id);
    return NextResponse.json(visit, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Error al crear visita" },
      { status: 500 }
    );
  }
}
