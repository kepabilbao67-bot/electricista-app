import { NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";

export async function GET() {
  try {
    await initializeDatabase();
    const db = getDbClient();

    const totalFacturacion = await db.execute(
      "SELECT COALESCE(SUM(total), 0) as total FROM invoices WHERE status = 'paid'"
    );

    const facturasPendientes = await db.execute(
      "SELECT COUNT(*) as count FROM invoices WHERE status = 'sent'"
    );

    const presupuestosPendientes = await db.execute(
      "SELECT COUNT(*) as count FROM budgets WHERE status IN ('draft', 'sent')"
    );

    const today = new Date().toISOString().split("T")[0];
    const proximasVisitas = await db.execute({
      sql: "SELECT COUNT(*) as count FROM visits WHERE date >= ? AND status = 'scheduled'",
      args: [today],
    });

    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    const firstOfMonthStr = firstOfMonth.toISOString().split("T")[0];
    const facturasEsteMes = await db.execute({
      sql: "SELECT COUNT(*) as count FROM invoices WHERE date >= ?",
      args: [firstOfMonthStr],
    });

    const clientesActivos = await db.execute(
      "SELECT COUNT(*) as count FROM clients"
    );

    return NextResponse.json({
      totalFacturacion: totalFacturacion.rows[0].total as number,
      facturasPendientes: (facturasPendientes.rows[0].count as number),
      presupuestosPendientes: (presupuestosPendientes.rows[0].count as number),
      proximasVisitas: (proximasVisitas.rows[0].count as number),
      facturasEsteMes: (facturasEsteMes.rows[0].count as number),
      clientesActivos: (clientesActivos.rows[0].count as number),
    });
  } catch {
    return NextResponse.json(
      { error: "Error al obtener datos del dashboard" },
      { status: 500 }
    );
  }
}
