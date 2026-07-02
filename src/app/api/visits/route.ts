import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get("client_id");
    const status = searchParams.get("status");

    let query = `
      SELECT visits.*, clients.name as client_name 
      FROM visits 
      LEFT JOIN clients ON visits.client_id = clients.id
    `;
    const conditions: string[] = [];
    const args: string[] = [];

    if (clientId) {
      conditions.push("visits.client_id = ?");
      args.push(clientId);
    }
    if (status) {
      conditions.push("visits.status = ?");
      args.push(status);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY visits.date ASC, visits.time ASC";

    const result = await db.execute({ sql: query, args });
    return NextResponse.json(result.rows);
  } catch {
    return NextResponse.json(
      { error: "Error al obtener visitas" },
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
      sql: `INSERT INTO visits (id, client_id, title, description, date, time, duration, status, address, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        body.client_id || null,
        body.title,
        body.description || null,
        body.date,
        body.time || null,
        body.duration || 60,
        body.status || "scheduled",
        body.address || null,
        body.notes || null,
      ],
    });

    const result = await db.execute({
      sql: "SELECT * FROM visits WHERE id = ?",
      args: [id],
    });
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Error al crear visita" },
      { status: 500 }
    );
  }
}
