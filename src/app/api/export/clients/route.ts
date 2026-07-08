import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { checkExportSecret } from "@/lib/export-guard";

export async function GET(request: NextRequest) {
  const blocked = checkExportSecret(request);
  if (blocked) return blocked;

  try {
    await initializeDatabase();
    const db = getDbClient();
    const result = await db.execute(
      "SELECT name, nif, email, phone, address, city, postal_code, province, notes, created_at FROM clients ORDER BY name"
    );

    // Generar CSV
    const headers = ["Nombre", "NIF", "Email", "Telefono", "Direccion", "Ciudad", "Codigo Postal", "Provincia", "Notas", "Fecha Alta"];
    const rows = result.rows.map((row) => [
      row.name || "",
      row.nif || "",
      row.email || "",
      row.phone || "",
      row.address || "",
      row.city || "",
      row.postal_code || "",
      row.province || "",
      row.notes || "",
      row.created_at || "",
    ]);

    const csv = [
      headers.join(";"),
      ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")),
    ].join("\n");

    // BOM for Excel compatibility with special characters
    const bom = "\uFEFF";

    return new NextResponse(bom + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="clientes_${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Error al exportar clientes" }, { status: 500 });
  }
}
