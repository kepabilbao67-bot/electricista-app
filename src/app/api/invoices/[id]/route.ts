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
    const invoiceResult = await db.execute({
      sql: `SELECT invoices.*, clients.name as client_name, clients.nif as client_nif, 
         clients.address as client_address, clients.city as client_city, 
         clients.postal_code as client_postal_code, clients.province as client_province,
         clients.email as client_email
         FROM invoices 
         LEFT JOIN clients ON invoices.client_id = clients.id 
         WHERE invoices.id = ?`,
      args: [id],
    });

    if (invoiceResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Factura no encontrada" },
        { status: 404 }
      );
    }

    const itemsResult = await db.execute({
      sql: "SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order",
      args: [id],
    });

    return NextResponse.json({ ...invoiceResult.rows[0], items: itemsResult.rows });
  } catch {
    return NextResponse.json(
      { error: "Error al obtener factura" },
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

    if (body.status) {
      await db.execute({
        sql: "UPDATE invoices SET status = ?, updated_at = datetime('now') WHERE id = ?",
        args: [body.status, id],
      });
    }

    if (body.ticketbai_id) {
      await db.execute({
        sql: `UPDATE invoices SET ticketbai_id = ?, ticketbai_signature = ?, ticketbai_qr = ?, updated_at = datetime('now') WHERE id = ?`,
        args: [body.ticketbai_id, body.ticketbai_signature, body.ticketbai_qr, id],
      });
    }

    const result = await db.execute({
      sql: "SELECT * FROM invoices WHERE id = ?",
      args: [id],
    });
    return NextResponse.json(result.rows[0]);
  } catch {
    return NextResponse.json(
      { error: "Error al actualizar factura" },
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
    await db.execute({ sql: "DELETE FROM invoice_items WHERE invoice_id = ?", args: [id] });
    await db.execute({ sql: "DELETE FROM invoices WHERE id = ?", args: [id] });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Error al eliminar factura" },
      { status: 500 }
    );
  }
}
