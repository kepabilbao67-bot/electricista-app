import test from "node:test";
import assert from "node:assert/strict";
import { parseVoiceOrder } from "../voice-order-parser";

test("estructura el ejemplo completo y resuelve mañana", () => {
  const result = parseVoiceOrder(
    "Necesito 3 cajas de guantes talla L, 20 metros de cable de 2,5 y dos diferenciales de 40 amperios para mañana.",
    new Date(2026, 8, 11, 10, 0, 0)
  );

  assert.deepEqual(result.items, [
    { quantity: 3, unit: "cajas", product: "Guantes talla L", observations: "" },
    { quantity: 20, unit: "m", product: "Cable 2,5 mm²", observations: "" },
    { quantity: 2, unit: "uds", product: "Diferenciales 40 A", observations: "" },
  ]);
  assert.equal(result.neededDate, "2026-09-12");
  assert.equal(result.neededDateLabel, "mañana");
  assert.equal(result.status, "pending_confirmation");
});

test("acepta cantidades numéricas y una fecha ISO", () => {
  const result = parseVoiceOrder("Pedir 1 rollo de tubo corrugado y 12 enchufes para 2026-10-01");
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].unit, "rollos");
  assert.equal(result.items[1].unit, "uds");
  assert.equal(result.neededDate, "2026-10-01");
});

test("rechaza texto sin productos cuantificados", () => {
  assert.throws(() => parseVoiceOrder("Necesito material para una obra"), /identificar/);
});
