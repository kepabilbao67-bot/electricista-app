import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { isCrmStage, STAGE_PROBABILITIES } from "@/lib/crm";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    if (!body.title?.trim() || !isCrmStage(body.stage)) {
      return NextResponse.json(
        { error: "Título o etapa no válidos" },
        { status: 400 }
      );
    }
    await initializeDatabase();
    const db = getDbClient();
    const current = await db.execute({
      sql: "SELECT * FROM opportunities WHERE id = ?",
      args: [id],
    });
    if (!current.rows.length) {
      return NextResponse.json(
        { error: "Oportunidad no encontrada" },
        { status: 404 }
      );
    }
    const previousStage = String(current.rows[0].stage);
    const probability =
      typeof body.probability === "number"
        ? body.probability
        : STAGE_PROBABILITIES[body.stage as keyof typeof STAGE_PROBABILITIES] ?? 10;

    const statements = [
      {
        sql: `UPDATE opportunities SET
              client_id = ?,
              title = ?,
              stage = ?,
              estimated_value = ?,
              probability = ?,
              assigned_to = ?,
              source = ?,
              next_action = ?,
              next_action_at = ?,
              notes = ?,
              updated_at = datetime('now')
              WHERE id = ?`,
        args: [
          body.client_id || null,
          body.title.trim(),
          body.stage,
          Number(body.estimated_value) || 0,
          probability,
          body.assigned_to || body.responsable || "Pedro",
          body.source || null,
          body.next_action || null,
          body.next_action_at || null,
          body.notes || null,
          id,
        ],
      },
    ];

    if (previousStage !== body.stage) {
      statements.push({
        sql: `INSERT INTO crm_activities
              (id, client_id, opportunity_id, type, title, description)
              VALUES (?, ?, ?, 'stage_changed', 'Etapa actualizada', ?)`,
        args: [
          uuidv4(),
          body.client_id || null,
          id,
          `${previousStage} → ${body.stage}`,
        ],
      });
    }

    await db.batch(statements, "write");
    const result = await db.execute({
      sql: "SELECT * FROM opportunities WHERE id = ?",
      args: [id],
    });
    return NextResponse.json(result.rows[0]);
  } catch {
    return NextResponse.json(
      { error: "Error al actualizar oportunidad" },
      { status: 500 }
    );
  }
}

// V1: el borrado físico de oportunidades está deshabilitado para proteger el historial.
export async function DELETE(
  _request: NextRequest,
  _context: { params: Promise<{ id: string }> }
) {
  return NextResponse.json(
    {
      error:
        "El borrado de oportunidades está deshabilitado para proteger el historial. Cambia su estado a 'perdido' o 'no_interesado'.",
    },
    { status: 409 }
  );
}
