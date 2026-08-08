import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildBudgetDraft } from "../autonomo360/budget-draft";
import { parseIntent } from "../autonomo360/intent-parser";
import type { ParsedIntent } from "../autonomo360/intent-schema";

describe("budget-draft: buildBudgetDraft", () => {
  test("intent correcto genera payload exitoso", () => {
    const intent = parseIntent("Presupuesto para Juan García. 6 horas a 35 euros");
    const result = buildBudgetDraft(intent);
    assert.equal(result.success, true);
    assert.ok(result.payload);
    assert.equal(result.payload!.status, "draft");
    assert.ok(result.payload!.items.length > 0);
    assert.ok(result.preview);
    assert.ok(result.preview!.subtotal > 0);
  });

  test("intent sin líneas genera error", () => {
    const intent = parseIntent("Presupuesto para alguien");
    const result = buildBudgetDraft(intent);
    assert.equal(result.success, false);
    assert.ok(result.errors.length > 0);
    assert.equal(result.payload, null);
  });

  test("intent type incorrecto genera error", () => {
    const fakeIntent: ParsedIntent = {
      type: "query_client",
      security: "READ",
      confidence: 0.8,
      fields: {},
      rawInput: "buscar cliente",
      missingFields: [],
      isDraft: true,
    };
    const result = buildBudgetDraft(fakeIntent);
    assert.equal(result.success, false);
    assert.ok(result.errors[0].includes("query_client"));
  });

  test("payload siempre tiene status draft", () => {
    const intent = parseIntent("Presupuesto para Test. 1 hora a 50 euros");
    const result = buildBudgetDraft(intent);
    if (result.payload) {
      assert.equal(result.payload.status, "draft");
    }
  });

  test("cálculos de preview son correctos", () => {
    const intent: ParsedIntent = {
      type: "create_budget",
      security: "CONFIRM_REQUIRED",
      confidence: 0.85,
      fields: {
        clientName: "Test",
        lines: [
          { description: "Trabajo", quantity: 10, unitPrice: 50 },
          { description: "Material", quantity: 1, unitPrice: 200 },
        ],
        taxRate: 21,
      },
      rawInput: "test",
      missingFields: [],
      isDraft: true,
    };
    const result = buildBudgetDraft(intent);
    assert.equal(result.success, true);
    assert.equal(result.preview!.subtotal, 700);
    assert.equal(result.preview!.taxAmount, 147);
    assert.equal(result.preview!.total, 847);
    assert.equal(result.preview!.lineCount, 2);
  });

  test("sin cliente genera warning pero no error", () => {
    const intent: ParsedIntent = {
      type: "create_budget",
      security: "CONFIRM_REQUIRED",
      confidence: 0.85,
      fields: {
        lines: [{ description: "Servicio", quantity: 1, unitPrice: 100 }],
      },
      rawInput: "test",
      missingFields: ["clientName"],
      isDraft: true,
    };
    const result = buildBudgetDraft(intent);
    assert.equal(result.success, true);
    assert.ok(result.warnings.length > 0);
    assert.equal(result.payload!.client_id, null);
  });

  test("cantidad negativa genera error de validación", () => {
    const intent: ParsedIntent = {
      type: "create_budget",
      security: "CONFIRM_REQUIRED",
      confidence: 0.85,
      fields: {
        clientName: "Test",
        lines: [{ description: "Algo", quantity: -1, unitPrice: 50 }],
      },
      rawInput: "test",
      missingFields: [],
      isDraft: true,
    };
    const result = buildBudgetDraft(intent);
    assert.equal(result.success, false);
    assert.ok(result.errors.some((e) => e.includes("positiva")));
  });

  test("precio excesivo genera error de validación", () => {
    const intent: ParsedIntent = {
      type: "create_budget",
      security: "CONFIRM_REQUIRED",
      confidence: 0.85,
      fields: {
        clientName: "Test",
        lines: [{ description: "Algo", quantity: 1, unitPrice: 2_000_000 }],
      },
      rawInput: "test",
      missingFields: [],
      isDraft: true,
    };
    const result = buildBudgetDraft(intent);
    assert.equal(result.success, false);
    assert.ok(result.errors.some((e) => e.includes("excesivamente alto")));
  });

  test("no persiste durante preview (payload es solo datos)", () => {
    const intent = parseIntent("Presupuesto para Ana Pérez. 3 horas a 40 euros");
    const result = buildBudgetDraft(intent);
    // El payload es un objeto plano sin métodos de persistencia
    assert.equal(typeof result.payload, "object");
    assert.equal(typeof (result.payload as unknown as Record<string, unknown>).save, "undefined");
  });
});
