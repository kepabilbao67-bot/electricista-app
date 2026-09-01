import { NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";

function getDemoData() {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  const monthlyBilling = [];
  const monthlyEvolution = [];
  const demoTotals = [2850, 3420, 2980, 4100, 3680, 4250];
  const demoExpenses = [920, 1150, 840, 1320, 1050, 1280];

  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthName = monthNames[d.getMonth()];
    const year = d.getFullYear();
    const ingresos = demoTotals[5 - i];
    const gastos = demoExpenses[5 - i];
    const beneficio = ingresos - gastos;

    monthlyBilling.push({
      month: monthName,
      year,
      total: ingresos,
    });

    monthlyEvolution.push({
      month: monthName,
      year,
      ingresos,
      gastos,
      beneficio,
    });
  }

  const thirtyFiveDaysAgo = new Date(now);
  thirtyFiveDaysAgo.setDate(thirtyFiveDaysAgo.getDate() - 35);
  const overdueDate = thirtyFiveDaysAgo.toISOString().split("T")[0];

  const twoDaysFromNow = new Date(now);
  twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
  const expiringDate = twoDaysFromNow.toISOString().split("T")[0];

  const thisMonthTotal = 4250;
  const thisMonthExpenses = 1280;
  const thisMonthTaxRepercutido = 737.60;
  const thisMonthTaxSoportado = 222.15;

  const thisYearTotal = 21280;
  const thisYearExpenses = 6560;
  const thisYearTaxRepercutido = 3693.22;
  const thisYearTaxSoportado = 1138.51;

  return {
    demoMode: true,
    totalFacturacion: 18450,
    thisMonthTotal,
    thisMonthSubtotal: 3512.40,
    thisMonthTax: thisMonthTaxRepercutido,
    lastMonthTotal: 3680,
    thisYearTotal,
    thisYearSubtotal: 17586.78,
    thisYearTax: thisYearTaxRepercutido,
    thisMonthExpenses,
    thisMonthExpensesSubtotal: 1057.85,
    thisMonthExpensesTax: thisMonthTaxSoportado,
    thisYearExpenses,
    thisYearExpensesSubtotal: 5421.49,
    thisYearExpensesTax: thisYearTaxSoportado,
    thisMonthProfit: thisMonthTotal - thisMonthExpenses,
    thisYearProfit: thisYearTotal - thisYearExpenses,
    pendienteCobro: 3200,
    facturasPendientes: 2,
    facturasVencidasCount: 1,
    facturasVencidasTotal: 1850.00,
    presupuestosPendientes: 2,
    proximasVisitas: 3,
    clientesActivos: 12,
    oportunidadesActivas: 6,
    tareasPendientes: 4,
    monthlyBilling,
    monthlyEvolution,
    fiscal: {
      mes: {
        ivaRepercutido: thisMonthTaxRepercutido,
        ivaSoportado: thisMonthTaxSoportado,
        ivaLiquidacion: Number((thisMonthTaxRepercutido - thisMonthTaxSoportado).toFixed(2)),
      },
      ano: {
        ivaRepercutido: thisYearTaxRepercutido,
        ivaSoportado: thisYearTaxSoportado,
        ivaLiquidacion: Number((thisYearTaxRepercutido - thisYearTaxSoportado).toFixed(2)),
      },
      irpfDisponible: false,
      irpfNota: "Retención IRPF no registrada en los documentos actuales.",
    },
    topClients: [
      { name: "Comunidad Prop. Autonomía 14", total: 4850.00 },
      { name: "Talleres Mecánicos Eibar S.L.", total: 3220.00 },
      { name: "Bar Restaurante Zubialde", total: 2180.00 },
    ],
    recentClients: [
      { id: "c1", name: "Comunidad Prop. Autonomía 14", email: "info@autonomia14.es", phone: "944 123 456", created_at: today },
      { id: "c2", name: "Talleres Mecánicos Eibar S.L.", email: "taller@eibar.com", phone: "943 987 654", created_at: today },
      { id: "c3", name: "Bar Restaurante Zubialde", email: "zubialde@bar.com", phone: "944 555 777", created_at: today },
      { id: "c4", name: "María López García", email: "m.lopez@gmail.com", phone: "600 112 233", created_at: today },
      { id: "c5", name: "Clínica Dental Arana", email: "contacto@dentalarana.com", phone: "945 334 455", created_at: today },
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

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const currentYear = now.getFullYear();

    // 1. Facturación histórica total (pagadas)
    const totalFacturacionRes = await db.execute(
      "SELECT COALESCE(SUM(total), 0) as total FROM invoices WHERE status = 'paid'"
    );
    const totalFacturacion = Number(totalFacturacionRes.rows[0]?.total || 0);

    // 2. Facturación del Mes actual (todas las facturas emitidas: sent, paid)
    const firstOfMonthStr = `${currentYear}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const thisMonthInvoicesRes = await db.execute({
      sql: `SELECT
              COALESCE(SUM(total), 0) as total,
              COALESCE(SUM(subtotal), 0) as subtotal,
              COALESCE(SUM(tax_amount), 0) as tax_amount,
              COUNT(*) as count
            FROM invoices
            WHERE date >= ? AND date <= ? AND status IN ('sent', 'paid')`,
      args: [firstOfMonthStr, today],
    });
    const thisMonthTotal = Number(thisMonthInvoicesRes.rows[0]?.total || 0);
    const thisMonthSubtotal = Number(thisMonthInvoicesRes.rows[0]?.subtotal || 0);
    const thisMonthTax = Number(thisMonthInvoicesRes.rows[0]?.tax_amount || 0);
    const facturasEsteMes = Number(thisMonthInvoicesRes.rows[0]?.count || 0);

    // 3. Facturación del Mes anterior (para comparativas)
    const lastMonthDate = new Date(currentYear, now.getMonth() - 1, 1);
    const lastMonthStart = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}-01`;
    const lastMonthEndDate = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1, 0);
    const lastMonthEnd = `${lastMonthEndDate.getFullYear()}-${String(lastMonthEndDate.getMonth() + 1).padStart(2, "0")}-${String(lastMonthEndDate.getDate()).padStart(2, "0")}`;
    const lastMonthResult = await db.execute({
      sql: "SELECT COALESCE(SUM(total), 0) as total FROM invoices WHERE date >= ? AND date <= ? AND status IN ('sent', 'paid')",
      args: [lastMonthStart, lastMonthEnd],
    });
    const lastMonthTotal = Number(lastMonthResult.rows[0]?.total || 0);

    // 4. Facturación del Año en curso (sent, paid)
    const firstOfYearStr = `${currentYear}-01-01`;
    const endOfYearStr = `${currentYear}-12-31`;
    const thisYearInvoicesRes = await db.execute({
      sql: `SELECT
              COALESCE(SUM(total), 0) as total,
              COALESCE(SUM(subtotal), 0) as subtotal,
              COALESCE(SUM(tax_amount), 0) as tax_amount
            FROM invoices
            WHERE date >= ? AND date <= ? AND status IN ('sent', 'paid')`,
      args: [firstOfYearStr, endOfYearStr],
    });
    const thisYearTotal = Number(thisYearInvoicesRes.rows[0]?.total || 0);
    const thisYearSubtotal = Number(thisYearInvoicesRes.rows[0]?.subtotal || 0);
    const thisYearTax = Number(thisYearInvoicesRes.rows[0]?.tax_amount || 0);

    // 5. Gastos del Mes actual
    const thisMonthExpensesRes = await db.execute({
      sql: `SELECT
              COALESCE(SUM(total), 0) as total,
              COALESCE(SUM(subtotal), 0) as subtotal,
              COALESCE(SUM(tax_amount), 0) as tax_amount
            FROM expenses
            WHERE date >= ? AND date <= ?`,
      args: [firstOfMonthStr, today],
    });
    const thisMonthExpenses = Number(thisMonthExpensesRes.rows[0]?.total || 0);
    const thisMonthExpensesSubtotal = Number(thisMonthExpensesRes.rows[0]?.subtotal || 0);
    const thisMonthExpensesTax = Number(thisMonthExpensesRes.rows[0]?.tax_amount || 0);

    // 6. Gastos del Año en curso
    const thisYearExpensesRes = await db.execute({
      sql: `SELECT
              COALESCE(SUM(total), 0) as total,
              COALESCE(SUM(subtotal), 0) as subtotal,
              COALESCE(SUM(tax_amount), 0) as tax_amount
            FROM expenses
            WHERE date >= ? AND date <= ?`,
      args: [firstOfYearStr, endOfYearStr],
    });
    const thisYearExpenses = Number(thisYearExpensesRes.rows[0]?.total || 0);
    const thisYearExpensesSubtotal = Number(thisYearExpensesRes.rows[0]?.subtotal || 0);
    const thisYearExpensesTax = Number(thisYearExpensesRes.rows[0]?.tax_amount || 0);

    // 7. Facturas pendientes de cobro y vencidas
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

    const pendingInvoicesRes = await db.execute(
      "SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total FROM invoices WHERE status = 'sent'"
    );
    const facturasPendientes = Number(pendingInvoicesRes.rows[0]?.count || 0);
    const pendienteCobro = Number(pendingInvoicesRes.rows[0]?.total || 0);

    const overdueInvoicesRes = await db.execute({
      sql: `SELECT invoices.id, invoices.number, invoices.total, invoices.date, invoices.due_date, clients.name as client_name
            FROM invoices
            LEFT JOIN clients ON invoices.client_id = clients.id
            WHERE invoices.status = 'sent'
              AND ((invoices.due_date IS NOT NULL AND invoices.due_date < ?) OR (invoices.due_date IS NULL AND invoices.date <= ?))
            ORDER BY COALESCE(invoices.due_date, invoices.date) ASC
            LIMIT 10`,
      args: [today, thirtyDaysAgoStr],
    });
    const overdueInvoices = overdueInvoicesRes.rows.map((r) => ({
      id: String(r.id),
      number: String(r.number),
      total: Number(r.total || 0),
      date: String(r.date || ""),
      due_date: r.due_date ? String(r.due_date) : null,
      client_name: String(r.client_name || "Sin nombre"),
    }));
    const facturasVencidasCount = overdueInvoices.length;
    const facturasVencidasTotal = overdueInvoices.reduce((acc, inv) => acc + inv.total, 0);

    // 8. Presupuestos pendientes y visitas
    const presupuestosPendientesRes = await db.execute(
      "SELECT COUNT(*) as count FROM budgets WHERE status IN ('draft', 'sent')"
    );
    const presupuestosPendientes = Number(presupuestosPendientesRes.rows[0]?.count || 0);

    const proximasVisitasRes = await db.execute({
      sql: "SELECT COUNT(*) as count FROM visits WHERE date >= ? AND status = 'scheduled'",
      args: [today],
    });
    const proximasVisitas = Number(proximasVisitasRes.rows[0]?.count || 0);

    const clientesActivosRes = await db.execute("SELECT COUNT(*) as count FROM clients");
    const clientesActivos = Number(clientesActivosRes.rows[0]?.count || 0);

    const oportunidadesActivasRes = await db.execute(
      "SELECT COUNT(*) as count FROM opportunities WHERE stage NOT IN ('cobrado')"
    );
    const oportunidadesActivas = Number(oportunidadesActivasRes.rows[0]?.count || 0);

    const tareasPendientesRes = await db.execute(
      "SELECT COUNT(*) as count FROM crm_tasks WHERE status = 'pending'"
    );
    const tareasPendientes = Number(tareasPendientesRes.rows[0]?.count || 0);

    // 9. Evolución mensual de Ingresos y Gastos (últimos 6 meses)
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const monthlyBilling = [];
    const monthlyEvolution = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endD = new Date(year, month, 0);
      const endDate = `${year}-${String(month).padStart(2, "0")}-${String(endD.getDate()).padStart(2, "0")}`;

      const monthInvoicesRes = await db.execute({
        sql: "SELECT COALESCE(SUM(total), 0) as total FROM invoices WHERE date >= ? AND date <= ? AND status IN ('sent', 'paid')",
        args: [startDate, endDate],
      });
      const monthExpensesRes = await db.execute({
        sql: "SELECT COALESCE(SUM(total), 0) as total FROM expenses WHERE date >= ? AND date <= ?",
        args: [startDate, endDate],
      });

      const ingresos = Number(monthInvoicesRes.rows[0]?.total || 0);
      const gastos = Number(monthExpensesRes.rows[0]?.total || 0);
      const beneficio = ingresos - gastos;
      const monthName = monthNames[month - 1];

      monthlyBilling.push({
        month: monthName,
        year,
        total: ingresos,
      });

      monthlyEvolution.push({
        month: monthName,
        year,
        ingresos,
        gastos,
        beneficio,
      });
    }

    // 10. Top Clientes por Facturación
    const topClientsResult = await db.execute(
      `SELECT clients.name, COALESCE(SUM(invoices.total), 0) as total
       FROM invoices
       LEFT JOIN clients ON invoices.client_id = clients.id
       WHERE invoices.status IN ('paid', 'sent')
       GROUP BY invoices.client_id
       ORDER BY total DESC
       LIMIT 3`
    );
    const topClients = topClientsResult.rows.map((r) => ({
      name: String(r.name || "Sin nombre"),
      total: Number(r.total || 0),
    }));

    // 11. Clientes Recientes (últimos 5 registrados)
    const recentClientsRes = await db.execute(
      "SELECT id, name, email, phone, created_at FROM clients ORDER BY created_at DESC LIMIT 5"
    );
    const recentClients = recentClientsRes.rows.map((r) => ({
      id: String(r.id),
      name: String(r.name || "Sin nombre"),
      email: r.email ? String(r.email) : null,
      phone: r.phone ? String(r.phone) : null,
      created_at: String(r.created_at || ""),
    }));

    // 12. Alertas: Presupuestos por caducar y Visitas de hoy
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const threeDaysStr = threeDaysFromNow.toISOString().split("T")[0];
    const expiringBudgetsRes = await db.execute({
      sql: `SELECT budgets.id, budgets.number, budgets.valid_until, clients.name as client_name
            FROM budgets
            LEFT JOIN clients ON budgets.client_id = clients.id
            WHERE budgets.status IN ('draft', 'sent')
              AND budgets.valid_until IS NOT NULL
              AND budgets.valid_until <= ?
              AND budgets.valid_until >= ?
            ORDER BY budgets.valid_until ASC
            LIMIT 10`,
      args: [threeDaysStr, today],
    });
    const expiringBudgets = expiringBudgetsRes.rows.map((r) => ({
      id: String(r.id),
      number: String(r.number),
      valid_until: String(r.valid_until || ""),
      client_name: String(r.client_name || "Sin nombre"),
    }));

    const todayVisitsRes = await db.execute({
      sql: `SELECT visits.id, visits.title, visits.time, clients.name as client_name
            FROM visits
            LEFT JOIN clients ON visits.client_id = clients.id
            WHERE visits.date = ? AND visits.status = 'scheduled'
            ORDER BY visits.time ASC
            LIMIT 10`,
      args: [today],
    });
    const todayVisits = todayVisitsRes.rows.map((r) => ({
      id: String(r.id),
      title: String(r.title),
      time: String(r.time || ""),
      client_name: String(r.client_name || "Sin nombre"),
    }));

    return NextResponse.json({
      demoMode: false,
      totalFacturacion,
      thisMonthTotal,
      thisMonthSubtotal,
      thisMonthTax,
      lastMonthTotal,
      thisYearTotal,
      thisYearSubtotal,
      thisYearTax,
      thisMonthExpenses,
      thisMonthExpensesSubtotal,
      thisMonthExpensesTax,
      thisYearExpenses,
      thisYearExpensesSubtotal,
      thisYearExpensesTax,
      thisMonthProfit: thisMonthTotal - thisMonthExpenses,
      thisYearProfit: thisYearTotal - thisYearExpenses,
      pendienteCobro,
      facturasPendientes,
      facturasVencidasCount,
      facturasVencidasTotal,
      presupuestosPendientes,
      proximasVisitas,
      facturasEsteMes,
      clientesActivos,
      oportunidadesActivas,
      tareasPendientes,
      monthlyBilling,
      monthlyEvolution,
      fiscal: {
        mes: {
          ivaRepercutido: thisMonthTax,
          ivaSoportado: thisMonthExpensesTax,
          ivaLiquidacion: Number((thisMonthTax - thisMonthExpensesTax).toFixed(2)),
        },
        ano: {
          ivaRepercutido: thisYearTax,
          ivaSoportado: thisYearExpensesTax,
          ivaLiquidacion: Number((thisYearTax - thisYearExpensesTax).toFixed(2)),
        },
        irpfDisponible: false,
        irpfNota: "Retención IRPF no registrada en los documentos actuales. Para cálculo exacto se requiere retención en facturas o perfil fiscal.",
      },
      topClients,
      recentClients,
      alerts: {
        overdueInvoices,
        expiringBudgets,
        todayVisits,
      },
    });
  } catch (error) {
    console.error("Error en API dashboard:", error);
    return NextResponse.json({ error: "Error al obtener datos del dashboard" }, { status: 500 });
  }
}
