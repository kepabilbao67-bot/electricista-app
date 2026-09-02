import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase, generateParteNumber } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import type { Transaction } from "@libsql/client";

/**
 * AUTÓNOMO360 — Conversión de Presupuesto a Parte de Trabajo
 *
 * Crea un parte de trabajo a partir de un presupuesto existente:
 * 1. Carga el presupuesto y sus líneas.
 * 2. Genera un número correlativo de parte (PT-XXXX).
 * 3. Copia las líneas del presupuesto como parte_trabajo_lineas.
 * 4. Asigna cliente, fecha y vincula converted_parte_id.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const { id: budgetId } = await params;

    let tx: Transaction | null = null;

    try {
      tx = await db.transaction("write");

      const budgetResult = await tx.execute({
        sql: `SELECT budgets.*, clients.name as client_name, clients.phone as client_phone,
                     clients.address as client_address, clients.city as client_city
              FROM budgets
              LEFT JOIN clients ON budgets.client_id = clients.id
              WHERE budgets.id = ?`,
        args: [budgetId],
      });

      if (budgetResult.rows.length === 0) {
        await tx.rollback();
        return NextResponse.json(
          { error: "Presupuesto no encontrado" },
          { status: 404 }
        );
      }

      const budget = budgetResult.rows[0];

      // Obtener líneas del presupuesto
      const itemsResult = await tx.execute({
        sql: "SELECT * FROM budget_items WHERE budget_id = ? ORDER BY sort_order ASC",
        args: [budgetId],
      });

      const parteId = uuidv4();
      const numero = await generateParteNumber();
      const now = new Date().toISOString();
      const today = now.split("T")[0];

      const clientName = String(budget.client_name || "Cliente");
      const clientAddress = [budget.client_address, budget.client_city].filter(Boolean).join(", ");

      // 1. Insertar cabecera del parte de trabajo
      await tx.execute({
        sql: `INSERT INTO partes_trabajo (
          id, numero, fecha, cliente, client_id, direccion, telefono, budget_id,
          estado, observaciones, iva_rate, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'en_curso', ?, ?, ?, ?)`,
        args: [
          parteId,
          numero,
          today,
          clientName,
          budget.client_id ? String(budget.client_id) : null,
          clientAddress || null,
          budget.client_phone ? String(budget.client_phone) : null,
          budgetId,
          `Parte creado desde presupuesto ${budget.number}. ${budget.notes || ""}`.trim(),
          Number(budget.tax_rate ?? 21),
          now,
          now,
        ],
      });

      // 2. Insertar líneas del presupuesto como parte_trabajo_lineas
      let sortOrder = 0;
      for (const item of itemsResult.rows) {
        await tx.execute({
          sql: `INSERT INTO parte_trabajo_lineas (
            id, parte_id, nombre_trabajo, descripcion, cantidad, precio_unitario, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [
            uuidv4(),
            parteId,
            String(item.description || "Trabajo"),
            String(item.description || "Trabajo"),
            Number(item.quantity || 1),
            Number(item.unit_price || 0),
            sortOrder++,
          ],
        });
      }

      // 3. Actualizar presupuesto con converted_parte_id
      try {
        await tx.execute({
          sql: "UPDATE budgets SET converted_parte_id = ?, updated_at = ? WHERE id = ?",
          args: [parteId, now, budgetId],
        });
      } catch {
        // En caso de que la columna opcional no exista
      }

      await tx.commit();

      return NextResponse.json({
        success: true,
        id: parteId,
        numero,
        message: `Parte de trabajo ${numero} creado correctamente`,
      }, { status: 201 });
    } catch (txErr) {
      if (tx) {
        try {
          await tx.rollback();
        } catch {}
      }
      throw txErr;
    }
  } catch (error) {
    console.error("Error al crear parte desde presupuesto:", error);
    return NextResponse.json(
      { error: "Error interno al crear parte de trabajo desde presupuesto" },
      { status: 500 }
    );
  }
}
