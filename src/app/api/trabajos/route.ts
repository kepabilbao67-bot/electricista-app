import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const searchParams = request.nextUrl.searchParams;

    const search = searchParams.get("search")?.trim().toLowerCase() || "";
    const estado = searchParams.get("estado")?.trim() || "";
    const clientId = searchParams.get("client_id")?.trim() || "";
    const desde = searchParams.get("desde")?.trim() || "";
    const hasta = searchParams.get("hasta")?.trim() || "";
    const days = parseInt(searchParams.get("days") || "30", 10);

    // 1. Fetch all work orders with totals
    let query = "SELECT * FROM partes_trabajo";
    const conditions: string[] = [];
    const args: (string | number)[] = [];

    if (clientId) {
      conditions.push("client_id = ?");
      args.push(clientId);
    }

    if (estado && estado !== "todos") {
      if (estado === "completado") {
        conditions.push("estado IN ('completado', 'TRABAJO_COMPLETADO')");
      } else if (estado === "pendiente") {
        conditions.push("estado IN ('borrador', 'pendiente')");
      } else {
        conditions.push("estado = ?");
        args.push(estado);
      }
    }

    if (desde) {
      conditions.push("fecha >= ?");
      args.push(desde);
    }

    if (hasta) {
      conditions.push("fecha <= ?");
      args.push(hasta);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY fecha DESC, created_at DESC";

    const result = await db.execute({ sql: query, args });
    let rows = result.rows;

    if (search) {
      rows = rows.filter((r) => {
        const cliente = String(r.cliente || "").toLowerCase();
        const numero = String(r.numero || "").toLowerCase();
        const direccion = String(r.direccion || "").toLowerCase();
        const observaciones = String(r.observaciones || "").toLowerCase();
        return (
          cliente.includes(search) ||
          numero.includes(search) ||
          direccion.includes(search) ||
          observaciones.includes(search)
        );
      });
    }

    // 2. Global KPIs (sin filtros para contexto operativo)
    const kpiResult = await db.execute(`
      SELECT 
        SUM(CASE WHEN estado IN ('borrador', 'pendiente') THEN 1 ELSE 0 END) as pendientes,
        SUM(CASE WHEN estado = 'en_progreso' THEN 1 ELSE 0 END) as en_progreso,
        SUM(CASE WHEN estado IN ('completado', 'TRABAJO_COMPLETADO') THEN 1 ELSE 0 END) as finalizados_sin_facturar,
        SUM(CASE WHEN estado = 'facturado' THEN 1 ELSE 0 END) as facturados,
        COUNT(*) as total
      FROM partes_trabajo
    `);

    const kpiRow = kpiResult.rows[0] || {};
    const kpis = {
      pendientes: Number(kpiRow.pendientes) || 0,
      en_progreso: Number(kpiRow.en_progreso) || 0,
      finalizados_sin_facturar: Number(kpiRow.finalizados_sin_facturar) || 0,
      facturados: Number(kpiRow.facturados) || 0,
      total: Number(kpiRow.total) || 0,
    };

    // 3. Status distribution for chart
    const statusDistribution = [
      { name: "Pendiente", count: kpis.pendientes, fill: "#3b82f6" },
      { name: "En Curso", count: kpis.en_progreso, fill: "#f59e0b" },
      { name: "Completado", count: kpis.finalizados_sin_facturar, fill: "#10b981" },
      { name: "Facturado", count: kpis.facturados, fill: "#8b5cf6" },
    ];

    // 4. Transform jobs list
    const trabajos = rows.map((r) => ({
      id: String(r.id),
      numero: String(r.numero),
      fecha: String(r.fecha),
      cliente: String(r.cliente),
      clientId: r.client_id ? String(r.client_id) : null,
      telefono: r.telefono ? String(r.telefono) : null,
      direccion: r.direccion ? String(r.direccion) : null,
      tecnico: r.tecnico ? String(r.tecnico) : null,
      estado: String(r.estado || "borrador"),
      observaciones: r.observaciones ? String(r.observaciones) : null,
      created_at: String(r.created_at || ""),
    }));

    return NextResponse.json({
      success: true,
      kpis,
      statusDistribution,
      trabajos,
    });
  } catch (err: any) {
    console.error("Error en API trabajos:", err);
    return NextResponse.json(
      { error: "Error al recuperar los trabajos operativos" },
      { status: 500 }
    );
  }
}
