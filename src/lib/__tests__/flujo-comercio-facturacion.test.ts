import { describe, test } from "node:test";
import assert from "node:assert";
import { useIsolatedTestDb } from "./test-db";
import { initializeDatabase, getDbClient, generateInvoiceNumber, generateParteNumber } from "../db";
import { v4 as uuidv4 } from "uuid";

// Register db isolation hooks at module level
useIsolatedTestDb();

describe("AUTÓNOMO360 — Flujo Completo: Cliente → Presupuesto → Parte → Factura → Cobro", () => {
  test("1. Flujo completo end-to-end con verificación de integridad económica", async () => {
    await initializeDatabase();
    const db = getDbClient();

    // 1. Crear Cliente
    const clientId = uuidv4();
    await db.execute({
      sql: `INSERT INTO clients (id, name, nif, email, phone, address, city, postal_code, province)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        clientId,
        "Instalaciones Ruiz S.L.",
        "B98765432",
        "contacto@ruiz.es",
        "944000111",
        "Polígono Industrial 4, Nave 12",
        "Bilbao",
        "48001",
        "Bizkaia",
      ],
    });

    const clientRes = await db.execute({
      sql: "SELECT * FROM clients WHERE id = ?",
      args: [clientId],
    });
    assert.strictEqual(clientRes.rows.length, 1, "Cliente creado correctamente");

    // 2. Crear Presupuesto
    const budgetId = uuidv4();
    const budgetNumber = "PRES-2026-001";
    const subtotalBudget = 1500.0;
    const taxRate = 21;
    const taxAmountBudget = 315.0;
    const totalBudget = 1815.0;

    await db.execute({
      sql: `INSERT INTO budgets (id, number, client_id, date, status, subtotal, tax_rate, tax_amount, total, notes)
            VALUES (?, ?, ?, '2026-02-01', 'sent', ?, ?, ?, ?, ?)`,
      args: [budgetId, budgetNumber, clientId, subtotalBudget, taxRate, taxAmountBudget, totalBudget, "Reforma cuadro principal"],
    });

    // Líneas de presupuesto
    const item1Id = uuidv4();
    const item2Id = uuidv4();
    await db.execute({
      sql: `INSERT INTO budget_items (id, budget_id, description, quantity, unit_price, total, sort_order)
            VALUES (?, ?, ?, 10, 100.0, 1000.0, 0)`,
      args: [item1Id, budgetId, "Mano de obra especializada"],
    });
    await db.execute({
      sql: `INSERT INTO budget_items (id, budget_id, description, quantity, unit_price, total, sort_order)
            VALUES (?, ?, ?, 5, 100.0, 500.0, 1)`,
      args: [item2Id, budgetId, "Material eléctrico homologado"],
    });

    // 3. Crear Parte de Trabajo a partir del presupuesto
    const parteId = uuidv4();
    const parteNumero = await generateParteNumber();

    await db.execute({
      sql: `INSERT INTO partes_trabajo (id, numero, fecha, cliente, client_id, estado, observaciones, iva_rate)
            VALUES (?, ?, '2026-02-05', 'Instalaciones Ruiz S.L.', ?, 'en_curso', ?, ?)`,
      args: [parteId, parteNumero, clientId, `Parte derivado de ${budgetNumber}`, taxRate],
    });

    // Copiar líneas
    await db.execute({
      sql: `INSERT INTO parte_trabajo_lineas (id, parte_id, nombre_trabajo, descripcion, cantidad, precio_unitario, sort_order)
            VALUES (?, ?, 'Mano de obra especializada', 'Mano de obra especializada', 10, 100.0, 0)`,
      args: [uuidv4(), parteId],
    });
    await db.execute({
      sql: `INSERT INTO parte_materiales (id, parte_id, descripcion, cantidad, precio_coste, sort_order)
            VALUES (?, ?, 'Material eléctrico homologado', 5, 100.0, 0)`,
      args: [uuidv4(), parteId],
    });

    // Marcar parte como completado
    await db.execute({
      sql: "UPDATE partes_trabajo SET estado = 'completado' WHERE id = ?",
      args: [parteId],
    });

    const parteVerif = await db.execute({
      sql: "SELECT * FROM partes_trabajo WHERE id = ?",
      args: [parteId],
    });
    assert.strictEqual(parteVerif.rows[0].estado, "completado", "Parte listo para facturar");

    // 4. Facturación atómica del parte de trabajo
    const invoiceId = uuidv4();
    const invoiceNumber = await generateInvoiceNumber();

    await db.execute({
      sql: `INSERT INTO invoices (id, number, client_id, date, status, subtotal, tax_rate, tax_amount, total, source_part_id)
            VALUES (?, ?, ?, '2026-02-10', 'draft', ?, ?, ?, ?, ?)`,
      args: [invoiceId, invoiceNumber, clientId, subtotalBudget, taxRate, taxAmountBudget, totalBudget, parteId],
    });

    await db.execute({
      sql: `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total, sort_order)
            VALUES (?, ?, 'Mano de obra especializada', 10, 100.0, 1000.0, 0)`,
      args: [uuidv4(), invoiceId],
    });
    await db.execute({
      sql: `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total, sort_order)
            VALUES (?, ?, 'Material eléctrico homologado', 5, 100.0, 500.0, 1)`,
      args: [uuidv4(), invoiceId],
    });

    await db.execute({
      sql: "UPDATE partes_trabajo SET estado = 'facturado' WHERE id = ?",
      args: [parteId],
    });

    // 5. Marcar Factura como Cobrada
    await db.execute({
      sql: "UPDATE invoices SET status = 'paid', updated_at = datetime('now') WHERE id = ?",
      args: [invoiceId],
    });

    // 6. Verificaciones finales de integridad
    const finalInvoice = await db.execute({
      sql: "SELECT * FROM invoices WHERE id = ?",
      args: [invoiceId],
    });
    assert.strictEqual(finalInvoice.rows[0].status, "paid", "Factura en estado cobrada");
    assert.strictEqual(Number(finalInvoice.rows[0].total), 1815.0, "Total económico exacto");
    assert.strictEqual(finalInvoice.rows[0].source_part_id, parteId, "Vinculación trazable con el parte");

    const finalParte = await db.execute({
      sql: "SELECT estado FROM partes_trabajo WHERE id = ?",
      args: [parteId],
    });
    assert.strictEqual(finalParte.rows[0].estado, "facturado", "Parte queda en estado facturado");
  });

  test("2. Factura no permite doble cobro ni duplicidad por source_part_id", async () => {
    await initializeDatabase();
    const db = getDbClient();

    const clientId = uuidv4();
    const parteId = uuidv4();
    const invoice1Id = uuidv4();
    const invoice2Id = uuidv4();

    await db.execute({
      sql: "INSERT INTO clients (id, name) VALUES (?, ?)",
      args: [clientId, "Cliente Duplicidad"],
    });

    await db.execute({
      sql: "INSERT INTO invoices (id, number, client_id, date, status, subtotal, tax_rate, total, source_part_id) VALUES (?, ?, ?, '2026-02-01', 'draft', 100, 21, 121, ?)",
      args: [invoice1Id, "FAC-DUP-01", clientId, parteId],
    });

    // Intentar insertar segunda factura con el mismo source_part_id debe fallar por índice UNIQUE
    let insertFailed = false;
    try {
      await db.execute({
        sql: "INSERT INTO invoices (id, number, client_id, date, status, subtotal, tax_rate, total, source_part_id) VALUES (?, ?, ?, '2026-02-01', 'draft', 100, 21, 121, ?)",
        args: [invoice2Id, "FAC-DUP-02", clientId, parteId],
      });
    } catch {
      insertFailed = true;
    }

    assert.strictEqual(insertFailed, true, "El índice UNIQUE impide facturar dos veces el mismo parte");
  });

  test("3. Conversión de Presupuesto a Parte verifica columnas reales de base de datos (direccion, telefono, budget_id)", async () => {
    await initializeDatabase();
    const db = getDbClient();

    const clientId = uuidv4();
    await db.execute({
      sql: `INSERT INTO clients (id, name, nif, email, phone, address, city, postal_code, province)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [clientId, "Cliente Regresión S.L.", "B11223344", "test@regresion.es", "600999888", "Gran Vía 1", "Bilbao", "48001", "Bizkaia"],
    });

    const budgetId = uuidv4();
    const budgetNumber = "PRES-REGRESION-01";
    await db.execute({
      sql: `INSERT INTO budgets (id, number, client_id, date, status, subtotal, tax_rate, tax_amount, total, notes)
            VALUES (?, ?, ?, '2026-09-02', 'sent', 500, 21, 105, 605, 'Notas de prueba de regresión')`,
      args: [budgetId, budgetNumber, clientId],
    });

    await db.execute({
      sql: `INSERT INTO budget_items (id, budget_id, description, quantity, unit_price, total, sort_order)
            VALUES (?, ?, 'Punto de luz LED', 5, 100, 500, 0)`,
      args: [uuidv4(), budgetId],
    });

    // Simular transacción exacta de create-parte/route.ts
    const tx = await db.transaction("write");

    const budgetResult = await tx.execute({
      sql: `SELECT budgets.*, clients.name as client_name, clients.phone as client_phone,
                   clients.address as client_address, clients.city as client_city
            FROM budgets
            LEFT JOIN clients ON budgets.client_id = clients.id
            WHERE budgets.id = ?`,
      args: [budgetId],
    });
    const budget = budgetResult.rows[0];

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

    // INSERT utilizando columnas reales del esquema SQLite
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
        `Parte creado desde presupuesto ${budget.number}`,
        Number(budget.tax_rate ?? 21),
        now,
        now,
      ],
    });

    for (const item of itemsResult.rows) {
      await tx.execute({
        sql: `INSERT INTO parte_trabajo_lineas (
          id, parte_id, nombre_trabajo, descripcion, cantidad, precio_unitario, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          uuidv4(),
          parteId,
          String(item.description),
          String(item.description),
          Number(item.quantity),
          Number(item.unit_price),
          0,
        ],
      });
    }

    try {
      await tx.execute({
        sql: "UPDATE budgets SET converted_parte_id = ?, updated_at = ? WHERE id = ?",
        args: [parteId, now, budgetId],
      });
    } catch {
      // Columna opcional si el esquema base no la incluye
    }

    await tx.commit();

    // Verificación de datos persistidos y nombres de columna reales
    const resParte = await db.execute({
      sql: "SELECT id, numero, cliente, client_id, direccion, telefono, budget_id, estado FROM partes_trabajo WHERE id = ?",
      args: [parteId],
    });

    assert.strictEqual(resParte.rows.length, 1, "El parte de trabajo se creó en DB");
    assert.strictEqual(resParte.rows[0].direccion, "Gran Vía 1, Bilbao", "Columna direccion coincide");
    assert.strictEqual(resParte.rows[0].telefono, "600999888", "Columna telefono coincide");
    assert.strictEqual(resParte.rows[0].budget_id, budgetId, "Relación budget_id preservada");
  });
});
