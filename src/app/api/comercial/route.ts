import { NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";

export async function GET() {
  try {
    await initializeDatabase();
    const db = getDbClient();

    // Opportunities by stage
    const opportunities = await db.execute(
      `SELECT stage, COUNT(*) as count, SUM(estimated_value) as total_value
       FROM opportunities GROUP BY stage ORDER BY stage`
    );

    // Pending follow-ups (next_action_at <= today + 3 days)
    const followUps = await db.execute(
      `SELECT o.*, c.name as client_name
       FROM opportunities o
       LEFT JOIN clients c ON c.id = o.client_id
       WHERE o.next_action_at IS NOT NULL
         AND o.next_action_at <= date('now', '+3 days')
         AND o.stage NOT IN ('cobrado')
       ORDER BY o.next_action_at ASC
       LIMIT 10`
    );

    // Pending budgets (sent, not accepted/rejected)
    const pendingBudgets = await db.execute(
      `SELECT b.id, b.number, b.total, b.date, b.valid_until, c.name as client_name, c.phone as client_phone
       FROM budgets b
       LEFT JOIN clients c ON c.id = b.client_id
       WHERE b.status = 'sent'
       ORDER BY b.date DESC
       LIMIT 10`
    );

    // Active work orders (borrador or firmado)
    const activePartes = await db.execute(
      `SELECT id, numero, fecha, cliente, estado
       FROM partes_trabajo
       WHERE estado IN ('borrador', 'firmado')
       ORDER BY fecha DESC
       LIMIT 10`
    );

    // Unpaid invoices
    const unpaidInvoices = await db.execute(
      `SELECT i.id, i.number, i.total, i.date, i.status, c.name as client_name, c.phone as client_phone
       FROM invoices i
       LEFT JOIN clients c ON c.id = i.client_id
       WHERE i.status IN ('sent', 'overdue')
       ORDER BY i.date ASC
       LIMIT 10`
    );

    // Summary KPIs
    const totalOpportunities = await db.execute(
      `SELECT COUNT(*) as count, COALESCE(SUM(estimated_value), 0) as total
       FROM opportunities WHERE stage NOT IN ('cobrado')`
    );

    const totalPendingInvoices = await db.execute(
      `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total
       FROM invoices WHERE status IN ('sent', 'overdue')`
    );

    return NextResponse.json({
      stages: opportunities.rows,
      followUps: followUps.rows,
      pendingBudgets: pendingBudgets.rows,
      activePartes: activePartes.rows,
      unpaidInvoices: unpaidInvoices.rows,
      kpis: {
        openOpportunities: Number(totalOpportunities.rows[0]?.count ?? 0),
        openOpportunitiesValue: Number(totalOpportunities.rows[0]?.total ?? 0),
        pendingInvoices: Number(totalPendingInvoices.rows[0]?.count ?? 0),
        pendingInvoicesValue: Number(totalPendingInvoices.rows[0]?.total ?? 0),
      },
    });
  } catch {
    return NextResponse.json({ error: "Error al obtener datos comerciales" }, { status: 500 });
  }
}
