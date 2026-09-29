import test from "node:test";
import assert from "node:assert/strict";
import {
  interpretarFaltantes,
  formatearPendientes,
  respuestaPendientes,
  singularizar,
  normalizarProducto,
  type PartidaFaltante,
} from "../faltantes-obra";

/**
 * P0-3 — FALTANTES DE OBRA POR VOZ
 *
 * Estas pruebas fijan EXACTAMENTE el comportamiento pedido en el encargo, con las
 * frases literales que se van a dictar en la QA del móvil.
 */

test("frase obligatoria: 4 partidas con producto, cantidad y unidad correctos", () => {
  const r = interpretarFaltantes(
    "Apunta que para este trabajo me faltan 20 metros de cable, dos cajas, diez tornillos y silicona."
  );
  assert.equal(r.tipo, "agregar");
  if (r.tipo !== "agregar") return;
  assert.deepEqual(r.partidas, [
    { producto: "Cable", cantidad: 20, unidad: "m" },
    { producto: "Caja", cantidad: 2, unidad: "ud" },
    { producto: "Tornillo", cantidad: 10, unidad: "ud" },
    { producto: "Silicona", cantidad: 1, unidad: "ud" },
  ]);
});

test("'ya tengo' identifica los materiales conseguidos", () => {
  const r = interpretarFaltantes("Ya tengo las cajas y los tornillos.");
  assert.equal(r.tipo, "conseguido");
  if (r.tipo !== "conseguido") return;
  assert.deepEqual(r.productos, ["Caja", "Tornillo"]);
});

test("'ya tengo' entiende el singular y el artículo determinado", () => {
  const r = interpretarFaltantes("Ya tengo el cable");
  assert.equal(r.tipo, "conseguido");
  if (r.tipo !== "conseguido") return;
  assert.deepEqual(r.productos, ["Cable"]);
});

test("la pregunta por lo que falta se reconoce como consulta", () => {
  const r = interpretarFaltantes("¿Qué me falta para esta obra?");
  assert.equal(r.tipo, "consulta");
});

test("respuesta EXACTA de lo pendiente: 20 m de cable y 1 ud de silicona", () => {
  const pendientes: PartidaFaltante[] = [
    { producto: "Cable", cantidad: 20, unidad: "m" },
    { producto: "Silicona", cantidad: 1, unidad: "ud" },
  ];
  assert.deepEqual(formatearPendientes(pendientes), ["20 m de cable", "1 ud de silicona"]);
  assert.equal(respuestaPendientes(pendientes), "Te falta 20 m de cable y 1 ud de silicona.");
});

test("sin pendientes la respuesta lo dice, no se queda muda", () => {
  assert.equal(respuestaPendientes([]), "No falta nada: tienes todo lo apuntado para esta obra.");
});

test("número compuesto dictado: 'treinta y cinco' es 35, no dos partidas", () => {
  const r = interpretarFaltantes("Me faltan treinta y cinco metros de cable");
  assert.equal(r.tipo, "agregar");
  if (r.tipo !== "agregar") return;
  assert.equal(r.partidas.length, 1);
  assert.equal(r.partidas[0].cantidad, 35);
  assert.equal(r.partidas[0].unidad, "m");
});

test("envases: 'dos rollos de cable' no pierde el envase al singularizar", () => {
  const r = interpretarFaltantes("Necesito dos rollos de cable");
  assert.equal(r.tipo, "agregar");
  if (r.tipo !== "agregar") return;
  assert.deepEqual(r.partidas, [{ producto: "Rollo de cable", cantidad: 2, unidad: "ud" }]);
});

test("varias partidas con cantidades y unidades mezcladas", () => {
  const r = interpretarFaltantes(
    "Apúntame que me faltan 3 cajas de mecanismos, 5 interruptores, 12 metros de tubo y 2 kilos de yeso"
  );
  assert.equal(r.tipo, "agregar");
  if (r.tipo !== "agregar") return;
  assert.deepEqual(r.partidas, [
    { producto: "Caja de mecanismos", cantidad: 3, unidad: "ud" },
    { producto: "Interruptor", cantidad: 5, unidad: "ud" },
    { producto: "Tubo", cantidad: 12, unidad: "m" },
    { producto: "Yeso", cantidad: 2, unidad: "kg" },
  ]);
});

test("texto sin material cuantificado NO se interpreta como lista", () => {
  const r = interpretarFaltantes("Hola buenos días");
  assert.equal(r.tipo, "desconocido");
});

test("singularización de materiales reales", () => {
  assert.equal(singularizar("cajas"), "caja");
  assert.equal(singularizar("tornillos"), "tornillo");
  assert.equal(singularizar("cables"), "cable");
  assert.equal(singularizar("diferenciales"), "diferencial");
  assert.equal(singularizar("interruptores"), "interruptor");
  assert.equal(singularizar("enchufes"), "enchufe");
  assert.equal(singularizar("gas"), "gas");
  assert.equal(normalizarProducto("cajas de registro"), "Caja de registro");
});

test("los acentos del dictado no cambian el resultado", () => {
  const conAcentos = interpretarFaltantes("Me faltan dos cajas y silicona");
  const sinAcentos = interpretarFaltantes("me faltan dos cajas y silicona");
  assert.deepEqual(conAcentos, sinAcentos);
});
