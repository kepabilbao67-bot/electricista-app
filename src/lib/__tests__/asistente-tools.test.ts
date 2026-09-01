import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import { setDbClientForTesting, resetDbClient } from "@/lib/db";
import { ASSISTANT_TOOLS, executeAssistantTool } from "../assistant";
import { containsStrictPii } from "../sensitive-text-filter";

describe("Assistant Tools: Schemas", () => {
  test("contiene las 8 herramientas definidas", () => {
    assert.equal(ASSISTANT_TOOLS.length, 8);
  });

  test("todas las herramientas tienen tipo function y esquema de parámetros válido", () => {
    const names = ASSISTANT_TOOLS.map((t) => t.function.name);
    assert.ok(names.includes("query_clients"));
    assert.ok(names.includes("query_budgets"));
    assert.ok(names.includes("query_invoices"));
    assert.ok(names.includes("query_partes"));
    assert.ok(names.includes("query_schedule"));
    assert.ok(names.includes("draft_budget"));
    assert.ok(names.includes("draft_visit"));
    assert.ok(names.includes("draft_client"));

    for (const tool of ASSISTANT_TOOLS) {
      assert.equal(tool.type, "function");
      assert.ok(tool.function.description.length > 10);
      assert.equal(tool.function.parameters.type, "object");
    }
  });
});

describe("Assistant Tools: Minimización y Seguridad de Privacidad", () => {
  before(async () => {
    const testDb = createClient({ url: "file::memory:" });
    setDbClientForTesting(testDb);

    await testDb.execute(`
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        company TEXT,
        phone TEXT,
        email TEXT,
        status TEXT,
        city TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await testDb.execute(`
      CREATE TABLE IF NOT EXISTS visits (
        id TEXT PRIMARY KEY,
        client_id TEXT,
        title TEXT,
        date TEXT,
        time TEXT,
        status TEXT,
        address TEXT,
        notes TEXT
      )
    `);

    await testDb.execute(`
      INSERT INTO clients (id, name, company, phone, email, status, city, notes)
      VALUES ('cli-1', 'Juan Pérez', 'Instalaciones S.L.', '600111222', 'juan@test.com', 'activo', 'Bilbao', 'Nota privada reservada')
    `);

    await testDb.execute(`
      INSERT INTO visits (id, client_id, title, date, time, status, address, notes)
      VALUES ('vis-1', 'cli-1', 'Revisión técnica', '2026-09-05', '10:00', 'scheduled', 'Calle Mayor 12', 'Llave debajo del felpudo')
    `);
  });

  after(() => {
    resetDbClient();
  });

  test("query_clients NO devuelve phone, email, address, city ni notes", async () => {
    const res = await executeAssistantTool("query_clients", { query: "Juan" });
    assert.equal(res.success, true);
    assert.ok(Array.isArray(res.result));
    const row = (res.result as any[])[0];

    assert.ok("id" in row);
    assert.ok("name" in row);
    assert.ok("status" in row);
    assert.equal("phone" in row, false, "phone no debe ser devuelto");
    assert.equal("email" in row, false, "email no debe ser devuelto");
    assert.equal("city" in row, false, "city no debe ser devuelta");
    assert.equal("address" in row, false, "address no debe ser devuelta");
    assert.equal("notes" in row, false, "notes no debe ser devuelta");
  });

  test("query_schedule NO devuelve address, phone ni notes", async () => {
    const res = await executeAssistantTool("query_schedule", { start_date: "2026-09-01", days_ahead: 10 });
    assert.equal(res.success, true);
    assert.ok(Array.isArray(res.result));
    const row = (res.result as any[])[0];

    assert.ok("id" in row);
    assert.ok("date" in row);
    assert.ok("time" in row);
    assert.ok("status" in row);
    assert.equal("address" in row, false, "address no debe ser devuelta");
    assert.equal("phone" in row, false, "phone no debe ser devuelto");
    assert.equal("notes" in row, false, "notes no debe ser devuelta");
  });

  test("limit nunca supera 10 ni admite valores negativos", async () => {
    const resInvalid = await executeAssistantTool("query_clients", { limit: 99 });
    assert.equal(resInvalid.success, false, "limit > 10 debe ser rechazado por Zod");

    const resNegative = await executeAssistantTool("query_clients", { limit: -5 });
    assert.equal(resNegative.success, false, "limit negativo debe ser rechazado por Zod");
  });

  test("argumentos con tipos incorrectos son rechazados", async () => {
    const res = await executeAssistantTool("query_clients", { limit: "no-number" as any });
    assert.equal(res.success, false);
  });

  test("herramientas desconocidas son rechazadas", async () => {
    const res = await executeAssistantTool("non_existing_tool", {});
    assert.equal(res.success, false);
    assert.ok(res.error?.includes("Herramienta desconocida"));
  });

  test("containsStrictPii detecta NIF, IBAN, email y teléfono pero admite fechas, horas e importes", () => {
    assert.equal(containsStrictPii("Mi NIF es 12345678A"), true);
    assert.equal(containsStrictPii("Correo juan@test.com"), true);
    assert.equal(containsStrictPii("Llama al 600111222"), true);
    assert.equal(containsStrictPii("Cuenta ES1234567890123456789012"), true);

    // Permitir expresamente importes, fechas y horas
    assert.equal(containsStrictPii("Presupuesto de 150.50 € para mañana a las 10:30 del 05/09/2026"), false);
    assert.equal(containsStrictPii("Factura número 2026-001 por 450 EUR"), false);
  });

  test("herramientas de borrador NO escriben en la base de datos", async () => {
    const res = await executeAssistantTool("draft_budget", {
      client_name: "Juan Pérez",
      title: "Prueba Borrador",
    });

    assert.equal(res.success, true);
    assert.ok(res.draft);
    assert.equal(res.draft.type, "budget");
  });
});
