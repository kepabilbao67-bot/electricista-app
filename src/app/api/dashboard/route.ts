import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();

    const totalFacturacion = db
      .prepare("SELECT COALESCE(SUM(total), 0) as total FROM invoices WHERE status = 'paid'")
      .get() as { total: number };

    const facturasPendientes = db
      .prepare("SELECT COUNT(*) as count FROM invoices WHERE status = 'sent'")
      .get() as { count: number };

    const presupuestosPendientes = db
      .prepare("SELECT COUNT(*) as count FROM budgets WHERE status IN ('draft', 'sent')")
      .get() as { count: number };

    const today = new Date().toISOString().split("T")[0];
    const proximasVisitas = db
      .prepare("SELECT COUNT(*) as count FROM visits WHERE date >= ? AND status = 'scheduled'")
      .get(today) as { count: number };

    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    const firstOfMonthStr = firstOfMonth.toISOString().split("T")[0];
    const facturasEsteMes = db
      .prepare("SELECT COUNT(*) as count FROM invoices WHERE date >= ?")
      .get(firstOfMonthStr) as { count: number };

    const clientesActivos = db
      .prepare("SELECT COUNT(*) as count FROM clients")
      .get() as { count: number };

    return NextResponse.json({
      totalFacturacion: totalFacturacion.total,
      facturasPendientes: facturasPendientes.count,
      presupuestosPendientes: presupuestosPendientes.count,
      proximasVisitas: proximasVisitas.count,
      facturasEsteMes: facturasEsteMes.count,
      clientesActivos: clientesActivos.count,
    });
  } catch {
    return NextResponse.json(
      { error: "Error al obtener datos del dashboard" },
      { status: 500 }
    );
  }
}
