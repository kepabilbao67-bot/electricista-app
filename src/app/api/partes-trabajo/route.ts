import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase, generateParteNumber } from "@/lib/db";
import { validatePartePayload, safeNum } from "@/lib/validate-parte";
import { v4 as uuidv4 } from "uuid";

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get("client_id");
    const estado = searchParams.get("estado");

    let query = "SELECT * FROM partes_trabajo";
    const conditions: string[] = [];
    const args: (string | null)[] = [];

    if (clientId) {
      conditions.push("client_id = ?");
      args.push(clientId);
    }
    if (estado) {
      conditions.push("estado = ?");
      args.push(estado);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY created_at DESC";

    const result = await db.execute({ sql: query, args });
    return NextResponse.json(result.rows);
  } catch {
    return NextResponse.json(
      { error: "Error al obtener partes de trabajo" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const body = await request.json();

    // Shared validation
    const validationError = validatePartePayload(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const id = uuidv4();
    const numero = await generateParteNumber();
    const now = new Date().toISOString();

    const statements: { sql: string; args: (string | number | null)[] }[] = [];

    // 1. Insert header
    statements.push({
      sql: `INSERT INTO partes_trabajo (id, numero, fecha, tecnico, hora_inicio, hora_fin, cliente, client_id, direccion, telefono, persona_contacto, observaciones, estado, iva_rate, descuento, budget_id, visit_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        numero,
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
        now,
      ],
    });

    // 2. Insert trabajo lines
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

    // 3. Insert materials
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

    await db.batch(statements, "write");

    const result = await db.execute({
      sql: "SELECT * FROM partes_trabajo WHERE id = ?",
      args: [id],
    });

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error("Error al crear parte de trabajo:", err);
    return NextResponse.json(
      { error: "Error al guardar el parte de trabajo" },
      { status: 500 }
    );
  }
}
