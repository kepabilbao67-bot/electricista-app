import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";

const VALID_STATUSES = [
  "borrador",
  "pendiente",
  "en_progreso",
  "completado",
  "TRABAJO_COMPLETADO",
  "facturado",
  "cancelado",
] as const;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const { id } = await params;

    const parteResult = await db.execute({
      sql: "SELECT * FROM partes_trabajo WHERE id = ?",
      args: [id],
    });

    if (parteResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Parte de trabajo no encontrado" },
        { status: 404 }
      );
    }

    const parte = parteResult.rows[0];

    const trabajosResult = await db.execute({
      sql: "SELECT * FROM parte_trabajo_lineas WHERE parte_id = ? ORDER BY sort_order ASC",
      args: [id],
    });

    const materialesResult = await db.execute({
      sql: "SELECT * FROM parte_materiales WHERE parte_id = ? ORDER BY sort_order ASC",
      args: [id],
    });

    return NextResponse.json({
      ...parte,
      trabajos: trabajosResult.rows,
      materiales: materialesResult.rows,
    });
  } catch {
    return NextResponse.json(
      { error: "Error al obtener el parte de trabajo" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const check = await db.execute({
      sql: "SELECT * FROM partes_trabajo WHERE id = ?",
      args: [id],
    });

    if (check.rows.length === 0) {
      return NextResponse.json(
        { error: "Parte de trabajo no encontrado" },
        { status: 404 }
      );
    }

    const status = body?.estado || body?.status;
    if (!status || !VALID_STATUSES.includes(status as any)) {
      return NextResponse.json(
        { error: `Estado inválido. Debe ser uno de: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    await db.execute({
      sql: "UPDATE partes_trabajo SET estado = ?, updated_at = ? WHERE id = ?",
      args: [status, now, id],
    });

    const updated = await db.execute({
      sql: "SELECT * FROM partes_trabajo WHERE id = ?",
      args: [id],
    });

    return NextResponse.json({
      success: true,
      parte: updated.rows[0],
    });
  } catch {
    return NextResponse.json(
      { error: "Error al actualizar el estado del parte de trabajo" },
      { status: 500 }
    );
  }
}
