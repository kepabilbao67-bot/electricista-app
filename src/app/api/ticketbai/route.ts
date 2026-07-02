import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateTicketBAIXml, TICKETBAI_CONFIG } from "@/lib/ticketbai";
import type { TicketBAIInvoice } from "@/lib/ticketbai";

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const invoiceId = body.invoice_id;

    // Get invoice with client data
    const invoice = db
      .prepare(
        `SELECT invoices.*, clients.name as client_name, clients.nif as client_nif,
         clients.address as client_address, clients.city as client_city,
         clients.postal_code as client_postal_code, clients.province as client_province
         FROM invoices 
         LEFT JOIN clients ON invoices.client_id = clients.id 
         WHERE invoices.id = ?`
      )
      .get(invoiceId) as Record<string, unknown> | undefined;

    if (!invoice) {
      return NextResponse.json(
        { error: "Factura no encontrada" },
        { status: 404 }
      );
    }

    const items = db
      .prepare("SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order")
      .all(invoiceId) as Array<Record<string, unknown>>;

    // Get previous invoice for chaining
    const previousInvoice = db
      .prepare(
        "SELECT number, date, ticketbai_signature FROM invoices WHERE created_at < (SELECT created_at FROM invoices WHERE id = ?) AND ticketbai_signature IS NOT NULL ORDER BY created_at DESC LIMIT 1"
      )
      .get(invoiceId) as { number: string; date: string; ticketbai_signature: string } | undefined;

    const now = new Date();
    const hora = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

    const ticketbaiInvoice: TicketBAIInvoice = {
      serie: TICKETBAI_CONFIG.serie,
      numero: (invoice.number as string).replace(TICKETBAI_CONFIG.serie, ""),
      fecha: invoice.date as string,
      hora,
      descripcion: `Factura ${invoice.number} - Servicios electricos`,
      emisor: {
        nif: TICKETBAI_CONFIG.emisor.nif,
        nombre: TICKETBAI_CONFIG.emisor.nombre,
      },
      destinatario: invoice.client_nif
        ? {
            nif: invoice.client_nif as string,
            nombre: invoice.client_name as string,
            direccion: invoice.client_address as string | undefined,
            codigoPostal: invoice.client_postal_code as string | undefined,
            municipio: invoice.client_city as string | undefined,
            provincia: invoice.client_province as string | undefined,
          }
        : undefined,
      detalles: items.map((item) => ({
        descripcion: item.description as string,
        cantidad: item.quantity as number,
        precioUnitario: item.unit_price as number,
        importe: item.total as number,
      })),
      importeTotal: invoice.total as number,
      baseImponible: invoice.subtotal as number,
      cuotaIVA: invoice.tax_amount as number,
      tipoIVA: invoice.tax_rate as number,
      facturaAnterior: previousInvoice
        ? {
            serie: TICKETBAI_CONFIG.serie,
            numero: previousInvoice.number.replace(TICKETBAI_CONFIG.serie, ""),
            fecha: previousInvoice.date,
            firma: previousInvoice.ticketbai_signature,
          }
        : undefined,
    };

    const result = generateTicketBAIXml(ticketbaiInvoice);

    // Update invoice with TicketBAI data
    db.prepare(
      `UPDATE invoices SET ticketbai_id = ?, ticketbai_signature = ?, ticketbai_qr = ?, status = 'sent', updated_at = datetime('now') WHERE id = ?`
    ).run(result.ticketbaiId, result.signature, result.qrCode, invoiceId);

    return NextResponse.json({
      ticketbaiId: result.ticketbaiId,
      signature: result.signature,
      qrCode: result.qrCode,
      xml: result.xml,
    });
  } catch (error) {
    console.error("TicketBAI error:", error);
    return NextResponse.json(
      { error: "Error al generar TicketBAI" },
      { status: 500 }
    );
  }
}
