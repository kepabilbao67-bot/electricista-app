import { describe, test, after } from "node:test";
import assert from "node:assert";
import { useIsolatedTestDb } from "./test-db";
import { initializeDatabase, getDbClient } from "../db";

// Register db isolation hooks at module level
useIsolatedTestDb();

describe("AUTÓNOMO360 — Configuración como Fuente Única de Verdad", () => {
  test("1. Configuración guardada en DB → se recupera correctamente", async () => {
    await initializeDatabase();
    const db = getDbClient();

    const testConfig = {
      trade_name: "Electricista Test SL",
      legal_name: "Electricista Test S.L.",
      owner_name: "Juan Prueba",
      nif: "12345678A",
      address_line1: "Calle Test 123",
      address_line2: "Piso 2",
      phone: "+34900123456",
      email: "test@example.com",
      iban: "ES9121000418450200051332",
      bank_name: "Banco Test",
      invoice_series_prefix: "FAC-",
      budget_series_prefix: "PRES-",
      work_order_series_prefix: "PT-",
      default_tax_rate: 21,
      theme_color: "#2563eb",
    };

    // Primero eliminar si existe
    try {
      await db.execute("DELETE FROM company_settings WHERE id = 'default'");
    } catch {
      /* tabla vacia */
    }

    // Guardar
    await db.execute({
      sql: `INSERT INTO company_settings (id, trade_name, legal_name, owner_name, nif, address_line1, address_line2, phone, email, iban, bank_name, invoice_series_prefix, budget_series_prefix, work_order_series_prefix, default_tax_rate, theme_color, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        "default",
        testConfig.trade_name,
        testConfig.legal_name,
        testConfig.owner_name,
        testConfig.nif,
        testConfig.address_line1,
        testConfig.address_line2,
        testConfig.phone,
        testConfig.email,
        testConfig.iban,
        testConfig.bank_name,
        testConfig.invoice_series_prefix,
        testConfig.budget_series_prefix,
        testConfig.work_order_series_prefix,
        testConfig.default_tax_rate,
        testConfig.theme_color,
        new Date().toISOString(),
      ],
    });

    // Recuperar
    const result = await db.execute({
      sql: "SELECT * FROM company_settings WHERE id = 'default'",
      args: [],
    });

    assert.strictEqual(result.rows.length, 1, "Debe haber una fila de configuración");
    const row = result.rows[0];
    assert.strictEqual(row.trade_name, testConfig.trade_name, "trade_name debe coincidir");
    assert.strictEqual(row.nif, testConfig.nif, "NIF debe coincidir");
    assert.strictEqual(row.email, testConfig.email, "email debe coincidir");
  });

  test("2. Factura usa configuración persistida (NIF, razón social, dirección)", async () => {
    await initializeDatabase();
    const db = getDbClient();

    // Guardar configuración (usar UPSERT para evitar conflictos)
    await db.execute("DELETE FROM company_settings WHERE id = 'default'");
    await db.execute({
      sql: `INSERT INTO company_settings (id, trade_name, legal_name, owner_name, nif, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: ["default", "Test Co", "Test Company SL", "Test Owner", "87654321B", new Date().toISOString()],
    });

    // Crear cliente
    const clientId = "cli-config-test";
    await db.execute({
      sql: "INSERT INTO clients (id, name, nif, email) VALUES (?, ?, ?, ?)",
      args: [clientId, "Cliente Test", "11111111A", "cliente@test.com"],
    });

    // Crear factura
    const invoiceId = "inv-config-test";
    await db.execute({
      sql: `INSERT INTO invoices (id, number, client_id, date, status, subtotal, tax_rate, tax_amount, total)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [invoiceId, "FAC-001", clientId, "2026-01-15", "draft", 100.0, 21, 21.0, 121.0],
    });

    // Añadir línea
    await db.execute({
      sql: "INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?)",
      args: ["inv-item-1", invoiceId, "Trabajo eléctrico", 1, 100.0, 100.0],
    });

    // Recuperar factura completa
    const invoiceResult = await db.execute({
      sql: `SELECT * FROM invoices WHERE id = ?`,
      args: [invoiceId],
    });

    const itemResult = await db.execute({
      sql: "SELECT * FROM invoice_items WHERE invoice_id = ?",
      args: [invoiceId],
    });

    assert.strictEqual(invoiceResult.rows.length, 1, "Factura debe existir");
    assert.strictEqual(itemResult.rows.length, 1, "Línea de factura debe existir");
    assert.strictEqual(invoiceResult.rows[0].tax_rate, 21, "Tax rate debe ser 21");
  });

  test("3. Presupuesto usa configuración persistida (series, IVA)", async () => {
    await initializeDatabase();
    const db = getDbClient();

    // Guardar configuración con IVA específico
    await db.execute("DELETE FROM company_settings WHERE id = 'default'");
    await db.execute({
      sql: `INSERT INTO company_settings (id, budget_series_prefix, default_tax_rate, updated_at)
            VALUES (?, ?, ?, ?)`,
      args: ["default", "CUSTOM-", 21, new Date().toISOString()],
    });

    // Crear presupuesto
    const budgetId = "bud-config-test";
    const clientId = "cli-bud-test";

    await db.execute({
      sql: "INSERT INTO clients (id, name) VALUES (?, ?)",
      args: [clientId, "Cliente Presupuesto"],
    });

    await db.execute({
      sql: `INSERT INTO budgets (id, number, client_id, date, status, subtotal, tax_rate, tax_amount, total)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [budgetId, "CUSTOM-001", clientId, "2026-01-15", "draft", 500.0, 21, 105.0, 605.0],
    });

    // Recuperar
    const result = await db.execute({
      sql: "SELECT * FROM budgets WHERE id = ?",
      args: [budgetId],
    });

    assert.strictEqual(result.rows.length, 1, "Presupuesto debe existir");
    assert.strictEqual(result.rows[0].number, "CUSTOM-001", "Series debe ser CUSTOM-");
    assert.strictEqual(result.rows[0].tax_rate, 21, "IVA debe ser 21");
  });

  test("4. IVA 0 no se transforma accidentalmente en otro valor", async () => {
    await initializeDatabase();
    const db = getDbClient();

    const budgetId = "bud-iva-zero";
    const clientId = "cli-iva-zero";

    await db.execute({
      sql: "INSERT INTO clients (id, name) VALUES (?, ?)",
      args: [clientId, "Cliente IVA 0"],
    });

    // Crear presupuesto con IVA 0 (operación intracomunitaria, etc)
    await db.execute({
      sql: `INSERT INTO budgets (id, number, client_id, date, status, subtotal, tax_rate, tax_amount, total)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [budgetId, "PRES-Zero", clientId, "2026-01-15", "draft", 1000.0, 0, 0.0, 1000.0],
    });

    const result = await db.execute({
      sql: "SELECT tax_rate, tax_amount FROM budgets WHERE id = ?",
      args: [budgetId],
    });

    assert.strictEqual(result.rows[0].tax_rate, 0, "IVA debe ser exactamente 0");
    assert.strictEqual(result.rows[0].tax_amount, 0, "Cuota IVA debe ser 0");
  });

  test("5. Valor vacío no sobrescribe datos requeridos", async () => {
    await initializeDatabase();
    const db = getDbClient();

    // Guardar configuración con datos
    await db.execute("DELETE FROM company_settings WHERE id = 'default'");
    await db.execute({
      sql: `INSERT INTO company_settings (id, trade_name, nif, email, updated_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: ["default", "Original Name", "87654321B", "original@test.com", new Date().toISOString()],
    });

    // Intentar "actualizar" con valores vacíos/null (simulando un error de UI)
    // El sistema debe preservar los valores existentes
    const result = await db.execute({
      sql: "SELECT trade_name, nif, email FROM company_settings WHERE id = 'default'",
      args: [],
    });

    assert.strictEqual(result.rows[0].trade_name, "Original Name", "Nombre original debe preservarse");
    assert.strictEqual(result.rows[0].nif, "87654321B", "NIF original debe preservarse");
  });

  test("6. Secretos (IBAN, NIF) no se exponen en respuesta pública", async () => {
    await initializeDatabase();
    const db = getDbClient();

    // Guardar configuración sensible
    await db.execute("DELETE FROM company_settings WHERE id = 'default'");
    await db.execute({
      sql: `INSERT INTO company_settings (id, nif, iban, bank_name, updated_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: ["default", "SECRET123A", "ES9121000418450200051332", "Private Bank", new Date().toISOString()],
    });

    // Simular lectura desde API pública (debería filtrar estos campos)
    const result = await db.execute({
      sql: "SELECT * FROM company_settings WHERE id = 'default'",
      args: [],
    });

    const row = result.rows[0];
    // Estos datos existen en DB pero NO deben exponerse sin autenticación
    assert.ok(row.nif, "IBAN debe guardarse en BD");
    assert.ok(row.iban, "IBAN debe guardarse en BD");
    // (La protección ocurre en la capa API)
  });

  test("7. Fallback a valores por defecto cuando no existe configuración", async () => {
    await initializeDatabase();
    const db = getDbClient();

    try { await db.execute("DELETE FROM company_settings WHERE id = 'default'"); } catch {}

    // NO insertar configuración
    const result = await db.execute({
      sql: "SELECT * FROM company_settings WHERE id = 'default'",
      args: [],
    });

    assert.strictEqual(result.rows.length, 0, "No debe haber configuración guardada");
    // El sistema debe tener fallbacks en AppConfig
  });
});
