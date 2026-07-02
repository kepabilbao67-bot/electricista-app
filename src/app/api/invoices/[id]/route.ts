import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const invoice = db
      .prepare(
        `SELECT invoices.*, clients.name as client_name, clients.nif as client_nif, 
         clients.address as client_address, clients.city as client_city, 
         clients.postal_code as client_postal_code, clients.province as client_province
         FROM invoices 
         LEFT JOIN clients ON invoices.client_id = clients.id 
         WHERE invoices.id = ?`
      )
      .get(id);

    if (!invoice) {
      return NextResponse.json(
        { error: "Factura no encontrada" },
        { status: 404 }
      );
    }

    const items = db
      .prepare(
        "SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order"
      )
      .all(id);

    return NextResponse.json({ ...invoice, items });
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
    const db = getDb();
    const body = await request.json();

    if (body.status) {
      db.prepare(
        "UPDATE invoices SET status = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(body.status, id);
    }

    if (body.ticketbai_id) {
      db.prepare(
        `UPDATE invoices SET ticketbai_id = ?, ticketbai_signature = ?, ticketbai_qr = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(body.ticketbai_id, body.ticketbai_signature, body.ticketbai_qr, id);
    }

    const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id);
    return NextResponse.json(invoice);
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
    const db = getDb();
    db.prepare("DELETE FROM invoice_items WHERE invoice_id = ?").run(id);
    db.prepare("DELETE FROM invoices WHERE id = ?").run(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Error al eliminar factura" },
      { status: 500 }
    );
  }
}
