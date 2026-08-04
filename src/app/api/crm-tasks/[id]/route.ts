import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getDbClient, initializeDatabase } from "@/lib/db";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    if (!["pending", "completed", "cancelled"].includes(body.status)) {
      return NextResponse.json({ error: "Estado no valido" }, { status: 400 });
    }
    await initializeDatabase();
    const db = getDbClient();
    const current = await db.execute({ sql: "SELECT * FROM crm_tasks WHERE id = ?", args: [id] });
    if (!current.rows.length) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    await db.batch([
      {
        sql: `UPDATE crm_tasks SET status = ?, completed_at = CASE WHEN ? = 'completed' THEN datetime('now') ELSE NULL END,
              updated_at = datetime('now') WHERE id = ?`,
        args: [body.status, body.status, id],
      },
      {
        sql: `INSERT INTO crm_activities
              (id, client_id, opportunity_id, type, title, description)
              VALUES (?, ?, ?, 'task_status', 'Tarea actualizada', ?)`,
        args: [uuidv4(), current.rows[0].client_id || null, current.rows[0].opportunity_id || null,
          `${String(current.rows[0].title)}: ${body.status}`],
      },
    ], "write");
    const result = await db.execute({ sql: "SELECT * FROM crm_tasks WHERE id = ?", args: [id] });
    return NextResponse.json(result.rows[0]);
  } catch {
    return NextResponse.json({ error: "Error al actualizar tarea" }, { status: 500 });
  }
}
