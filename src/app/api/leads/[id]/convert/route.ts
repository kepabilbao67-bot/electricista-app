import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getDbClient, initializeDatabase } from "@/lib/db";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: leadId } = await params;
    const body = await request.json().catch(() => ({}));
    await initializeDatabase();
    const db = getDbClient();
    const leadResult = await db.execute({ sql: "SELECT * FROM leads WHERE id = ?", args: [leadId] });
    if (!leadResult.rows.length) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
    const lead = leadResult.rows[0];
    // Proteccion contra doble conversion: valida para el modelo de un solo usuario actual.
    // Antes de habilitar concurrencia multiusuario, ejecutar una migracion que anade
    // UNIQUE(lead_id) en la tabla opportunities para garantizar atomicidad en BD.
    const existing = await db.execute({ sql: "SELECT id FROM opportunities WHERE lead_id = ?", args: [leadId] });
    if (existing.rows.length) return NextResponse.json({ error: "El lead ya fue convertido" }, { status: 409 });
    const clientId = uuidv4();
    const opportunityId = uuidv4();
    await db.batch([
      {
        sql: `INSERT INTO clients (id, name, email, phone, notes, client_type)
              VALUES (?, ?, ?, ?, ?, 'particular')`,
        args: [clientId, lead.name, lead.email || null, lead.phone || null, lead.message || null],
      },
      {
        sql: `INSERT INTO opportunities
              (id, client_id, lead_id, title, stage, estimated_value, source, next_action, next_action_at, notes)
              VALUES (?, ?, ?, ?, 'contactado', ?, ?, ?, ?, ?)`,
        args: [opportunityId, clientId, leadId, body.title || lead.interest || `Oportunidad de ${String(lead.name)}`,
          Number(body.estimated_value) || 0, lead.source || null, body.next_action || "Contactar y cualificar",
          body.next_action_at || null, lead.message || null],
      },
      { sql: "UPDATE leads SET status = 'convertido', updated_at = datetime('now') WHERE id = ?", args: [leadId] },
      {
        sql: `INSERT INTO crm_activities
              (id, client_id, opportunity_id, type, title, description, related_type, related_id)
              VALUES (?, ?, ?, 'lead_converted', 'Lead convertido', ?, 'lead', ?)`,
        args: [uuidv4(), clientId, opportunityId, String(lead.name), leadId],
      },
    ], "write");
    return NextResponse.json({ client_id: clientId, opportunity_id: opportunityId }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error al convertir el lead" }, { status: 500 });
  }
}
