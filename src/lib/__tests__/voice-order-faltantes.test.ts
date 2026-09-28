import test from "node:test";
import assert from "node:assert/strict";
import { parseVoiceOrder } from "../voice-order-parser";

/**
 * REGRESIÓN — material faltante dictado con relleno.
 *
 * Defecto medido antes de la corrección:
 *   "Me faltan 10 enchufes y 20 metros de cable" -> ["20 m Cable"]  (perdía los 10 enchufes)
 *   "Me faltan 10 enchufes"                      -> excepción "No se han podido identificar..."
 *
 * Causa: `splitItemSegments` solo retira una lista cerrada de rellenos iniciales
 * ("necesito|quiero|...|me hacen falta") que no incluye "me faltan", y `parseItem`
 * anclaba la cantidad en `^`, así que la partida se descartaba SIN ERROR.
 *
 * El caso importa porque es una PÉRDIDA SILENCIOSA de una partida: lo que se
 * guarda es menos de lo dictado, sin que nada avise.
 */

test("materiales faltantes con relleno: conserva la primera partida", () => {
  const result = parseVoiceOrder("Me faltan 10 enchufes y 20 metros de cable");
  assert.deepEqual(result.items, [
    { quantity: 10, unit: "uds", product: "Enchufes", observations: "" },
    { quantity: 20, unit: "m", product: "Cable", observations: "" },
  ]);
});

test("una sola partida con relleno no se descarta", () => {
  const result = parseVoiceOrder("Me faltan 10 enchufes");
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.items[0], {
    quantity: 10,
    unit: "uds",
    product: "Enchufes",
    observations: "",
  });
});

test("el compuesto con 'y' no se parte: treinta y cinco -> 35", () => {
  const result = parseVoiceOrder("Me faltan treinta y cinco metros de cable");
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].quantity, 35);
  assert.equal(result.items[0].unit, "m");
});

test("unidades de decena alta con relleno: cuarenta y ocho -> 48", () => {
  const result = parseVoiceOrder("Me faltan cuarenta y ocho bridas");
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].quantity, 48);
});

test("cantidades que la segmentación ya conocía pero el parseo no", () => {
  const result = parseVoiceOrder("Me faltan dieciseis enchufes y cien bridas");
  assert.deepEqual(
    result.items.map((i) => [i.quantity, i.product]),
    [
      [16, "Enchufes"],
      [100, "Bridas"],
    ]
  );
});

test("sigue rechazando texto sin productos cuantificados", () => {
  // "para una obra" no es una cantidad: el "una" va introducido por "para".
  assert.throws(() => parseVoiceOrder("Necesito material para una obra"), /identificar/);
});

test("no se rompe el caso completo ya cubierto", () => {
  const result = parseVoiceOrder(
    "Necesito 3 cajas de guantes talla L, 20 metros de cable de 2,5 y dos diferenciales de 40 amperios para mañana.",
    new Date(2026, 8, 11, 10, 0, 0)
  );
  assert.deepEqual(
    result.items.map((i) => `${i.quantity} ${i.unit} ${i.product}`),
    ["3 cajas Guantes talla L", "20 m Cable 2,5 mm²", "2 uds Diferenciales 40 A"]
  );
});

test("'tubo de PVC y cobre' sigue siendo una sola partida", () => {
  const result = parseVoiceOrder("Necesito 5 tubos de PVC y cobre");
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].quantity, 5);
});
