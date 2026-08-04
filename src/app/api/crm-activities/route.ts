import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getDbClient, initializeDatabase } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const clientId = request.nextUrl.searchParams.get("client_id");
    const opportunityId = request.nextUrl.searchParams.get("opportunity_id");
    const conditions: string[] = [];
    const args: string[] = [];
    if (clientId) { conditions.push("a.client_id = ?"); args.push(clientId); }
    if (opportunityId) { conditions.push("a.opportunity_id = ?"); args.push(opportunityId); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await db.execute({
      sql: `SELECT a.*, c.name AS client_name, o.title AS opportunity_title
            FROM crm_activities a
            LEFT JOIN clients c ON c.id = a.client_id
            LEFT JOIN opportunities o ON o.id = a.opportunity_id
            ${where} ORDER BY a.occurred_at DESC LIMIT 200`,
      args,
    });
    return NextResponse.json(result.rows);
  } catch {
    return NextResponse.json({ error: "Error al obtener actividad" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.type?.trim() || !body.title?.trim()) {
      return NextResponse.json({ error: "Tipo y titulo son obligatorios" }, { status: 400 });
    }
    await initializeDatabase();
    const db = getDbClient();
    const id = uuidv4();
    await db.execute({
      sql: `INSERT INTO crm_activities
            (id, client_id, opportunity_id, type, title, description, related_type, related_id, occurred_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`,
      args: [id, body.client_id || null, body.opportunity_id || null, body.type.trim(), body.title.trim(),
        body.description || null, body.related_type || null, body.related_id || null, body.occurred_at || null],
    });
    const result = await db.execute({ sql: "SELECT * FROM crm_activities WHERE id = ?", args: [id] });
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error al registrar actividad" }, { status: 500 });
  }
}
