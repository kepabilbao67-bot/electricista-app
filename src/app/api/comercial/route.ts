import { NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";

export async function GET() {
  try {
    await initializeDatabase();
    const db = getDbClient();

    // Opportunities by stage
    const opportunities = await db.execute(
      `SELECT stage, COUNT(*) as count, COALESCE(SUM(estimated_value), 0) as total_value
       FROM opportunities GROUP BY stage ORDER BY stage`
    );

    // Pending follow-ups (next_action_at <= today + 7 days)
    const followUps = await db.execute(
      `SELECT o.*, c.name as client_name, c.phone as client_phone, c.email as client_email, c.company as client_company
       FROM opportunities o
       LEFT JOIN clients c ON c.id = o.client_id
       WHERE o.next_action_at IS NOT NULL
         AND o.stage NOT IN ('cliente', 'perdido', 'no_interesado', 'cobrado')
       ORDER BY o.next_action_at ASC
       LIMIT 15`
    );

    // Overdue follow-ups (next_action_at < today)
    const overdueFollowUps = await db.execute(
      `SELECT o.*, c.name as client_name, c.phone as client_phone, c.email as client_email, c.company as client_company
       FROM opportunities o
       LEFT JOIN clients c ON c.id = o.client_id
       WHERE o.next_action_at IS NOT NULL
         AND date(o.next_action_at) < date('now')
         AND o.stage NOT IN ('cliente', 'perdido', 'no_interesado', 'cobrado')
       ORDER BY o.next_action_at ASC
       LIMIT 10`
    );

    // Hot opportunities (prob >= 60% or stage in 'propuesta', 'negociacion', 'interesado')
    const hotOpportunities = await db.execute(
      `SELECT o.*, c.name as client_name, c.phone as client_phone, c.company as client_company
       FROM opportunities o
       LEFT JOIN clients c ON c.id = o.client_id
       WHERE (o.probability >= 60 OR o.stage IN ('propuesta', 'negociacion', 'interesado'))
         AND o.stage NOT IN ('cliente', 'perdido', 'no_interesado', 'cobrado')
       ORDER BY o.estimated_value DESC, o.probability DESC
       LIMIT 10`
    );

    // Pending documentation (clients or opportunities with status/stage = 'doc_pendiente')
    const pendingDocsClients = await db.execute(
      `SELECT c.id, c.name, c.company, c.phone, c.email, c.notes, c.status
       FROM clients c
       WHERE c.status = 'doc_pendiente'
       ORDER BY c.updated_at DESC
       LIMIT 10`
    );

    const pendingDocsOpportunities = await db.execute(
      `SELECT o.*, c.name as client_name, c.phone as client_phone, c.company as client_company
       FROM opportunities o
       LEFT JOIN clients c ON c.id = o.client_id
       WHERE o.stage = 'doc_pendiente'
       ORDER BY o.updated_at DESC
       LIMIT 10`
    );

    // Pending tasks for today / overdue
    const todayTasks = await db.execute(
      `SELECT t.*, c.name as client_name, c.phone as client_phone, c.company as client_company
       FROM crm_tasks t
       LEFT JOIN clients c ON c.id = t.client_id
       WHERE t.status = 'pending'
         AND (t.due_at IS NULL OR date(t.due_at) <= date('now'))
       ORDER BY CASE WHEN t.due_at IS NULL THEN 1 ELSE 0 END, t.due_at ASC, t.priority DESC
       LIMIT 15`
    );

    // Upcoming meetings (visits scheduled)
    const upcomingMeetings = await db.execute(
      `SELECT v.*, c.name as client_name, c.phone as client_phone, c.company as client_company
       FROM visits v
       LEFT JOIN clients c ON c.id = v.client_id
       WHERE v.status = 'scheduled'
         AND date(v.date) >= date('now')
       ORDER BY v.date ASC, v.time ASC
       LIMIT 10`
    );

    // Recent CRM activities
    const recentActivities = await db.execute(
      `SELECT a.*, c.name as client_name, o.title as opportunity_title
       FROM crm_activities a
       LEFT JOIN clients c ON c.id = a.client_id
       LEFT JOIN opportunities o ON o.id = a.opportunity_id
       ORDER BY a.occurred_at DESC
       LIMIT 15`
    );

    // Summary KPIs
    const totalOpportunities = await db.execute(
      `SELECT COUNT(*) as count, COALESCE(SUM(estimated_value), 0) as total
       FROM opportunities WHERE stage NOT IN ('cliente', 'perdido', 'no_interesado', 'cobrado')`
    );

    const closedWonOpportunities = await db.execute(
      `SELECT COUNT(*) as count, COALESCE(SUM(estimated_value), 0) as total
       FROM opportunities WHERE stage IN ('cliente', 'cobrado', 'facturado', 'aceptado')`
    );

    const totalClientsCount = await db.execute(
      `SELECT COUNT(*) as count FROM clients`
    );

    const newClientsThisMonth = await db.execute(
      `SELECT COUNT(*) as count FROM clients WHERE created_at >= date('now', 'start of month')`
    );

    return NextResponse.json({
      stages: opportunities.rows,
      followUps: followUps.rows,
      overdueFollowUps: overdueFollowUps.rows,
      hotOpportunities: hotOpportunities.rows,
      pendingDocs: {
        clients: pendingDocsClients.rows,
        opportunities: pendingDocsOpportunities.rows,
      },
      todayTasks: todayTasks.rows,
      upcomingMeetings: upcomingMeetings.rows,
      recentActivities: recentActivities.rows,
      kpis: {
        openOpportunities: Number(totalOpportunities.rows[0]?.count ?? 0),
        openOpportunitiesValue: Number(totalOpportunities.rows[0]?.total ?? 0),
        closedWonCount: Number(closedWonOpportunities.rows[0]?.count ?? 0),
        closedWonValue: Number(closedWonOpportunities.rows[0]?.total ?? 0),
        totalClients: Number(totalClientsCount.rows[0]?.count ?? 0),
        newClientsThisMonth: Number(newClientsThisMonth.rows[0]?.count ?? 0),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Error al obtener datos comerciales" },
      { status: 500 }
    );
  }
}
