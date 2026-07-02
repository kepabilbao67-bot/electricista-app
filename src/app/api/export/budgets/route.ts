import { NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";

export async function GET() {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const result = await db.execute(
      `SELECT budgets.number, budgets.date, budgets.valid_until, budgets.status, 
              budgets.subtotal, budgets.tax_rate, budgets.tax_amount, budgets.total, budgets.notes,
              clients.name as client_name, clients.nif as client_nif
       FROM budgets 
       LEFT JOIN clients ON budgets.client_id = clients.id 
       ORDER BY budgets.date DESC`
    );

    const statusMap: Record<string, string> = {
      draft: "Borrador",
      sent: "Enviado",
      accepted: "Aceptado",
      rejected: "Rechazado",
      expired: "Caducado",
    };

    const headers = ["Numero", "Fecha", "Valido Hasta", "Cliente", "NIF Cliente", "Estado", "Base Imponible", "IVA %", "Cuota IVA", "Total", "Notas"];
    const rows = result.rows.map((row) => [
      row.number || "",
      row.date || "",
      row.valid_until || "",
      row.client_name || "",
      row.client_nif || "",
      statusMap[row.status as string] || row.status || "",
      row.subtotal || 0,
      row.tax_rate || 21,
      row.tax_amount || 0,
      row.total || 0,
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
        "Content-Disposition": `attachment; filename="presupuestos_${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Error al exportar presupuestos" }, { status: 500 });
  }
}
