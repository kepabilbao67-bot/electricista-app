import { NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";

export async function GET() {
  try {
    await initializeDatabase();
    const db = getDbClient();

    // 1. Leads by status
    const statusQuery = await db.execute(`
      SELECT status, COUNT(*) as count 
      FROM leads 
      GROUP BY status
    `);

    const statusCounts: Record<string, number> = {
      nuevo: 0,
      contactado: 0,
      cualificado: 0,
      convertido: 0,
      descartado: 0,
    };

    let totalLeads = 0;
    for (const row of statusQuery.rows) {
      const s = String(row.status || "").toLowerCase();
      const count = Number(row.count) || 0;
      statusCounts[s] = count;
      totalLeads += count;
    }

    const convertedLeads = statusCounts.convertido || 0;
    const conversionRate = totalLeads > 0 ? Number(((convertedLeads / totalLeads) * 100).toFixed(1)) : 0;

    // 2. Estimated Revenue & Completed Jobs
    const invoiceRevenueResult = await db.execute(`
      SELECT COALESCE(SUM(total), 0) as total FROM invoices WHERE status = 'paid'
    `);
    const invoiceRevenue = Number(invoiceRevenueResult.rows[0]?.total) || 0;

    const completedJobsResult = await db.execute(`
      SELECT COUNT(*) as count FROM partes_trabajo WHERE estado IN ('completado', 'TRABAJO_COMPLETADO')
    `);
    const completedJobs = Number(completedJobsResult.rows[0]?.count) || 0;

    // 3. Weekly evolution (last 7 days)
    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const weeklyLeads = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayName = dayNames[d.getDay()];

      const dayCountResult = await db.execute({
        sql: "SELECT COUNT(*) as count FROM leads WHERE date(created_at) = date(?)",
        args: [dateStr],
      });

      weeklyLeads.push({
        date: dateStr,
        day: dayName,
        leads: Number(dayCountResult.rows[0]?.count) || 0,
      });
    }

    // 4. Top Services / Interests
    const topServicesResult = await db.execute(`
      SELECT COALESCE(interest, 'General') as name, COUNT(*) as value
      FROM leads
      WHERE interest IS NOT NULL AND TRIM(interest) != ''
      GROUP BY interest
      ORDER BY value DESC
      LIMIT 5
    `);

    const topServices = topServicesResult.rows.map((r) => ({
      name: String(r.name),
      value: Number(r.value) || 0,
    }));

    if (topServices.length === 0) {
      topServices.push(
        { name: "Instalaciones", value: Math.max(1, convertedLeads) },
        { name: "Mantenimiento", value: Math.max(1, statusCounts.contactado || 0) },
        { name: "Boletines / CIE", value: Math.max(1, statusCounts.cualificado || 0) }
      );
    }

    // 5. Recent 5 Leads
    const recentLeadsResult = await db.execute(`
      SELECT id, name, email, phone, status, interest, created_at
      FROM leads
      ORDER BY created_at DESC
      LIMIT 5
    `);

    const recentLeads = recentLeadsResult.rows.map((r) => ({
      id: String(r.id),
      name: String(r.name || "Sin nombre"),
      email: r.email ? String(r.email) : null,
      phone: r.phone ? String(r.phone) : null,
      status: String(r.status || "nuevo"),
      interest: r.interest ? String(r.interest) : null,
      created_at: String(r.created_at || new Date().toISOString()),
    }));

    // 6. Month-over-month comparison
    const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const thisMonthLeadsResult = await db.execute({
      sql: "SELECT COUNT(*) as count FROM leads WHERE created_at >= ?",
      args: [thisMonthStart],
    });
    const thisMonthLeads = Number(thisMonthLeadsResult.rows[0]?.count) || 0;

    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStart = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}-01`;
    const lastMonthEnd = thisMonthStart;

    const lastMonthLeadsResult = await db.execute({
      sql: "SELECT COUNT(*) as count FROM leads WHERE created_at >= ? AND created_at < ?",
      args: [lastMonthStart, lastMonthEnd],
    });
    const lastMonthLeads = Number(lastMonthLeadsResult.rows[0]?.count) || 0;

    const variation = lastMonthLeads > 0
      ? Number((((thisMonthLeads - lastMonthLeads) / lastMonthLeads) * 100).toFixed(1))
      : thisMonthLeads > 0
      ? 100
      : 0;

    return NextResponse.json({
      success: true,
      kpis: {
        totalLeads,
        thisMonthLeads,
        lastMonthLeads,
        monthVariation: variation,
        conversionRate,
        estimatedRevenue: invoiceRevenue,
        completedJobs,
      },
      statusCounts: [
        { name: "Nuevo", count: statusCounts.nuevo || 0, fill: "#3b82f6" },
        { name: "Contactado", count: statusCounts.contactado || 0, fill: "#f59e0b" },
        { name: "Cualificado", count: statusCounts.cualificado || 0, fill: "#8b5cf6" },
        { name: "Convertido", count: statusCounts.convertido || 0, fill: "#10b981" },
        { name: "Descartado", count: statusCounts.descartado || 0, fill: "#ef4444" },
      ],
      weeklyLeads,
      topServices,
      recentLeads,
    });
  } catch (err: any) {
    console.error("Error en API analytics:", err);
    return NextResponse.json(
      { error: "Error al obtener las analíticas de negocio" },
      { status: 500 }
    );
  }
}
