import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { generateTicketBAIXml, generateLROEXml, TICKETBAI_CONFIG, signTicketBAIXml, isCertificateConfigured } from "@/lib/ticketbai";
import type { TicketBAIInvoice } from "@/lib/ticketbai";

// POST - Generar XML TicketBAI para subir a Batuz
export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const body = await request.json();
    const invoiceId = body.invoice_id;
    const action = body.action || "generate"; // "generate" | "confirm"

    // Si es confirmar TBAI desde Batuz (meter el código real)
    if (action === "confirm") {
      await db.execute({
        sql: `UPDATE invoices SET 
          ticketbai_id = ?, 
          ticketbai_signature = ?, 
          ticketbai_qr = ?, 
          status = 'sent', 
          updated_at = datetime('now') 
        WHERE id = ?`,
        args: [body.ticketbai_id, body.ticketbai_signature, body.ticketbai_qr, invoiceId],
      });

      return NextResponse.json({
        success: true,
        message: "Datos TicketBAI confirmados desde Batuz",
      });
    }

    // Obtener factura con datos del cliente
    const invoiceResult = await db.execute({
      sql: `SELECT invoices.*, clients.name as client_name, clients.nif as client_nif,
         clients.address as client_address, clients.city as client_city,
         clients.postal_code as client_postal_code, clients.province as client_province
         FROM invoices 
         LEFT JOIN clients ON invoices.client_id = clients.id 
         WHERE invoices.id = ?`,
      args: [invoiceId],
    });

    if (invoiceResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Factura no encontrada" },
        { status: 404 }
      );
    }

    const invoice = invoiceResult.rows[0];

    // Obtener items de la factura
    const itemsResult = await db.execute({
      sql: "SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order",
      args: [invoiceId],
    });

    // Obtener factura anterior para encadenamiento
    const previousResult = await db.execute({
      sql: "SELECT number, date, ticketbai_signature FROM invoices WHERE created_at < (SELECT created_at FROM invoices WHERE id = ?) AND ticketbai_signature IS NOT NULL ORDER BY created_at DESC LIMIT 1",
      args: [invoiceId],
    });

    const previousInvoice = previousResult.rows.length > 0 ? previousResult.rows[0] : null;

    const now = new Date();
    const hora = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

    const ticketbaiInvoice: TicketBAIInvoice = {
      serie: TICKETBAI_CONFIG.serie,
      numero: (invoice.number as string).replace(TICKETBAI_CONFIG.serie, ""),
      fecha: invoice.date as string,
      hora,
      descripcion: invoice.notes as string || `Factura ${invoice.number} - Servicios electricos`,
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
      detalles: itemsResult.rows.map((item) => ({
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
            numero: (previousInvoice.number as string).replace(TICKETBAI_CONFIG.serie, ""),
            fecha: previousInvoice.date as string,
            firma: previousInvoice.ticketbai_signature as string,
          }
        : undefined,
    };

    // Generar XML TicketBAI
    const result = generateTicketBAIXml(ticketbaiInvoice);

    // Si hay certificado configurado, firmar con XAdES-EPES real
    let finalXml = result.xml;
    let finalSignature = result.signature;
    let firmadoConCertificado = false;

    if (isCertificateConfigured()) {
      try {
        const signed = signTicketBAIXml(result.xml);
        finalXml = signed.signedXml;
        finalSignature = signed.signatureValue;
        firmadoConCertificado = true;
      } catch (error) {
        console.error("Error firmando con certificado:", error);
        // Si falla la firma, seguimos con la versión sin firma XAdES
      }
    }

    // Generar XML LROE para envío a Batuz
    const lroeXml = generateLROEXml(ticketbaiInvoice, result.ticketbaiId, finalSignature);

    // Guardar datos provisionales
    await db.execute({
      sql: `UPDATE invoices SET 
        ticketbai_id = ?, 
        ticketbai_signature = ?, 
        ticketbai_qr = ?, 
        status = 'pending_batuz',
        updated_at = datetime('now') 
      WHERE id = ?`,
      args: [result.ticketbaiId, finalSignature, result.qrCode, invoiceId],
    });

    return NextResponse.json({
      ticketbaiId: result.ticketbaiId,
      signature: finalSignature,
      qrCode: result.qrCode,
      xml: finalXml,
      lroeXml: lroeXml,
      firmadoConCertificado,
      message: firmadoConCertificado 
        ? "XML firmado con certificado digital XAdES-EPES. Listo para enviar a Batuz."
        : "XML generado sin firma digital. Descarga y sube a Batuz para que lo firme.",
      instructions: firmadoConCertificado
        ? [
            "1. El XML ya esta firmado con tu certificado digital",
            "2. Descarga el XML firmado",
            "3. Subelo a Batuz (https://batuz.eus) en 'Alta de facturas emitidas'",
            "4. Batuz validara la firma y registrara la factura",
            "5. Confirma los datos cuando Batuz acepte la factura",
          ]
        : [
            "1. Descarga el archivo XML de TicketBAI",
            "2. Entra en Batuz (https://batuz.eus) con tu certificado digital",
            "3. Sube el XML en 'Alta de facturas emitidas'",
            "4. Batuz generara la firma digital y el QR definitivo",
            "5. Copia el codigo TBAI y firma que te da Batuz",
            "6. Vuelve aqui y confirma los datos reales de Batuz",
          ],
    });
  } catch (error) {
    console.error("TicketBAI error:", error);
    return NextResponse.json(
      { error: "Error al generar TicketBAI" },
      { status: 500 }
    );
  }
}
