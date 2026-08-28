import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { checkExportSecret } from "@/lib/export-guard";
import { COMPANY_PROFILE } from "@/lib/company-profile";
import { APP_CONFIG } from "@/config/app-config";

// Export all data as JSON (for backup or import to Airtable/Notion/Sheets)
export async function GET(request: NextRequest) {
  const blocked = checkExportSecret(request);
  if (blocked) return blocked;

  try {
    await initializeDatabase();
    const db = getDbClient();

    const clients = await db.execute("SELECT * FROM clients ORDER BY name");
    const invoices = await db.execute(
      `SELECT invoices.*, clients.name as client_name, clients.nif as client_nif
       FROM invoices LEFT JOIN clients ON invoices.client_id = clients.id ORDER BY date DESC`
    );
    const invoiceItems = await db.execute("SELECT * FROM invoice_items ORDER BY invoice_id, sort_order");
    const budgets = await db.execute(
      `SELECT budgets.*, clients.name as client_name, clients.nif as client_nif
       FROM budgets LEFT JOIN clients ON budgets.client_id = clients.id ORDER BY date DESC`
    );
    const budgetItems = await db.execute("SELECT * FROM budget_items ORDER BY budget_id, sort_order");
    const catalog = await db.execute("SELECT * FROM catalog_items ORDER BY category, name");
    const visits = await db.execute("SELECT * FROM visits ORDER BY date DESC");
    const communications = await db.execute("SELECT * FROM communications ORDER BY created_at DESC");

    const fullAddress = [COMPANY_PROFILE.addressLine1, COMPANY_PROFILE.addressLine2]
      .filter(Boolean)
      .join(", ");

    const data = {
      exportDate: new Date().toISOString(),
      emisor: {
        nombre: COMPANY_PROFILE.legalName,
        nif: COMPANY_PROFILE.nif,
        direccion: fullAddress,
        iban: APP_CONFIG.company.iban,
        telefono: COMPANY_PROFILE.phone,
        email: COMPANY_PROFILE.email,
      },
      clients: clients.rows,
      invoices: invoices.rows,
      invoiceItems: invoiceItems.rows,
      budgets: budgets.rows,
      budgetItems: budgetItems.rows,
      catalog: catalog.rows,
      visits: visits.rows,
      communications: communications.rows,
    };

    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="backup_${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Error al exportar datos" }, { status: 500 });
  }
}
