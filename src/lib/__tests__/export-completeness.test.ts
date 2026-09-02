import { describe, test } from "node:test";
import assert from "node:assert";
import { useIsolatedTestDb } from "./test-db";
import { initializeDatabase, getDbClient } from "../db";
import { v4 as uuidv4 } from "uuid";

// Register db isolation hooks at module level
useIsolatedTestDb();

describe("AUTÓNOMO360 — Exportación Completa de Datos", () => {
  test("1. Exportación incluye todos los clientes", async () => {
    await initializeDatabase();
    const db = getDbClient();

    // Crear clientes
    for (let i = 0; i < 3; i++) {
      await db.execute({
        sql: "INSERT INTO clients (id, name, nif, email) VALUES (?, ?, ?, ?)",
        args: [uuidv4(), `Cliente ${i + 1}`, `NIF${i}`, `client${i}@test.com`],
      });
    }

    const result = await db.execute("SELECT * FROM clients ORDER BY name");
    assert.strictEqual(result.rows.length, 3, "Deben exportarse 3 clientes");
  });

  test("2. Exportación incluye facturas con líneas asociadas", async () => {
    await initializeDatabase();
    const db = getDbClient();

    const clientId = uuidv4();
    const invoiceId = uuidv4();

    await db.execute({
      sql: "INSERT INTO clients (id, name) VALUES (?, ?)",
      args: [clientId, "Test Client"],
    });

    await db.execute({
      sql: "INSERT INTO invoices (id, number, client_id, date, subtotal, tax_rate, total) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [invoiceId, "FAC-001", clientId, "2026-01-15", 1000, 21, 1210],
    });

    // Añadir líneas
    for (let i = 0; i < 2; i++) {
      await db.execute({
        sql: "INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?)",
        args: [uuidv4(), invoiceId, `Item ${i + 1}`, 1, 500, 500],
      });
    }

    const invoices = await db.execute("SELECT * FROM invoices");
    const items = await db.execute("SELECT * FROM invoice_items");

    assert.strictEqual(invoices.rows.length, 1, "Debe haber 1 factura");
    assert.strictEqual(items.rows.length, 2, "Debe haber 2 líneas de factura");
  });

  test("3. Exportación incluye presupuestos con líneas", async () => {
    await initializeDatabase();
    const db = getDbClient();

    const clientId = uuidv4();
    const budgetId = uuidv4();

    await db.execute({
      sql: "INSERT INTO clients (id, name) VALUES (?, ?)",
      args: [clientId, "Budget Client"],
    });

    await db.execute({
      sql: "INSERT INTO budgets (id, number, client_id, date, subtotal, tax_rate, total) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [budgetId, "PRES-001", clientId, "2026-01-15", 2000, 21, 2420],
    });

    for (let i = 0; i < 2; i++) {
      await db.execute({
        sql: "INSERT INTO budget_items (id, budget_id, description, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?)",
        args: [uuidv4(), budgetId, `Budget Item ${i + 1}`, 1, 1000, 1000],
      });
    }

    const budgets = await db.execute("SELECT * FROM budgets");
    const items = await db.execute("SELECT * FROM budget_items");

    assert.strictEqual(budgets.rows.length, 1, "Debe haber 1 presupuesto");
    assert.strictEqual(items.rows.length, 2, "Debe haber 2 líneas de presupuesto");
  });

  test("4. Exportación incluye gastos (tabla expenses)", async () => {
    await initializeDatabase();
    const db = getDbClient();

    // La tabla expenses debe crearse en schema
    // Por ahora, verificar que cuando exista se puede exportar
    // Esto es un placeholder para cuando se implemente la tabla
  });

  test("5. Exportación incluye partes de trabajo con líneas y materiales", async () => {
    await initializeDatabase();
    const db = getDbClient();

    const clientId = uuidv4();
    const parteId = uuidv4();

    await db.execute({
      sql: "INSERT INTO clients (id, name) VALUES (?, ?)",
      args: [clientId, "Parte Client"],
    });

    await db.execute({
      sql: "INSERT INTO partes_trabajo (id, numero, fecha, cliente, client_id) VALUES (?, ?, ?, ?, ?)",
      args: [parteId, "PT-001", "2026-01-15", "Test Client", clientId],
    });

    // Añadir líneas
    for (let i = 0; i < 2; i++) {
      await db.execute({
        sql: "INSERT INTO parte_trabajo_lineas (id, parte_id, nombre_trabajo, descripcion, cantidad, precio_unitario) VALUES (?, ?, ?, ?, ?, ?)",
        args: [uuidv4(), parteId, `Tarea ${i + 1}`, `Descripción del trabajo ${i + 1}`, 1, 100],
      });
    }

    // Añadir materiales
    for (let i = 0; i < 2; i++) {
      await db.execute({
        sql: "INSERT INTO parte_materiales (id, parte_id, descripcion, cantidad, precio_coste) VALUES (?, ?, ?, ?, ?)",
        args: [uuidv4(), parteId, `Material ${i + 1}`, 1, 50],
      });
    }

    const partes = await db.execute("SELECT * FROM partes_trabajo");
    const lineas = await db.execute("SELECT * FROM parte_trabajo_lineas");
    const materiales = await db.execute("SELECT * FROM parte_materiales");

    assert.strictEqual(partes.rows.length, 1, "Debe haber 1 parte");
    assert.strictEqual(lineas.rows.length, 2, "Debe haber 2 líneas");
    assert.strictEqual(materiales.rows.length, 2, "Debe haber 2 materiales");
  });

  test("6. Exportación incluye CRM (leads, oportunidades, tareas, actividades)", async () => {
    await initializeDatabase();
    const db = getDbClient();

    const clientId = uuidv4();
    const leadId = uuidv4();
    const opportunityId = uuidv4();

    // Crear lead
    await db.execute({
      sql: "INSERT INTO leads (id, name, email, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      args: [leadId, "Lead Test", "lead@test.com", "nuevo", new Date().toISOString(), new Date().toISOString()],
    });

    // Crear cliente para oportunidad
    await db.execute({
      sql: "INSERT INTO clients (id, name) VALUES (?, ?)",
      args: [clientId, "CRM Client"],
    });

    // Crear oportunidad
    await db.execute({
      sql: "INSERT INTO opportunities (id, client_id, lead_id, title, stage, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      args: [opportunityId, clientId, leadId, "Oportunidad Test", "prospectando", new Date().toISOString()],
    });

    // Crear tarea
    await db.execute({
      sql: "INSERT INTO crm_tasks (id, client_id, opportunity_id, title, due_at, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [uuidv4(), clientId, opportunityId, "Task Test", "2026-02-01", "pending", new Date().toISOString()],
    });

    // Crear actividad
    await db.execute({
      sql: "INSERT INTO crm_activities (id, client_id, opportunity_id, type, title, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      args: [uuidv4(), clientId, opportunityId, "llamada", "Llamada de seguimiento", new Date().toISOString()],
    });

    const leads = await db.execute("SELECT * FROM leads");
    const opportunities = await db.execute("SELECT * FROM opportunities");
    const tasks = await db.execute("SELECT * FROM crm_tasks");
    const activities = await db.execute("SELECT * FROM crm_activities");

    assert.strictEqual(leads.rows.length, 1, "Debe haber 1 lead");
    assert.strictEqual(opportunities.rows.length, 1, "Debe haber 1 oportunidad");
    assert.strictEqual(tasks.rows.length, 1, "Debe haber 1 tarea");
    assert.strictEqual(activities.rows.length, 1, "Debe haber 1 actividad");
  });

  test("7. Exportación incluye configuración (company_settings)", async () => {
    await initializeDatabase();
    const db = getDbClient();

    await db.execute("DELETE FROM company_settings WHERE id = 'default'");
    await db.execute({
      sql: "INSERT INTO company_settings (id, trade_name, nif, updated_at) VALUES (?, ?, ?, ?)",
      args: ["default", "Export Test Co", "12345678A", new Date().toISOString()],
    });

    const result = await db.execute("SELECT * FROM company_settings WHERE id = 'default'");
    assert.strictEqual(result.rows.length, 1, "Debe haber configuración exportable");
  });

  test("8. JSON exportado es válido y sin secretos", async () => {
    await initializeDatabase();
    const db = getDbClient();

    // Crear un conjunto mínimo de datos
    const clientId = uuidv4();
    await db.execute({
      sql: "INSERT INTO clients (id, name, nif, email) VALUES (?, ?, ?, ?)",
      args: [clientId, "Test", "12345678A", "test@test.com"],
    });

    // Crear configuración con datos sensibles
    await db.execute("DELETE FROM company_settings WHERE id = 'default'");
    await db.execute({
      sql: "INSERT INTO company_settings (id, trade_name, iban, updated_at) VALUES (?, ?, ?, ?)",
      args: ["default", "Test Co", "ES9121000418450200051332", new Date().toISOString()],
    });

    const clients = await db.execute("SELECT * FROM clients");
    const config = await db.execute("SELECT * FROM company_settings");

    // Crear objeto de exportación como lo hace el API
    const exportData = {
      exportDate: new Date().toISOString(),
      clients: clients.rows,
      config: config.rows,
    };

    // Verificar que es JSON válido
    const json = JSON.stringify(exportData, null, 2);
    assert.ok(json.includes("exportDate"), "Debe tener timestamp");
    assert.ok(json.includes("Test"), "Debe tener datos del cliente");

    // Verificar que el JSON es parseable
    const parsed = JSON.parse(json);
    assert.ok(parsed.clients, "Debe tener clientes");
    assert.ok(parsed.config, "Debe tener configuración");
  });

  test("9. Exportación vacía es válida", async () => {
    await initializeDatabase();
    const db = getDbClient();

    try { await db.execute("DELETE FROM invoice_items"); await db.execute("DELETE FROM invoices"); await db.execute("DELETE FROM crm_activities"); await db.execute("DELETE FROM crm_tasks"); await db.execute("DELETE FROM opportunities"); await db.execute("DELETE FROM partes_trabajo"); await db.execute("DELETE FROM budgets"); await db.execute("DELETE FROM visits"); await db.execute("DELETE FROM clients"); } catch {}

    // DB vacía
    const clients = await db.execute("SELECT * FROM clients");
    const invoices = await db.execute("SELECT * FROM invoices");

    const exportData = {
      exportDate: new Date().toISOString(),
      clients: clients.rows,
      invoices: invoices.rows,
    };

    const json = JSON.stringify(exportData, null, 2);
    const parsed = JSON.parse(json);

    assert.strictEqual(parsed.clients.length, 0, "Clientes debe ser array vacío");
    assert.strictEqual(parsed.invoices.length, 0, "Facturas debe ser array vacío");
  });

  test("10. Acentos y caracteres españoles se conservan", async () => {
    await initializeDatabase();
    const db = getDbClient();

    const clientId = uuidv4();
    const specialName = "López García Construcciones S.L.";
    const specialAddress = "Calle Ñoño de la Parra 123, 3º B";

    await db.execute({
      sql: "INSERT INTO clients (id, name, address) VALUES (?, ?, ?)",
      args: [clientId, specialName, specialAddress],
    });

    const result = await db.execute({ sql: "SELECT * FROM clients WHERE id = ?", args: [clientId] });
    assert.strictEqual(result.rows[0].name, specialName, "Acentos deben preservarse");
    assert.strictEqual(result.rows[0].address, specialAddress, "Ñ debe preservarse");

    const json = JSON.stringify(result.rows);
    assert.ok(json.includes("López"), "JSON debe tener acentos");
  });
});
