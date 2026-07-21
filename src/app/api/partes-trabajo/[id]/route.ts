import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { validatePartePayload, safeNum } from "@/lib/validate-parte";
import { v4 as uuidv4 } from "uuid";

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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const { id } = await params;
    const body = await request.json();

    // Check existence
    const check = await db.execute({
      sql: "SELECT id FROM partes_trabajo WHERE id = ?",
      args: [id],
    });

    if (check.rows.length === 0) {
      return NextResponse.json(
        { error: "Parte de trabajo no encontrado" },
        { status: 404 }
      );
    }

    // Validate
    const validationError = validatePartePayload(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const now = new Date().toISOString();
    const statements: { sql: string; args: (string | number | null)[] }[] = [];

    // 1. Update header
    statements.push({
      sql: `UPDATE partes_trabajo SET
        fecha = ?, tecnico = ?, hora_inicio = ?, hora_fin = ?,
        cliente = ?, client_id = ?, direccion = ?, telefono = ?,
        persona_contacto = ?, observaciones = ?, estado = ?,
        iva_rate = ?, descuento = ?, budget_id = ?, visit_id = ?, updated_at = ?
        WHERE id = ?`,
      args: [
        body.fecha,
        body.tecnico || null,
        body.horaInicio || null,
        body.horaFin || null,
        body.cliente.trim(),
        body.client_id || null,
        body.direccion || null,
        body.telefono || null,
        body.personaContacto || null,
        body.observaciones || null,
        body.estado || "borrador",
        body.iva_rate !== undefined && body.iva_rate !== null ? safeNum(body.iva_rate) : 21,
        safeNum(body.descuento),
        body.budget_id || null,
        body.visit_id || null,
        now,
        id,
      ],
    });

    // 2. Delete existing lines (replace strategy)
    statements.push({
      sql: "DELETE FROM parte_trabajo_lineas WHERE parte_id = ?",
      args: [id],
    });
    statements.push({
      sql: "DELETE FROM parte_materiales WHERE parte_id = ?",
      args: [id],
    });

    // 3. Re-insert trabajo lines
    if (Array.isArray(body.trabajos)) {
      for (let i = 0; i < body.trabajos.length; i++) {
        const t = body.trabajos[i];
        if (!t.descripcion?.trim() && !t.nombre_trabajo?.trim()) continue;
        statements.push({
          sql: `INSERT INTO parte_trabajo_lineas (id, parte_id, nombre_trabajo, hora, descripcion, cantidad, unidad, precio_unitario, estado, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            uuidv4(),
            id,
            t.nombre_trabajo || null,
            t.hora || null,
            (t.descripcion || "").trim(),
            safeNum(t.cantidad),
            t.unidad || "unidad",
            safeNum(t.precio_unitario),
            t.estado || "completado",
            i,
          ],
        });
      }
    }

    // 4. Re-insert material lines
    if (Array.isArray(body.materiales)) {
      for (let i = 0; i < body.materiales.length; i++) {
        const m = body.materiales[i];
        if (!m.descripcion?.trim() && !m.nombre_material?.trim()) continue;
        statements.push({
          sql: `INSERT INTO parte_materiales (id, parte_id, nombre_material, referencia, descripcion, cantidad, unidad, precio_coste, precio_unitario, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            uuidv4(),
            id,
            m.nombre_material || null,
            m.referencia || null,
            (m.descripcion || "").trim(),
            safeNum(m.cantidad),
            m.unidad || "unidad",
            safeNum(m.precio_coste),
            safeNum(m.precio_unitario),
            i,
          ],
        });
      }
    }

    // Execute atomically
    await db.batch(statements, "write");

    // Return updated parte
    const result = await db.execute({
      sql: "SELECT * FROM partes_trabajo WHERE id = ?",
      args: [id],
    });

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error("Error al actualizar parte de trabajo:", err);
    return NextResponse.json(
      { error: "Error al actualizar el parte de trabajo" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const { id } = await params;

    const check = await db.execute({
      sql: "SELECT id FROM partes_trabajo WHERE id = ?",
      args: [id],
    });

    if (check.rows.length === 0) {
      return NextResponse.json(
        { error: "Parte de trabajo no encontrado" },
        { status: 404 }
      );
    }

    await db.batch(
      [
        { sql: "DELETE FROM parte_trabajo_lineas WHERE parte_id = ?", args: [id] },
        { sql: "DELETE FROM parte_materiales WHERE parte_id = ?", args: [id] },
        { sql: "DELETE FROM partes_trabajo WHERE id = ?", args: [id] },
      ],
      "write"
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Error al eliminar el parte de trabajo" },
      { status: 500 }
    );
  }
}
