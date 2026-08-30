import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase, generateInvoiceNumber } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import type { Transaction } from "@libsql/client";

const CONVERTIBLE_STATUSES = ["completado", "TRABAJO_COMPLETADO"] as const;
type ConvertibleStatus = (typeof CONVERTIBLE_STATUSES)[number];

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error || "");
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await initializeDatabase();
  const db = getDbClient();
  const { id } = await params;

  const MAX_ATTEMPTS = 5;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let tx: Transaction | null = null;

    try {
      // Iniciar transacción interactiva de escritura real
      tx = await db.transaction("write");

      // 1. Comprobar si ya existe una factura vinculada por source_part_id
      const existingBySource = await tx.execute({
        sql: "SELECT id, number FROM invoices WHERE source_part_id = ? LIMIT 1",
        args: [id],
      });

      if (existingBySource.rows.length > 0) {
        await tx.rollback();
        return NextResponse.json(
          {
            error: "Este parte de trabajo ya ha sido facturado",
            invoiceId: String(existingBySource.rows[0].id),
          },
          { status: 409 }
        );
      }

      // 2. Cargar el parte de trabajo dentro de la transacción
      const parteResult = await tx.execute({
        sql: "SELECT * FROM partes_trabajo WHERE id = ?",
        args: [id],
      });

      if (parteResult.rows.length === 0) {
        await tx.rollback();
        return NextResponse.json(
          { error: "Parte de trabajo no encontrado" },
          { status: 404 }
        );
      }

      const parte = parteResult.rows[0];
      const estadoParte = String(parte.estado);

      // 3. Comprobar si el parte ya tiene estado 'facturado'
      if (estadoParte === "facturado") {
        const fallbackInvoice = await tx.execute({
          sql: "SELECT id FROM invoices WHERE source_part_id = ? LIMIT 1",
          args: [id],
        });
        await tx.rollback();
        return NextResponse.json(
          {
            error: "Este parte de trabajo ya ha sido facturado",
            invoiceId: fallbackInvoice.rows[0]?.id ? String(fallbackInvoice.rows[0].id) : undefined,
          },
          { status: 409 }
        );
      }

      // 4. Validar estado convertible sin casts no seguros
      const isConvertible = CONVERTIBLE_STATUSES.some((st) => st === (estadoParte as ConvertibleStatus));
      if (!isConvertible) {
        await tx.rollback();
        return NextResponse.json(
          {
            error: `Solo se pueden facturar partes terminados (completado). Estado actual: ${estadoParte}`,
          },
          { status: 422 }
        );
      }

      // 5. Validar client_id válido y existente
      if (!parte.client_id) {
        await tx.rollback();
        return NextResponse.json(
          {
            error: "El parte no tiene un cliente asignado. Asigna un cliente registrado antes de generar la factura.",
          },
          { status: 422 }
        );
      }

      const clientCheck = await tx.execute({
        sql: "SELECT id FROM clients WHERE id = ?",
        args: [parte.client_id],
      });

      if (clientCheck.rows.length === 0) {
        await tx.rollback();
        return NextResponse.json(
          {
            error: "El cliente asignado al parte no existe en la base de datos.",
          },
          { status: 422 }
        );
      }

      const clientId = String(parte.client_id);

      // 6. Cargar líneas de mano de obra y materiales dentro de la transacción
      const trabajosResult = await tx.execute({
        sql: "SELECT * FROM parte_trabajo_lineas WHERE parte_id = ? ORDER BY sort_order ASC",
        args: [id],
      });

      const materialesResult = await tx.execute({
        sql: "SELECT * FROM parte_materiales WHERE parte_id = ? ORDER BY sort_order ASC",
        args: [id],
      });

      // 7. Validar y construir líneas de factura
      interface InvoiceItemDraft {
        id: string;
        description: string;
        quantity: number;
        unit_price: number;
        total: number;
        sort_order: number;
      }

      const items: InvoiceItemDraft[] = [];
      let sortOrder = 0;

      for (const t of trabajosResult.rows) {
        const desc = t.nombre_trabajo && t.descripcion
          ? `${t.nombre_trabajo}: ${t.descripcion}`
          : String(t.nombre_trabajo || t.descripcion || "").trim();

        if (!desc) continue;

        const qty = Number(t.cantidad);
        const price = Number(t.precio_unitario);

        if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0) {
          await tx.rollback();
          return NextResponse.json(
            { error: `Línea de trabajo con valores numéricos inválidos o negativos: "${desc}"` },
            { status: 422 }
          );
        }

        const total = Number((qty * price).toFixed(2));

        items.push({
          id: uuidv4(),
          description: desc,
          quantity: qty,
          unit_price: price,
          total,
          sort_order: sortOrder++,
        });
      }

      for (const m of materialesResult.rows) {
        const desc = m.nombre_material && m.descripcion
          ? `${m.nombre_material}: ${m.descripcion}`
          : String(m.nombre_material || m.descripcion || "").trim();

        if (!desc) continue;

        const qty = Number(m.cantidad);
        const price = Number(m.precio_unitario);

        if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0) {
          await tx.rollback();
          return NextResponse.json(
            { error: `Línea de material con valores numéricos inválidos o negativos: "${desc}"` },
            { status: 422 }
          );
        }

        const total = Number((qty * price).toFixed(2));

        items.push({
          id: uuidv4(),
          description: desc,
          quantity: qty,
          unit_price: price,
          total,
          sort_order: sortOrder++,
        });
      }

      if (items.length === 0) {
        await tx.rollback();
        return NextResponse.json(
          { error: "El parte de trabajo no tiene líneas de trabajo o materiales facturables válidas." },
          { status: 422 }
        );
      }

      // 8. Cálculos económicos con redondeo explícito
      const subtotalBruto = Number(items.reduce((acc, it) => acc + it.total, 0).toFixed(2));
      const descuentoRate = Number(parte.descuento) || 0;

      if (!Number.isFinite(descuentoRate) || descuentoRate < 0 || descuentoRate > 100) {
        await tx.rollback();
        return NextResponse.json(
          { error: "Porcentaje de descuento inválido (debe estar entre 0 y 100)." },
          { status: 422 }
        );
      }

      const descuentoAmount = Number(((subtotalBruto * descuentoRate) / 100).toFixed(2));
      const baseImponible = Number((subtotalBruto - descuentoAmount).toFixed(2));
      const taxRate = parte.iva_rate !== null && parte.iva_rate !== undefined ? Number(parte.iva_rate) : 21;

      if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
        await tx.rollback();
        return NextResponse.json(
          { error: "Tipo de IVA inválido (debe estar entre 0 y 100)." },
          { status: 422 }
        );
      }

      const taxAmount = Number(((baseImponible * taxRate) / 100).toFixed(2));
      const totalFinal = Number((baseImponible + taxAmount).toFixed(2));

      const now = new Date().toISOString();
      const today = now.split("T")[0];
      const invoiceId = uuidv4();

      // 9. Generar correlativo utilizando la transacción interactiva como ejecutor
      const invoiceNumber = await generateInvoiceNumber(tx);
      const notes = parte.observaciones
        ? `Facturado desde parte ${parte.numero}. ${parte.observaciones}`
        : `Facturado desde parte ${parte.numero}.`;

      // 10. Insertar cabecera de factura (utiliza DEFAULT del esquema para payment_method sin inventar datos)
      await tx.execute({
        sql: `INSERT INTO invoices (id, number, client_id, date, due_date, status, subtotal, tax_rate, tax_amount, total, notes, source_part_id, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          invoiceId,
          invoiceNumber,
          clientId,
          today,
          null,
          "draft",
          baseImponible,
          taxRate,
          taxAmount,
          totalFinal,
          notes,
          id,
          now,
          now,
        ],
      });

      // 11. Insertar líneas de factura dentro de la transacción
      for (const it of items) {
        await tx.execute({
          sql: `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total, discount, discount_type, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            it.id,
            invoiceId,
            it.description,
            it.quantity,
            it.unit_price,
            it.total,
            0,
            "percent",
            it.sort_order,
          ],
        });
      }

      // 12. Actualización condicional del parte con comprobación de rowsAffected
      const updateResult = await tx.execute({
        sql: `UPDATE partes_trabajo SET estado = 'facturado', updated_at = ?
              WHERE id = ? AND estado IN ('completado', 'TRABAJO_COMPLETADO')`,
        args: [now, id],
      });

      if (Number(updateResult.rowsAffected) !== 1) {
        throw new Error("STATE_CONFLICT_ROWS_AFFECTED_ZERO");
      }

      // 13. Obtener el registro de factura dentro de la transacción antes de confirmar
      const createdInvoiceResult = await tx.execute({
        sql: "SELECT * FROM invoices WHERE id = ?",
        args: [invoiceId],
      });

      // 14. Commit definitivo de la transacción
      await tx.commit();

      return NextResponse.json(createdInvoiceResult.rows[0], { status: 201 });
    } catch (err: unknown) {
      if (tx) {
        try {
          await tx.rollback();
        } catch {
          // Transacción cerrada o revertida
        }
      }

      const errStr = getErrorMessage(err);

      if (errStr.includes("STATE_CONFLICT_ROWS_AFFECTED_ZERO")) {
        return NextResponse.json(
          { error: "El parte de trabajo ya no está disponible para facturar (conflicto de estado)." },
          { status: 409 }
        );
      }

      // Si ocurrió una colisión en el índice UNIQUE idx_invoices_source_part_id_unique
      if (
        errStr.includes("idx_invoices_source_part_id_unique") ||
        errStr.includes("invoices.source_part_id")
      ) {
        const existing = await db.execute({
          sql: "SELECT id FROM invoices WHERE source_part_id = ? LIMIT 1",
          args: [id],
        });
        return NextResponse.json(
          {
            error: "Este parte de trabajo ya ha sido facturado",
            invoiceId: existing.rows[0]?.id ? String(existing.rows[0].id) : undefined,
          },
          { status: 409 }
        );
      }

      // Si ocurrió colisión de número entre partes distintos o bloqueo transitorio de SQLite, reintenta
      const isTransientLock =
        errStr.includes("SQLITE_BUSY") ||
        errStr.includes("database is locked") ||
        errStr.includes("SQLITE_BUSY_SNAPSHOT") ||
        errStr.includes("invoices.number");

      if (isTransientLock && attempt < MAX_ATTEMPTS - 1) {
        await new Promise((resolve) => setTimeout(resolve, 40 + Math.random() * 60));
        continue;
      }

      if (errStr.includes("invoices.number")) {
        return NextResponse.json(
          { error: "Conflicto en la correlación de numeración de factura. Por favor, reintenta." },
          { status: 409 }
        );
      }

      console.error("Error en transacción interactiva parte -> factura:", err);
      return NextResponse.json(
        { error: "Error interno al convertir el parte de trabajo a factura" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { error: "No se pudo completar la operación de facturación tras varios intentos." },
    { status: 500 }
  );
}
