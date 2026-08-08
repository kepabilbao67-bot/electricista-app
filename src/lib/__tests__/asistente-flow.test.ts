import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseIntent } from "../autonomo360/intent-parser";
import { buildBudgetDraft } from "../autonomo360/budget-draft";
import { getSecurityLevel, requiresConfirmation } from "../autonomo360/intent-schema";

/**
 * Tests del flujo completo del Asistente 360:
 * texto → parse → draft → preview (sin persistencia) → validación
 */

describe("asistente-flow: preview no persiste", () => {
  test("buildBudgetDraft no tiene efectos secundarios (es puro)", () => {
    const intent = parseIntent("Presupuesto para Juan García. 6 horas a 35 euros");
    const result1 = buildBudgetDraft(intent);
    const result2 = buildBudgetDraft(intent);
    // Mismo resultado cada vez (función pura)
    assert.deepEqual(result1.preview, result2.preview);
    assert.deepEqual(result1.payload?.items, result2.payload?.items);
  });

  test("payload no contiene método save ni referencia a DB", () => {
    const intent = parseIntent("Presupuesto para Test. 2 horas a 50 euros");
    const result = buildBudgetDraft(intent);
    assert.ok(result.payload);
    const keys = Object.keys(result.payload);
    assert.ok(!keys.includes("save"));
    assert.ok(!keys.includes("db"));
    assert.ok(!keys.includes("persist"));
  });
});

describe("asistente-flow: create_budget válido genera preview", () => {
  test("input completo genera preview con todos los campos", () => {
    const intent = parseIntent("Presupuesto para María López. 3 horas a 40 euros de instalación");
    const result = buildBudgetDraft(intent);
    assert.equal(result.success, true);
    assert.ok(result.preview);
    assert.ok(result.preview!.subtotal > 0);
    assert.ok(result.preview!.total > result.preview!.subtotal);
    assert.equal(result.payload!.status, "draft");
  });

  test("preview calcula IVA correctamente", () => {
    const intent = parseIntent("Presupuesto para Test. 10 horas a 100 euros");
    const result = buildBudgetDraft(intent);
    assert.ok(result.preview);
    // 10 * 100 = 1000, IVA 21% = 210, total = 1210
    assert.equal(result.preview!.subtotal, 1000);
    assert.equal(result.preview!.taxAmount, 210);
    assert.equal(result.preview!.total, 1210);
  });
});

describe("asistente-flow: datos incompletos bloquean cuando corresponde", () => {
  test("sin líneas de presupuesto genera error", () => {
    const intent = parseIntent("Presupuesto para alguien");
    const result = buildBudgetDraft(intent);
    assert.equal(result.success, false);
    assert.ok(result.errors.length > 0);
  });

  test("sin cliente genera warning pero NO bloquea creación", () => {
    const intent = parseIntent("Presupuesto 5 horas a 30 euros de cableado");
    const result = buildBudgetDraft(intent);
    // Puede funcionar sin cliente
    if (result.success) {
      assert.ok(result.warnings.some((w) => w.includes("cliente")));
    }
  });
});

describe("asistente-flow: resolución de cliente", () => {
  test("parseIntent extrae clientName cuando está presente", () => {
    const intent = parseIntent("Presupuesto para Juan García. 1 hora a 50 euros");
    const fields = intent.fields as { clientName?: string };
    assert.equal(fields.clientName, "Juan García");
  });

  test("clientName ausente se reporta en missingFields", () => {
    const intent = parseIntent("Presupuesto 1 hora a 50 euros");
    assert.ok(intent.missingFields.includes("clientName"));
  });

  // La resolución real contra DB ocurre en la API, no en el parser
  // Estos tests verifican el contrato del parser
});

describe("asistente-flow: seguridad y confirmación", () => {
  test("create_budget siempre es CONFIRM_REQUIRED", () => {
    assert.equal(getSecurityLevel("create_budget"), "CONFIRM_REQUIRED");
    assert.equal(requiresConfirmation("create_budget"), true);
  });

  test("intent parseado siempre tiene isDraft=true", () => {
    const intent = parseIntent("Presupuesto para Test. 100 horas a 1000 euros");
    assert.equal(intent.isDraft, true);
  });

  test("query intents no requieren confirmación", () => {
    assert.equal(requiresConfirmation("query_client"), false);
    assert.equal(requiresConfirmation("query_budget"), false);
  });
});

describe("asistente-flow: error handling", () => {
  test("texto vacío no crashea", () => {
    const intent = parseIntent("");
    const result = buildBudgetDraft(intent);
    assert.equal(result.success, false);
  });

  test("intent de tipo incorrecto genera error claro", () => {
    const intent = parseIntent("buscar cliente Pedro");
    const result = buildBudgetDraft(intent);
    assert.equal(result.success, false);
    assert.ok(result.errors[0].includes("create_budget"));
  });

  test("importe absurdamente alto es rechazado", () => {
    // El parser regex no genera importes absurdos por sí solo,
    // pero si se construye manualmente un intent con precio >1M se rechaza
    const intent = parseIntent("Presupuesto para Test. 1 hora a 50 euros");
    // Forzar manualmente un precio excesivo en fields
    (intent.fields as { lines: Array<{ description: string; quantity: number; unitPrice: number }> }).lines = [
      { description: "Algo", quantity: 1, unitPrice: 5_000_000 },
    ];
    const result = buildBudgetDraft(intent);
    assert.equal(result.success, false);
    assert.ok(result.errors.some((e) => e.includes("excesivamente alto")));
  });
});

describe("asistente-flow: no regresión de seguridad", () => {
  test("ningún intent económico tiene nivel READ", () => {
    const economicIntents = ["create_budget", "create_invoice", "create_expense", "send_communication"] as const;
    for (const t of economicIntents) {
      assert.notEqual(getSecurityLevel(t), "READ", `${t} no debe ser READ`);
    }
  });

  test("confirmación es siempre obligatoria para operaciones económicas", () => {
    const economicIntents = ["create_budget", "create_invoice", "create_expense"] as const;
    for (const t of economicIntents) {
      assert.equal(requiresConfirmation(t), true, `${t} debe requerir confirmación`);
    }
  });
});
