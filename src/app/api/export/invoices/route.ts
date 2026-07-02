import { NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";

export async function GET() {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const result = await db.execute(
      `SELECT invoices.number, invoices.date, invoices.status, invoices.subtotal, 
              invoices.tax_rate, invoices.tax_amount, invoices.total, invoices.notes,
              invoices.ticketbai_id, invoices.payment_method,
              clients.name as client_name, clients.nif as client_nif
       FROM invoices 
       LEFT JOIN clients ON invoices.client_id = clients.id 
       ORDER BY invoices.date DESC`
    );

    const statusMap: Record<string, string> = {
      draft: "Borrador",
      pending_batuz: "Pendiente Batuz",
      sent: "Enviada",
      paid: "Cobrada",
      overdue: "Vencida",
    };

    const headers = ["Numero", "Fecha", "Cliente", "NIF Cliente", "Estado", "Base Imponible", "IVA %", "Cuota IVA", "Total", "Forma Pago", "TicketBAI", "Notas"];
    const rows = result.rows.map((row) => [
      row.number || "",
      row.date || "",
      row.client_name || "",
      row.client_nif || "",
      statusMap[row.status as string] || row.status || "",
      row.subtotal || 0,
      row.tax_rate || 21,
      row.tax_amount || 0,
      row.total || 0,
      row.payment_method || "",
      row.ticketbai_id || "",
      row.notes || "",
    ]);

    const csv = [
      headers.join(";"),
      ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")),
    ].join("\n");

    const bom = "\uFEFF";

    return new NextResponse(bom + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="facturas_${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Error al exportar facturas" }, { status: 500 });
  }
}
