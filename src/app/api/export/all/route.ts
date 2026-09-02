import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { checkExportSecret } from "@/lib/export-guard";
import { getCompanyProfileFromDb } from "@/lib/core/company";

/**
 * AUTÓNOMO360 — Exportación Integral de Datos
 *
 * Exporta el 100% de las entidades del negocio en formato JSON para backup
 * o portabilidad (Airtable / Notion / Sheets / Contabilidad):
 * - Emisor y Configuración Empresarial
 * - Clientes
 * - Facturas y Líneas de Factura
 * - Presupuestos y Líneas de Presupuesto
 * - Partes de Trabajo, Tareas y Materiales
 * - Gastos, Líneas de Gastos y Proveedores
 * - CRM: Leads, Oportunidades, Tareas y Actividades
 * - Agenda y Visitas
 * - Catálogo y Tarifas
 * - Historial de Comunicaciones
 *
 * NOTA DE SEGURIDAD: Nunca se exportan tokens, contraseñas ni claves de API.
 */
export async function GET(request: NextRequest) {
  const blocked = checkExportSecret(request);
  if (blocked) return blocked;

  try {
    await initializeDatabase();
    const db = getDbClient();

    // 1. Configuración de emisor
    const companyProfile = await getCompanyProfileFromDb(db);

    // 2. Clientes
    const clients = await db.execute("SELECT * FROM clients ORDER BY name ASC");

    // 3. Facturas y Líneas
    const invoices = await db.execute(
      `SELECT invoices.*, clients.name as client_name, clients.nif as client_nif
       FROM invoices LEFT JOIN clients ON invoices.client_id = clients.id ORDER BY date DESC`
    );
    const invoiceItems = await db.execute("SELECT * FROM invoice_items ORDER BY invoice_id, sort_order ASC");

    // 4. Presupuestos y Líneas
    const budgets = await db.execute(
      `SELECT budgets.*, clients.name as client_name, clients.nif as client_nif
       FROM budgets LEFT JOIN clients ON budgets.client_id = clients.id ORDER BY date DESC`
    );
    const budgetItems = await db.execute("SELECT * FROM budget_items ORDER BY budget_id, sort_order ASC");

    // 5. Partes de Trabajo, Líneas y Materiales
    let partesTrabajo: Array<Record<string, unknown>> = [];
    let parteTrabajoLineas: Array<Record<string, unknown>> = [];
    let parteMateriales: Array<Record<string, unknown>> = [];

    try {
      const ptRes = await db.execute("SELECT * FROM partes_trabajo ORDER BY fecha DESC, numero DESC");
      partesTrabajo = ptRes.rows;
      const ptLineasRes = await db.execute("SELECT * FROM parte_trabajo_lineas ORDER BY parte_id, orden ASC");
      parteTrabajoLineas = ptLineasRes.rows;
      const ptMatRes = await db.execute("SELECT * FROM parte_materiales ORDER BY parte_id, orden ASC");
      parteMateriales = ptMatRes.rows;
    } catch {
      // Si alguna tabla secundaria de partes no existe en DB heredadas
    }

    // 6. Gastos, Líneas y Proveedores
    let expenses: Array<Record<string, unknown>> = [];
    let expenseItems: Array<Record<string, unknown>> = [];
    let suppliers: Array<Record<string, unknown>> = [];

    try {
      const expRes = await db.execute("SELECT * FROM expenses ORDER BY date DESC");
      expenses = expRes.rows;
      const expItemsRes = await db.execute("SELECT * FROM expense_items ORDER BY expense_id, sort_order ASC");
      expenseItems = expItemsRes.rows;
      const supRes = await db.execute("SELECT * FROM suppliers ORDER BY name ASC");
      suppliers = supRes.rows;
    } catch {
      // Tablas de gastos
    }

    // 7. CRM: Leads, Oportunidades, Tareas y Actividades
    let leads: Array<Record<string, unknown>> = [];
    let opportunities: Array<Record<string, unknown>> = [];
    let crmTasks: Array<Record<string, unknown>> = [];
    let crmActivities: Array<Record<string, unknown>> = [];

    try {
      const leadsRes = await db.execute("SELECT * FROM leads ORDER BY created_at DESC");
      leads = leadsRes.rows;
      const oppsRes = await db.execute("SELECT * FROM opportunities ORDER BY created_at DESC");
      opportunities = oppsRes.rows;
      const tasksRes = await db.execute("SELECT * FROM crm_tasks ORDER BY due_at ASC");
      crmTasks = tasksRes.rows;
      const actRes = await db.execute("SELECT * FROM crm_activities ORDER BY created_at DESC");
      crmActivities = actRes.rows;
    } catch {
      // CRM
    }

    // 8. Agenda / Visitas
    const visits = await db.execute("SELECT * FROM visits ORDER BY date DESC, time ASC");

    // 9. Catálogo
    const catalog = await db.execute("SELECT * FROM catalog_items ORDER BY category, name ASC");

    // 10. Comunicaciones
    const communications = await db.execute("SELECT * FROM communications ORDER BY created_at DESC");

    const fullAddress = [companyProfile.addressLine1, companyProfile.addressLine2]
      .filter(Boolean)
      .join(", ");

    const exportPayload = {
      version: "autonomo360-v1",
      exportDate: new Date().toISOString(),
      emisor: {
        tradeName: companyProfile.tradeName,
        legalName: companyProfile.legalName,
        ownerName: companyProfile.ownerName,
        nif: companyProfile.nif,
        direccion: fullAddress,
        phone: companyProfile.phone,
        email: companyProfile.email,
        iban: companyProfile.iban,
        bankName: companyProfile.bankName,
      },
      stats: {
        totalClients: clients.rows.length,
        totalInvoices: invoices.rows.length,
        totalBudgets: budgets.rows.length,
        totalPartesTrabajo: partesTrabajo.length,
        totalExpenses: expenses.length,
        totalLeads: leads.length,
        totalOpportunities: opportunities.length,
        totalVisits: visits.rows.length,
      },
      clients: clients.rows,
      invoices: invoices.rows,
      invoiceItems: invoiceItems.rows,
      budgets: budgets.rows,
      budgetItems: budgetItems.rows,
      partesTrabajo,
      parteTrabajoLineas,
      parteMateriales,
      expenses,
      expenseItems,
      suppliers,
      crm: {
        leads,
        opportunities,
        tasks: crmTasks,
        activities: crmActivities,
      },
      visits: visits.rows,
      catalog: catalog.rows,
      communications: communications.rows,
    };

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="autonomo360_backup_${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error) {
    console.error("Error en exportación integral:", error);
    return NextResponse.json({ error: "Error al exportar datos de Autónomo360" }, { status: 500 });
  }
}
