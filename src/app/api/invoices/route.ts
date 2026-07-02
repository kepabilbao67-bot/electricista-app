import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase, generateInvoiceNumber } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { generateTicketBAIXml, TICKETBAI_CONFIG } from "@/lib/ticketbai";
import type { TicketBAIInvoice } from "@/lib/ticketbai";

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const clientId = searchParams.get("client_id");

    let query = `
      SELECT invoices.*, clients.name as client_name 
      FROM invoices 
      LEFT JOIN clients ON invoices.client_id = clients.id
    `;
    const conditions: string[] = [];
    const args: string[] = [];

    if (status) {
      conditions.push("invoices.status = ?");
      args.push(status);
    }
    if (clientId) {
      conditions.push("invoices.client_id = ?");
      args.push(clientId);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY invoices.date DESC";

    const result = await db.execute({ sql: query, args });
    return NextResponse.json(result.rows);
  } catch {
    return NextResponse.json(
      { error: "Error al obtener facturas" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const body = await request.json();
    const id = uuidv4();
    const number = await generateInvoiceNumber();

    const subtotal = body.items.reduce(
      (acc: number, item: { quantity: number; unit_price: number; discount?: number; discount_type?: string }) => {
        const gross = item.quantity * item.unit_price;
        if (!item.discount || item.discount <= 0) return acc + gross;
        if (item.discount_type === "eur") return acc + gross - item.discount;
        return acc + gross * (1 - item.discount / 100);
      },
      0
    );
    const taxRate = body.tax_rate ?? 21;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    // TicketBAI fields
    const ticketbaiDescription = body.ticketbai_description || null;
    const ticketbaiTipoOperacion = body.ticketbai_tipo_operacion || null;
    const autoGenerateTbai = body.auto_generate_tbai || false;
    const paymentMethod = body.payment_method || "transferencia";

    await db.execute({
      sql: `INSERT INTO invoices (id, number, client_id, date, due_date, status, subtotal, tax_rate, tax_amount, total, notes, payment_method, ticketbai_description, ticketbai_tipo_operacion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        number,
        body.client_id,
        body.date || new Date().toISOString().split("T")[0],
        body.due_date || null,
        body.status || "draft",
        subtotal,
        taxRate,
        taxAmount,
        total,
        body.notes || null,
        paymentMethod,
        ticketbaiDescription,
        ticketbaiTipoOperacion,
      ],
    });

    for (let i = 0; i < body.items.length; i++) {
      const item = body.items[i];
      const gross = item.quantity * item.unit_price;
      let itemTotal = gross;
      if (item.discount && item.discount > 0) {
        if (item.discount_type === "eur") {
          itemTotal = gross - item.discount;
        } else {
          itemTotal = gross * (1 - item.discount / 100);
        }
      }
      await db.execute({
        sql: `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total, discount, discount_type, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          uuidv4(),
          id,
          item.description,
          item.quantity,
          item.unit_price,
          itemTotal,
          item.discount || 0,
          item.discount_type || "percent",
          i,
        ],
      });
    }

    // Auto-generate TicketBAI if requested
    if (autoGenerateTbai) {
      try {
        // Get client info for TicketBAI
        const clientResult = await db.execute({
          sql: "SELECT * FROM clients WHERE id = ?",
          args: [body.client_id],
        });
        const client = clientResult.rows[0];

        // Get previous invoice for chaining
        const previousResult = await db.execute({
          sql: "SELECT number, date, ticketbai_signature FROM invoices WHERE created_at < (SELECT created_at FROM invoices WHERE id = ?) AND ticketbai_signature IS NOT NULL ORDER BY created_at DESC LIMIT 1",
          args: [id],
        });
        const previousInvoice = previousResult.rows.length > 0 ? previousResult.rows[0] : null;

        const now = new Date();
        const hora = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

        const descripcion = ticketbaiDescription || `Factura ${number} - Servicios electricos`;

        const ticketbaiInvoice: TicketBAIInvoice = {
          serie: TICKETBAI_CONFIG.serie,
          numero: number.replace(TICKETBAI_CONFIG.serie, ""),
          fecha: body.date || new Date().toISOString().split("T")[0],
          hora,
          descripcion,
          emisor: {
            nif: TICKETBAI_CONFIG.emisor.nif,
            nombre: TICKETBAI_CONFIG.emisor.nombre,
          },
          destinatario: client?.nif
            ? {
                nif: client.nif as string,
                nombre: client.name as string,
                direccion: client.address as string | undefined,
                codigoPostal: client.postal_code as string | undefined,
                municipio: client.city as string | undefined,
                provincia: client.province as string | undefined,
              }
            : undefined,
          detalles: body.items
            .filter((i: { description: string; unit_price: number }) => i.description && i.unit_price > 0)
            .map((item: { description: string; quantity: number; unit_price: number }) => ({
              descripcion: item.description,
              cantidad: item.quantity,
              precioUnitario: item.unit_price,
              importe: item.quantity * item.unit_price,
            })),
          importeTotal: total,
          baseImponible: subtotal,
          cuotaIVA: taxAmount,
          tipoIVA: taxRate,
          facturaAnterior: previousInvoice
            ? {
                serie: TICKETBAI_CONFIG.serie,
                numero: (previousInvoice.number as string).replace(TICKETBAI_CONFIG.serie, ""),
                fecha: previousInvoice.date as string,
                firma: previousInvoice.ticketbai_signature as string,
              }
            : undefined,
        };

        const tbaiResult = generateTicketBAIXml(ticketbaiInvoice);

        await db.execute({
          sql: `UPDATE invoices SET ticketbai_id = ?, ticketbai_signature = ?, ticketbai_qr = ?, status = 'sent', updated_at = datetime('now') WHERE id = ?`,
          args: [tbaiResult.ticketbaiId, tbaiResult.signature, tbaiResult.qrCode, id],
        });
      } catch (tbaiError) {
        console.error("Error auto-generating TicketBAI:", tbaiError);
        // Invoice was still created, just without TicketBAI
      }
    }

    const result = await db.execute({
      sql: "SELECT * FROM invoices WHERE id = ?",
      args: [id],
    });
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Error al crear factura" },
      { status: 500 }
    );
  }
}
