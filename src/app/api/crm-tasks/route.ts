import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getDbClient, initializeDatabase } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const clientId = request.nextUrl.searchParams.get("client_id");
    const status = request.nextUrl.searchParams.get("status");
    const conditions: string[] = [];
    const args: string[] = [];
    if (clientId) { conditions.push("t.client_id = ?"); args.push(clientId); }
    if (status) { conditions.push("t.status = ?"); args.push(status); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await db.execute({
      sql: `SELECT t.*, c.name AS client_name, o.title AS opportunity_title
            FROM crm_tasks t LEFT JOIN clients c ON c.id = t.client_id
            LEFT JOIN opportunities o ON o.id = t.opportunity_id
            ${where} ORDER BY CASE WHEN t.due_at IS NULL THEN 1 ELSE 0 END, t.due_at ASC`,
      args,
    });
    return NextResponse.json(result.rows);
  } catch {
    return NextResponse.json({ error: "Error al obtener tareas" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.title?.trim()) return NextResponse.json({ error: "El titulo es obligatorio" }, { status: 400 });
    await initializeDatabase();
    const db = getDbClient();
    const id = uuidv4();
    await db.execute({
      sql: `INSERT INTO crm_tasks
            (id, client_id, opportunity_id, title, due_at, priority, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      args: [id, body.client_id || null, body.opportunity_id || null, body.title.trim(), body.due_at || null,
        ["low", "normal", "high"].includes(body.priority) ? body.priority : "normal", body.notes || null],
    });
    const result = await db.execute({ sql: "SELECT * FROM crm_tasks WHERE id = ?", args: [id] });
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error al crear tarea" }, { status: 500 });
  }
}
