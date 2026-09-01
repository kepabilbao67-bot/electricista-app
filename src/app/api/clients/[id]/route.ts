import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await initializeDatabase();
    const db = getDbClient();
    const result = await db.execute({
      sql: "SELECT * FROM clients WHERE id = ?",
      args: [id],
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch {
    return NextResponse.json(
      { error: "Error al obtener cliente" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await initializeDatabase();
    const db = getDbClient();
    const body = await request.json();

    let fullName = body.name;
    if ((!fullName || fullName.trim().length === 0) && (body.first_name || body.last_name)) {
      fullName = [body.first_name, body.last_name].filter(Boolean).join(" ");
    }

    await db.execute({
      sql: `UPDATE clients SET
        name = ?,
        first_name = ?,
        last_name = ?,
        company = ?,
        source = ?,
        status = ?,
        probability = ?,
        nif = ?,
        email = ?,
        phone = ?,
        address = ?,
        city = ?,
        postal_code = ?,
        province = ?,
        notes = ?,
        client_type = ?,
        address_color = ?,
        notes_color = ?,
        updated_at = datetime('now')
       WHERE id = ?`,
      args: [
        fullName || body.name || "",
        body.first_name || null,
        body.last_name || null,
        body.company || null,
        body.source || null,
        body.status || "nuevo",
        typeof body.probability === "number" ? body.probability : 0,
        body.nif || null,
        body.email || null,
        body.phone || null,
        body.address || null,
        body.city || null,
        body.postal_code || null,
        body.province || null,
        body.notes || null,
        body.client_type || "particular",
        body.address_color || null,
        body.notes_color || null,
        id,
      ],
    });

    const result = await db.execute({
      sql: "SELECT * FROM clients WHERE id = ?",
      args: [id],
    });
    return NextResponse.json(result.rows[0]);
  } catch {
    return NextResponse.json(
      { error: "Error al actualizar cliente" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await initializeDatabase();
    const db = getDbClient();

    // Check referential integrity: count invoices and budgets for this client
    const invoiceCount = await db.execute({
      sql: "SELECT COUNT(*) as count FROM invoices WHERE client_id = ?",
      args: [id],
    });
    const budgetCount = await db.execute({
      sql: "SELECT COUNT(*) as count FROM budgets WHERE client_id = ?",
      args: [id],
    });

    const totalDocs = Number(invoiceCount.rows[0].count) + Number(budgetCount.rows[0].count);
    if (totalDocs > 0) {
      return NextResponse.json(
        { error: "No se puede borrar este cliente porque tiene documentos asociados. Borra o revisa primero sus documentos." },
        { status: 409 }
      );
    }

    // Clean up crm records
    await db.execute({ sql: "DELETE FROM crm_activities WHERE client_id = ?", args: [id] });
    await db.execute({ sql: "DELETE FROM crm_tasks WHERE client_id = ?", args: [id] });
    await db.execute({ sql: "DELETE FROM opportunities WHERE client_id = ?", args: [id] });
    await db.execute({ sql: "DELETE FROM clients WHERE id = ?", args: [id] });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Error al eliminar cliente" },
      { status: 500 }
    );
  }
}
