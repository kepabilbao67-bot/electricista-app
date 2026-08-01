import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { isCrmStage } from "@/lib/crm";

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const stage = request.nextUrl.searchParams.get("stage");
    const clientId = request.nextUrl.searchParams.get("client_id");
    const search = request.nextUrl.searchParams.get("search");
    const conditions: string[] = [];
    const args: string[] = [];
    if (stage) { conditions.push("o.stage = ?"); args.push(stage); }
    if (clientId) { conditions.push("o.client_id = ?"); args.push(clientId); }
    if (search) {
      conditions.push("(o.title LIKE ? OR c.name LIKE ? OR o.source LIKE ?)");
      args.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await db.execute({
      sql: `SELECT o.*, c.name AS client_name, l.name AS lead_name
            FROM opportunities o
            LEFT JOIN clients c ON c.id = o.client_id
            LEFT JOIN leads l ON l.id = o.lead_id
            ${where}
            ORDER BY CASE WHEN o.next_action_at IS NULL THEN 1 ELSE 0 END,
                     o.next_action_at ASC, o.updated_at DESC`,
      args,
    });
    return NextResponse.json(result.rows);
  } catch {
    return NextResponse.json({ error: "Error al obtener oportunidades" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.title?.trim() || !isCrmStage(body.stage || "nuevo")) {
      return NextResponse.json({ error: "Titulo o etapa no validos" }, { status: 400 });
    }
    await initializeDatabase();
    const db = getDbClient();
    const id = uuidv4();
    const stage = body.stage || "nuevo";
    await db.batch([
      {
        sql: `INSERT INTO opportunities
              (id, client_id, lead_id, title, stage, estimated_value, source, next_action, next_action_at, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [id, body.client_id || null, body.lead_id || null, body.title.trim(), stage,
          Number(body.estimated_value) || 0, body.source || null, body.next_action || null,
          body.next_action_at || null, body.notes || null],
      },
      {
        sql: `INSERT INTO crm_activities
              (id, client_id, opportunity_id, type, title, description)
              VALUES (?, ?, ?, 'opportunity_created', 'Oportunidad creada', ?)`,
        args: [uuidv4(), body.client_id || null, id, body.title.trim()],
      },
    ], "write");
    const result = await db.execute({ sql: "SELECT * FROM opportunities WHERE id = ?", args: [id] });
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error al crear oportunidad" }, { status: 500 });
  }
}
