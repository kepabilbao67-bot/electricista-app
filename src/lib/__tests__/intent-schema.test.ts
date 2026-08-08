import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  getSecurityLevel,
  requiresConfirmation,
  ALL_INTENT_TYPES,
} from "../autonomo360/intent-schema";
import { parseIntent } from "../autonomo360/intent-parser";

// --- intent-schema ---

describe("intent-schema: getSecurityLevel", () => {
  test("create_budget requiere CONFIRM_REQUIRED", () => {
    assert.equal(getSecurityLevel("create_budget"), "CONFIRM_REQUIRED");
  });

  test("create_invoice requiere CONFIRM_REQUIRED", () => {
    assert.equal(getSecurityLevel("create_invoice"), "CONFIRM_REQUIRED");
  });

  test("query_client es READ", () => {
    assert.equal(getSecurityLevel("query_client"), "READ");
  });

  test("unknown es READ", () => {
    assert.equal(getSecurityLevel("unknown"), "READ");
  });

  test("send_communication requiere CONFIRM_REQUIRED", () => {
    assert.equal(getSecurityLevel("send_communication"), "CONFIRM_REQUIRED");
  });
});

describe("intent-schema: requiresConfirmation", () => {
  test("operaciones económicas requieren confirmación", () => {
    assert.equal(requiresConfirmation("create_budget"), true);
    assert.equal(requiresConfirmation("create_invoice"), true);
    assert.equal(requiresConfirmation("create_expense"), true);
  });

  test("consultas no requieren confirmación", () => {
    assert.equal(requiresConfirmation("query_client"), false);
    assert.equal(requiresConfirmation("query_budget"), false);
    assert.equal(requiresConfirmation("query_invoice"), false);
  });

  test("unknown no requiere confirmación", () => {
    assert.equal(requiresConfirmation("unknown"), false);
  });
});

describe("intent-schema: ALL_INTENT_TYPES", () => {
  test("contiene al menos 9 tipos", () => {
    assert.ok(ALL_INTENT_TYPES.length >= 9);
  });

  test("incluye create_budget y unknown", () => {
    assert.ok(ALL_INTENT_TYPES.includes("create_budget"));
    assert.ok(ALL_INTENT_TYPES.includes("unknown"));
  });
});

// --- intent-parser ---

describe("intent-parser: parseIntent", () => {
  test("texto vacío devuelve unknown con confidence 0", () => {
    const result = parseIntent("");
    assert.equal(result.type, "unknown");
    assert.equal(result.confidence, 0);
    assert.equal(result.isDraft, true);
  });

  test("detecta intención create_budget", () => {
    const result = parseIntent("Hazme un presupuesto para Juan García");
    assert.equal(result.type, "create_budget");
    assert.equal(result.security, "CONFIRM_REQUIRED");
    assert.equal(result.isDraft, true);
  });

  test("extrae nombre de cliente", () => {
    const result = parseIntent("Presupuesto para María López por cambio de cuadro");
    assert.equal(result.type, "create_budget");
    assert.equal((result.fields as { clientName?: string }).clientName, "María López");
  });

  test("extrae líneas con cantidad y precio", () => {
    const result = parseIntent(
      "Presupuesto para Juan García. 6 horas a 35 euros y 420 euros de material"
    );
    assert.equal(result.type, "create_budget");
    const fields = result.fields as { lines?: Array<{ quantity: number; unitPrice: number; description: string }> };
    assert.ok(fields.lines && fields.lines.length >= 1);
    // Al menos una línea con cantidad 6 y precio 35
    const horasLine = fields.lines!.find((l) => l.quantity === 6 && l.unitPrice === 35);
    assert.ok(horasLine, "Debe detectar 6 horas a 35 euros");
  });

  test("campos incompletos se reportan en missingFields", () => {
    const result = parseIntent("Hazme un presupuesto");
    assert.equal(result.type, "create_budget");
    assert.ok(result.missingFields.includes("clientName"));
    assert.ok(result.missingFields.includes("lines"));
  });

  test("resultado siempre es draft", () => {
    const result = parseIntent("Crea una factura para Pedro de 500 euros de consultoría");
    assert.equal(result.isDraft, true);
  });

  test("detecta intención de factura", () => {
    const result = parseIntent("Genera una factura");
    assert.equal(result.type, "create_invoice");
  });

  test("detecta intención de nuevo cliente", () => {
    const result = parseIntent("Crear cliente nuevo Antonio Ruiz");
    assert.equal(result.type, "create_client");
  });

  test("importes inválidos: texto sin números no genera líneas", () => {
    const result = parseIntent("Presupuesto para Luis sin detalles de precio");
    const fields = result.fields as { lines?: unknown[] };
    assert.ok(!fields.lines || fields.lines.length === 0);
  });

  test("seguridad: crear presupuesto siempre CONFIRM_REQUIRED", () => {
    const result = parseIntent("Presupuesto para Test 100 horas a 1 euro");
    assert.equal(result.security, "CONFIRM_REQUIRED");
  });
});
