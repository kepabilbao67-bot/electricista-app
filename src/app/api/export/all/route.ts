import { NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";

// Export all data as JSON (for backup or import to Airtable/Notion/Sheets)
export async function GET() {
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

    const data = {
      exportDate: new Date().toISOString(),
      emisor: {
        nombre: "MARTIN OYARZABAL, IVAN",
        nif: "16063731W",
        direccion: "Lehendakari Aguirre 7b 2 derecha, 48640 Berango, Bizkaia",
        iban: "ES66.0182.0450.1102.0150.3156",
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
        "Content-Disposition": `attachment; filename="electricista_backup_${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Error al exportar datos" }, { status: 500 });
  }
}
