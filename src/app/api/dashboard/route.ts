import { NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";

function getDemoData() {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  const monthlyBilling = [];
  const demoTotals = [2850, 3420, 2980, 4100, 3680, 4250];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    monthlyBilling.push({
      month: monthNames[d.getMonth()],
      year: d.getFullYear(),
      total: demoTotals[5 - i],
    });
  }

  const thirtyFiveDaysAgo = new Date(now);
  thirtyFiveDaysAgo.setDate(thirtyFiveDaysAgo.getDate() - 35);
  const overdueDate = thirtyFiveDaysAgo.toISOString().split("T")[0];

  const twoDaysFromNow = new Date(now);
  twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
  const expiringDate = twoDaysFromNow.toISOString().split("T")[0];

  return {
    demoMode: true,
    totalFacturacion: 18450,
    pendienteCobro: 3200,
    facturasPendientes: 2,
    facturasEsteMes: 4,
    presupuestosPendientes: 2,
    proximasVisitas: 3,
    clientesActivos: 12,
    thisMonthTotal: 4250,
    lastMonthTotal: 3680,
    monthlyBilling,
    topClients: [
      { name: "Comunidad Prop. Autonomía 14", total: 4850.00 },
      { name: "Talleres Mecánicos Eibar S.L.", total: 3220.00 },
      { name: "Bar Restaurante Zubialde", total: 2180.00 },
    ],
    alerts: {
      overdueInvoices: [
        { id: "demo-invoice-overdue", number: "DFB_0012", total: 1850.00, date: overdueDate, client_name: "Garaje Comunitario Bidebarrieta" },
      ],
      expiringBudgets: [
        { id: "demo-budget-expiring", number: "PRES_0008", valid_until: expiringDate, client_name: "Clínica Dental Arana" },
      ],
      todayVisits: [
        { id: "demo-visit-today-1", title: "Revisión cuadro eléctrico", time: "09:30", client_name: "Comunidad Prop. Autonomía 14" },
        { id: "demo-visit-today-2", title: "Instalación punto de recarga", time: "16:00", client_name: "María López García" },
      ],
    },
  };
}

export async function GET() {
  if (process.env.DEMO_MODE === "true") {
    return NextResponse.json(getDemoData());
  }

  try {
    await initializeDatabase();
    const db = getDbClient();

    const totalFacturacion = await db.execute("SELECT COALESCE(SUM(total), 0) as total FROM invoices WHERE status = 'paid'");
    const facturasPendientes = await db.execute("SELECT COUNT(*) as count FROM invoices WHERE status = 'sent'");
    const presupuestosPendientes = await db.execute("SELECT COUNT(*) as count FROM budgets WHERE status IN ('draft', 'sent')");

    const today = new Date().toISOString().split("T")[0];
    const proximasVisitas = await db.execute({ sql: "SELECT COUNT(*) as count FROM visits WHERE date >= ? AND status = 'scheduled'", args: [today] });

    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    const firstOfMonthStr = firstOfMonth.toISOString().split("T")[0];
    const facturasEsteMes = await db.execute({ sql: "SELECT COUNT(*) as count FROM invoices WHERE date >= ?", args: [firstOfMonthStr] });
    const clientesActivos = await db.execute("SELECT COUNT(*) as count FROM clients");

    // Monthly billing data for the last 6 months
    const monthlyBilling = [];
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endD = new Date(year, month, 0);
      const endDate = `${year}-${String(month).padStart(2, "0")}-${String(endD.getDate()).padStart(2, "0")}`;
      const monthTotal = await db.execute({ sql: "SELECT COALESCE(SUM(total), 0) as total FROM invoices WHERE date >= ? AND date <= ?", args: [startDate, endDate] });
      monthlyBilling.push({ month: monthNames[month - 1], year, total: monthTotal.rows[0].total as number });
    }

    const pendienteCobro = await db.execute("SELECT COALESCE(SUM(total), 0) as total FROM invoices WHERE status = 'sent'");

    // Top 3 clients by billing
    const topClientsResult = await db.execute(
      "SELECT clients.name, COALESCE(SUM(invoices.total), 0) as total FROM invoices LEFT JOIN clients ON invoices.client_id = clients.id WHERE invoices.status IN ('paid', 'sent') GROUP BY invoices.client_id ORDER BY total DESC LIMIT 3"
    );
    const topClients = topClientsResult.rows.map((r) => ({ name: r.name as string || "Sin nombre", total: r.total as number }));

    // This month vs last month
    const now = new Date();
    const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const thisMonthEnd = now.toISOString().split("T")[0];
    const thisMonthResult = await db.execute({ sql: "SELECT COALESCE(SUM(total), 0) as total FROM invoices WHERE date >= ? AND date <= ?", args: [thisMonthStart, thisMonthEnd] });

    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStart = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}-01`;
    const lastMonthEndDate = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1, 0);
    const lastMonthEnd = `${lastMonthEndDate.getFullYear()}-${String(lastMonthEndDate.getMonth() + 1).padStart(2, "0")}-${String(lastMonthEndDate.getDate()).padStart(2, "0")}`;
    const lastMonthResult = await db.execute({ sql: "SELECT COALESCE(SUM(total), 0) as total FROM invoices WHERE date >= ? AND date <= ?", args: [lastMonthStart, lastMonthEnd] });

    // Alerts: Invoices overdue >30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];
    const overdueInvoices = await db.execute({
      sql: "SELECT invoices.id, invoices.number, invoices.total, invoices.date, clients.name as client_name FROM invoices LEFT JOIN clients ON invoices.client_id = clients.id WHERE invoices.status = 'sent' AND invoices.date <= ? ORDER BY invoices.date ASC LIMIT 10",
      args: [thirtyDaysAgoStr],
    });

    // Alerts: Budgets expiring in <3 days
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const threeDaysStr = threeDaysFromNow.toISOString().split("T")[0];
    const expiringBudgets = await db.execute({
      sql: "SELECT budgets.id, budgets.number, budgets.valid_until, clients.name as client_name FROM budgets LEFT JOIN clients ON budgets.client_id = clients.id WHERE budgets.status IN ('draft', 'sent') AND budgets.valid_until IS NOT NULL AND budgets.valid_until <= ? AND budgets.valid_until >= ? ORDER BY budgets.valid_until ASC LIMIT 10",
      args: [threeDaysStr, today],
    });

    // Alerts: Today's visits
    const todayVisits = await db.execute({
      sql: "SELECT visits.id, visits.title, visits.time, clients.name as client_name FROM visits LEFT JOIN clients ON visits.client_id = clients.id WHERE visits.date = ? AND visits.status = 'scheduled' ORDER BY visits.time ASC LIMIT 10",
      args: [today],
    });

    return NextResponse.json({
      demoMode: false,
      totalFacturacion: totalFacturacion.rows[0].total as number,
      facturasPendientes: facturasPendientes.rows[0].count as number,
      presupuestosPendientes: presupuestosPendientes.rows[0].count as number,
      proximasVisitas: proximasVisitas.rows[0].count as number,
      facturasEsteMes: facturasEsteMes.rows[0].count as number,
      clientesActivos: clientesActivos.rows[0].count as number,
      monthlyBilling,
      pendienteCobro: pendienteCobro.rows[0].total as number,
      topClients,
      thisMonthTotal: thisMonthResult.rows[0].total as number,
      lastMonthTotal: lastMonthResult.rows[0].total as number,
      alerts: {
        overdueInvoices: overdueInvoices.rows.map((r) => ({
          id: r.id as string,
          number: r.number as string,
          total: r.total as number,
          date: r.date as string,
          client_name: r.client_name as string || "Sin nombre",
        })),
        expiringBudgets: expiringBudgets.rows.map((r) => ({
          id: r.id as string,
          number: r.number as string,
          valid_until: r.valid_until as string,
          client_name: r.client_name as string || "Sin nombre",
        })),
        todayVisits: todayVisits.rows.map((r) => ({
          id: r.id as string,
          title: r.title as string,
          time: r.time as string || "",
          client_name: r.client_name as string || "Sin nombre",
        })),
      },
    });
  } catch {
    return NextResponse.json({ error: "Error al obtener datos del dashboard" }, { status: 500 });
  }
}
