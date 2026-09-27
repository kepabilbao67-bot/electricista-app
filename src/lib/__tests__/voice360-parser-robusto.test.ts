/**
 * VOZ 360 — PARSER DE PRESUPUESTOS CON LENGUAJE REAL (P0)
 *
 * Cubre el fallo reproducido en el móvil:
 *
 *   «quiero hacer un presupuesto de dos bombillas a veinticinco ... cada una 25 €
 *    y una hora de trabajo 30 € me haces el presupuesto»
 *     -> "Borrador creado" / "Total: 0.00 €"       (INCORRECTO)
 *   después: «sí házmelo pero bien»
 *     -> "No hay borrador activo para confirmar."  (EL BORRADOR SE PERDIÓ)
 *
 * Las frases de estas pruebas son las que un electricista dice de verdad, con
 * pausas, repeticiones del precio, "cada una" y números en letra; NO frases
 * perfectas. Se comprueba también lo que NO debe pasar: crear un presupuesto de
 * 0 €, elegir una moneda cuando el STT mezcla dos, o perder el borrador entre
 * turnos.
 *
 * AISLAMIENTO: cliente libsql en memoria; nunca se toca electricista.db.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { createClient } from "@libsql/client";
import {
  getDbClient,
  initializeDatabase,
  resetDbClient,
  setDbClientForTesting,
} from "@/lib/db";
import { POST as handleVoice360Route } from "@/app/api/asistente/voice360/route";
import { isDangerousElectricalQuery } from "@/lib/assistant/electrical-safety";
import { electricistaDomainAdapter } from "@/lib/assistant/electricista-adapter";

const ROUTE_URL = "http://localhost:3000/api/asistente/voice360";

async function post(body: unknown): Promise<{ status: number; json: any }> {
  const request = new NextRequest(ROUTE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const response = await handleVoice360Route(request);
  return { status: response.status, json: await response.json() };
}

const num = (v: unknown): number => Number(v);

/** Arranca una BD en memoria aislada para cada prueba. */
async function conBaseAislada(t: { after: (fn: () => void) => void }) {
  const anterior = process.env.TEST_DATABASE_URL;
  const db = createClient({ url: "file::memory:" });
  process.env.TEST_DATABASE_URL = `file:${process.env.TEMP ?? "."}/voice360-parser-${Math.random().toString(36).slice(2)}.db`;
  setDbClientForTesting(db);
  await initializeDatabase();
  t.after(() => {
    resetDbClient();
    if (anterior === undefined) delete process.env.TEST_DATABASE_URL;
    else process.env.TEST_DATABASE_URL = anterior;
    try {
      db.close();
    } catch {
      /* ignore */
    }
  });
  return db;
}

async function contarPresupuestos(): Promise<number> {
  const res = await getDbClient().execute("SELECT COUNT(*) AS c FROM budgets");
  return num(res.rows[0].c);
}

function partidas(json: any): any[] {
  return (json.draft?.items ?? []) as any[];
}

// ────────────────────────────────────────────────────────────────────────────
// CASO A — la frase del informe, dicha de corrido
// ────────────────────────────────────────────────────────────────────────────
test("CASO A: «dos bombillas a veinticinco euros cada una y una hora de trabajo a treinta euros»", async (t) => {
  await conBaseAislada(t);

  const r = await post({
    input: "dos bombillas a veinticinco euros cada una y una hora de trabajo a treinta euros",
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.intent, "electricista:budget_draft", "debe ser un BORRADOR");

  const items = partidas(r.json);
  assert.equal(items.length, 2, "DOS partidas: bombillas y hora de trabajo");
  assert.equal(num(items[0].quantity), 2);
  assert.equal(num(items[0].unit_price), 25, "«veinticinco euros» = 25");
  assert.match(String(items[0].description), /bombilla/i);
  assert.equal(num(items[1].quantity), 1);
  assert.equal(num(items[1].unit_price), 30, "«treinta euros» = 30");
  assert.match(String(items[1].description), /hora/i);

  // 2x25 + 1x30 = 80 base; IVA 21% = 16,80; TOTAL = 96,80
  assert.equal(num(r.json.totals.subtotal), 80, "base = 80");
  assert.equal(num(r.json.totals.tax_amount), 16.8, "IVA 21% de 80");
  assert.equal(num(r.json.totals.total), 96.8, "total con IVA");
  assert.deepEqual(r.json.totals.incomplete, [], "ninguna partida sin precio");

  assert.equal(await contarPresupuestos(), 0, "sigue siendo borrador: nada guardado");
});

// ────────────────────────────────────────────────────────────────────────────
// CASO A-bis — la locución REAL, con la pausa y el precio repetido
// ────────────────────────────────────────────────────────────────────────────
test("CASO A-bis: la locución real del usuario no produce un borrador de 0 €", async (t) => {
  await conBaseAislada(t);

  const r = await post({
    input:
      "quiero hacer un presupuesto de dos bombillas a veinticinco ... cada una 25 € " +
      "y una hora de trabajo 30 € me haces el presupuesto",
  });

  const items = partidas(r.json);
  assert.ok(items.length > 0, "NO puede devolver un borrador sin partidas");
  assert.ok(
    !/Total:\s*0[.,]00\s*€/.test(String(r.json.answer)),
    `la respuesta no puede anunciar un total de 0 €: ${r.json.answer}`
  );

  // El "25 €" repetido es el MISMO valor que "veinticinco": no es un conflicto.
  assert.equal(num(items[0].quantity), 2);
  assert.equal(num(items[0].unit_price), 25);
  assert.equal(num(items[1].unit_price), 30);

  // El precio hablado no puede quedarse dentro de la descripción.
  assert.doesNotMatch(String(items[0].description), /veinticinco|25/i, "el precio no va en la descripción");

  assert.equal(num(r.json.totals.subtotal), 80, "base = 80");
  assert.equal(num(r.json.totals.total), 96.8, "total = 96,80");
});

// ────────────────────────────────────────────────────────────────────────────
// CASO B — cifras en vez de letras
// ────────────────────────────────────────────────────────────────────────────
test("CASO B: «2 bombillas 25 euros cada una y 1 hora 30 euros»", async (t) => {
  await conBaseAislada(t);

  const r = await post({ input: "2 bombillas 25 euros cada una y 1 hora 30 euros" });
  const items = partidas(r.json);

  assert.equal(items.length, 2, "dos partidas");
  assert.equal(num(items[0].quantity), 2);
  assert.equal(num(items[0].unit_price), 25);
  assert.equal(num(items[1].quantity), 1);
  assert.equal(num(items[1].unit_price), 30, "«1 hora 30 euros»: el precio no necesita preposición");
  assert.equal(num(r.json.totals.subtotal), 80);
});

// ────────────────────────────────────────────────────────────────────────────
// CASO C — verbo con pronombre ("ponme") y precio con "de"/"a"
// ────────────────────────────────────────────────────────────────────────────
test("CASO C: «ponme dos bombillas de 25 y una hora a 30»", async (t) => {
  await conBaseAislada(t);

  const r = await post({ input: "ponme dos bombillas de 25 y una hora a 30" });
  const items = partidas(r.json);

  assert.equal(items.length, 2, "dos partidas");
  assert.equal(num(items[0].quantity), 2);
  assert.equal(num(items[0].unit_price), 25, "«de 25» = 25 €/ud");
  assert.equal(num(items[1].unit_price), 30, "«a 30» = 30 €/ud");
  assert.equal(num(r.json.totals.subtotal), 80);
});

// ────────────────────────────────────────────────────────────────────────────
// CASO D — información parcial: falta el precio
// ────────────────────────────────────────────────────────────────────────────
test("CASO D: «dos bombillas» pide el precio y NO produce un 0 €", async (t) => {
  await conBaseAislada(t);

  const r = await post({ input: "dos bombillas" });
  assert.equal(r.status, 200);

  // O bien no hay borrador, o lo hay pero CON la partida y su precio pendiente.
  // Lo que nunca puede pasar es un "Borrador creado · Total: 0.00 €".
  assert.ok(
    !/Total:\s*0[.,]00\s*€/.test(String(r.json.answer)),
    `no puede anunciar un total de 0 €: ${r.json.answer}`
  );

  const items = partidas(r.json);
  assert.equal(items.length, 1, "la partida entendida se conserva");
  assert.equal(num(items[0].quantity), 2);
  assert.equal(items[0].unit_price, null, "el precio queda pendiente, no se inventa");
  assert.match(String(items[0].description), /bombilla/i);

  assert.ok(
    r.json.totals.incomplete.length === 1,
    "el motor debe declarar que falta el precio de esa partida"
  );
  assert.match(String(r.json.answer), /falta|precio|dime/i, "debe PEDIR el precio");

  assert.equal(await contarPresupuestos(), 0, "nada guardado");
});

// ────────────────────────────────────────────────────────────────────────────
// CASO E — dictado contradictorio: dos monedas
// ────────────────────────────────────────────────────────────────────────────
test("CASO E: «dos bombillas a veinticinco pesetas cada una 25 euros» pide aclaración", async (t) => {
  await conBaseAislada(t);

  const r = await post({
    input: "dos bombillas a veinticinco pesetas cada una 25 euros",
  });
  assert.equal(r.status, 200);

  // No elige, no calcula 0 y no crea borrador: pregunta.
  assert.equal(r.json.draft, null, "no puede crear un borrador con datos contradictorios");
  assert.match(String(r.json.answer), /\?/, "debe preguntar");
  assert.match(String(r.json.answer), /moneda|pesetas|euros/i, "debe señalar la contradicción");
  assert.equal(await contarPresupuestos(), 0, "no se guarda nada");
});

// ────────────────────────────────────────────────────────────────────────────
// CASO F — el borrador SOBREVIVE al turno de confirmación
// ────────────────────────────────────────────────────────────────────────────
test("CASO F: el borrador sigue vivo tras «sí, guárdalo» y tras un turno ajeno", async (t) => {
  await conBaseAislada(t);

  const creado = await post({ input: "dos bombillas a 25 euros cada una y una hora de trabajo a 30 euros" });
  const draft = creado.json.draft;
  assert.ok(draft, "turno 1 debe crear el borrador");
  assert.equal(partidas(creado.json).length, 2);

  // Turno de CONFIRMACIÓN: debe seguir habiendo borrador y abrirse la puerta.
  const confirma = await post({ input: "sí, guárdalo", draft });
  assert.ok(confirma.json.draft, "el borrador NO puede desaparecer al confirmar");
  assert.equal(num(confirma.json.totals.subtotal), 80, "los totales siguen");
  assert.ok(confirma.json.pending_action, "se abre la puerta de confirmación");
  assert.doesNotMatch(String(confirma.json.answer), /No hay borrador activo/i);

  // Turno AJENO (una pregunta abierta): tampoco puede tirar el borrador.
  const ajeno = await post({ input: "¿cómo añado un cliente?", draft });
  assert.ok(ajeno.json.draft, "una pregunta que no toca el borrador no puede borrarlo");
  assert.equal(partidas(ajeno.json).length, 2, "las partidas siguen intactas");

  // Y una frase con "pero bien" tampoco lo pierde.
  const natural = await post({ input: "sí házmelo pero bien", draft });
  assert.ok(natural.json.draft, "«sí házmelo pero bien» no puede perder el borrador");
  assert.equal(partidas(natural.json).length, 2);
});

// ────────────────────────────────────────────────────────────────────────────
// CASO G — corrección por voz sobre el MISMO borrador
// ────────────────────────────────────────────────────────────────────────────
test("CASO G: «cambia dos bombillas por tres» modifica el mismo borrador", async (t) => {
  await conBaseAislada(t);

  const creado = await post({ input: "dos bombillas a 25 euros cada una y una hora de trabajo a 30 euros" });
  const draft = creado.json.draft;
  assert.equal(partidas(creado.json).length, 2);
  assert.equal(num(partidas(creado.json)[0].quantity), 2);

  const corregido = await post({ input: "cambia dos bombillas por tres", draft });
  const items = partidas(corregido.json);

  assert.equal(items.length, 2, "siguen siendo dos partidas (no se duplica la línea)");
  assert.equal(num(items[0].quantity), 3, "la cantidad pasa de 2 a 3");
  assert.equal(num(items[1].unit_price), 30, "la otra línea no se toca");
  assert.equal(num(corregido.json.totals.subtotal), 105, "3x25 + 30 = 105");
  assert.equal(await contarPresupuestos(), 0, "corregir no guarda");
});

// ────────────────────────────────────────────────────────────────────────────
// CASO H — doble confirmación: exactamente UN presupuesto
// ────────────────────────────────────────────────────────────────────────────
test("CASO H: doble «guárdalo» produce exactamente un presupuesto", async (t) => {
  await conBaseAislada(t);

  const creado = await post({ input: "dos bombillas a 25 euros cada una y una hora de trabajo a 30 euros" });
  const draft = creado.json.draft;

  const puerta = await post({ input: "guárdalo", draft });
  const token = puerta.json.pending_action?.token;
  assert.ok(token, "se emite token");
  assert.equal(await contarPresupuestos(), 0, "abrir la puerta NO guarda");

  const primera = await post({ confirm_token: token, draft });
  assert.equal(primera.status, 200);
  assert.equal(await contarPresupuestos(), 1, "la primera confirmación guarda UNA vez");

  // Reintento/doble click con el mismo token.
  const segunda = await post({ confirm_token: token, draft });
  assert.equal(segunda.status, 200);
  assert.equal(await contarPresupuestos(), 1, "el reintento NO duplica");
});

// ────────────────────────────────────────────────────────────────────────────
// CASO I — el parser no entiende: 0 presupuestos
// ────────────────────────────────────────────────────────────────────────────
test("CASO I: si no se entiende ninguna partida, no se persiste nada", async (t) => {
  await conBaseAislada(t);

  const r = await post({ input: "hazme un presupuesto" });
  assert.equal(r.status, 200);
  assert.equal(r.json.draft, null, "sin partidas no hay borrador");

  const items = partidas(r.json);
  assert.equal(items.length, 0);
  assert.match(String(r.json.answer), /no he entendido|dime|precio/i, "debe explicar qué falta");
  assert.doesNotMatch(String(r.json.answer), /Borrador creado/i, "no puede decir que creó un borrador");
  assert.equal(await contarPresupuestos(), 0, "0 presupuestos persistidos");
});

// ────────────────────────────────────────────────────────────────────────────
// Todas las formas naturales listadas en el enunciado
// ────────────────────────────────────────────────────────────────────────────
test("todas las variantes habladas del enunciado producen las partidas correctas", async (t) => {
  await conBaseAislada(t);

  // Una sola partida: 2 x 25 = 50 de base.
  const unaPartida = [
    "dos bombillas a veinticinco euros cada una",
    "2 bombillas a 25 euros",
    "dos bombillas, 25 euros cada una",
  ];
  for (const frase of unaPartida) {
    const r = await post({ input: frase });
    const items = partidas(r.json);
    assert.equal(items.length, 1, `«${frase}» debe dar UNA partida`);
    assert.equal(num(items[0].quantity), 2, `cantidad en «${frase}»`);
    assert.equal(num(items[0].unit_price), 25, `precio en «${frase}»`);
    assert.match(String(items[0].description), /bombilla/i, `descripción en «${frase}»`);
    assert.equal(num(r.json.totals.subtotal), 50, `base en «${frase}»`);
  }

  // Una hora de trabajo: 1 x 30 = 30 de base (y NUNCA una consulta de partes).
  const horas = ["una hora de trabajo a treinta euros", "1 hora de trabajo 30 euros"];
  for (const frase of horas) {
    const r = await post({ input: frase });
    assert.notEqual(r.json.intent, "electricista:parte_query", `«${frase}» no es una consulta de partes`);
    const items = partidas(r.json);
    assert.equal(items.length, 1, `«${frase}» debe dar UNA partida`);
    assert.equal(num(items[0].quantity), 1);
    assert.equal(num(items[0].unit_price), 30, `precio en «${frase}»`);
    assert.match(String(items[0].description), /hora/i);
    assert.equal(num(r.json.totals.subtotal), 30, `base en «${frase}»`);
  }

  // Dos partidas: 2x25 + 1x30 = 80 de base.
  const dosPartidas = [
    "dos bombillas a veinticinco euros cada una y una hora de trabajo a treinta euros",
    "2 bombillas 25 euros cada una y 1 hora 30 euros",
    "ponme dos bombillas de 25 euros y una hora a 30",
    "ponme dos bombillas de 25 y una hora a 30",
    "haz un presupuesto con dos bombillas a veinticinco y una hora de trabajo a treinta",
  ];
  for (const frase of dosPartidas) {
    const r = await post({ input: frase });
    const items = partidas(r.json);
    assert.equal(items.length, 2, `«${frase}» debe dar DOS partidas (perdió una línea)`);
    assert.equal(num(items[0].quantity), 2, `cantidad de bombillas en «${frase}»`);
    assert.equal(num(items[0].unit_price), 25, `precio de bombillas en «${frase}»`);
    assert.equal(num(items[1].unit_price), 30, `precio de la hora en «${frase}»`);
    assert.equal(num(r.json.totals.subtotal), 80, `base en «${frase}»`);
    assert.equal(num(r.json.totals.total), 96.8, `total en «${frase}»`);
    assert.deepEqual(r.json.totals.incomplete, [], `sin precios pendientes en «${frase}»`);
  }

  assert.equal(await contarPresupuestos(), 0, "ninguna de estas frases guarda nada");
});

// ────────────────────────────────────────────────────────────────────────────
// Regresiones encontradas por la QA adversaria
// ────────────────────────────────────────────────────────────────────────────

test("QA-C1: los números compuestos NO se parten por su «y»", async (t) => {
  await conBaseAislada(t);

  // "treinta y cinco" se partía en dos segmentos por la "y", y la partida salía
  // con cantidad 5 en vez de 35: el importe equivocado llegaba a guardarse.
  const casos: Array<[string, number, number]> = [
    ["treinta y cinco metros de cable a dos euros", 35, 70],
    ["cuarenta y cinco metros de cable a dos euros", 45, 90],
    ["veinticinco metros de cable a dos euros", 25, 50],
    ["treinta y uno enchufes a 10 euros", 31, 310],
  ];
  for (const [frase, cantidad, base] of casos) {
    const r = await post({ input: frase });
    const items = partidas(r.json);
    assert.equal(items.length, 1, `«${frase}»: debe dar UNA partida`);
    assert.equal(num(items[0].quantity), cantidad, `cantidad dictada en «${frase}»`);
    assert.equal(num(r.json.totals.subtotal), base, `base en «${frase}»`);
  }

  // La guarda NO puede desactivar el corte normal: "y dos horas" sí separa.
  const dos = await post({ input: "dos bombillas a 25 euros y dos horas de trabajo a 30 euros" });
  assert.equal(partidas(dos.json).length, 2, "el «y» entre partidas sigue separando");
  assert.equal(num(dos.json.totals.subtotal), 110, "2x25 + 2x30 = 110");
});

test("QA-C2: dos precios en DOS líneas distintas no piden aclaración", async (t) => {
  await conBaseAislada(t);

  // El detector de ambigüedad no puede confundir "25 €" de una línea con "30 €"
  // de otra: eso es un presupuesto perfectamente normal.
  const r = await post({ input: "dos bombillas a 25 euros y la mano de obra a 30 euros" });
  const items = partidas(r.json);
  assert.equal(items.length, 2, "las dos líneas deben existir");
  assert.equal(num(items[0].unit_price), 25);
  assert.equal(num(items[1].unit_price), 30);
  assert.equal(num(r.json.totals.subtotal), 80, "2x25 + 30 = 80");
  assert.doesNotMatch(String(r.json.answer), /dos precios distintos|Cuál es el precio/i);

  // Y el motivo por el que el segmentador no corta ante un concepto sin cantidad:
  // "y cobre" sigue siendo el MISMO producto.
  const pegado = await post({ input: "2 tubos de PVC y cobre a 10 euros" });
  assert.equal(partidas(pegado.json).length, 1, "sin un precio anterior, «y cobre» no separa");
});

test("QA-C3: la medida del material se conserva en la descripción", async (t) => {
  await conBaseAislada(t);

  const r = await post({ input: "dos tubos de 20 mm a 5 euros" });
  const items = partidas(r.json);
  assert.equal(items.length, 1);
  assert.match(String(items[0].description), /20\s*mm/i, "no puede perder «20 mm»");
  assert.equal(num(items[0].unit_price), 5, "el precio es 5, no 20");

  const cable = await post({ input: "3 metros de cable de 2,5 mm a 2 euros" });
  const itemsCable = partidas(cable.json);
  assert.equal(itemsCable.length, 1);
  assert.match(String(itemsCable[0].description), /2[.,]5\s*mm/i, "no puede perder «2,5 mm»");
  assert.equal(num(itemsCable[0].unit_price), 2);
});

test("QA-C4: un «si» condicional de relleno NO confirma el borrador", async (t) => {
  await conBaseAislada(t);

  // "si puede ser" convertía el dictado en una confirmación: no creaba borrador y
  // respondía "No hay borrador activo para confirmar".
  const r = await post({ input: "2 bombillas a 25 euros si puede ser" });
  assert.notEqual(r.json.intent, "electricista:budget_confirm", "no es una confirmación");
  assert.doesNotMatch(String(r.json.answer), /No hay borrador activo/i);
  const items = partidas(r.json);
  assert.equal(items.length, 1, "debe crear el borrador igualmente");
  assert.equal(num(items[0].unit_price), 25);
  assert.equal(num(r.json.totals.subtotal), 50);

  // Pero un "sí" de verdad sigue confirmando.
  const draft = r.json.draft;
  const confirma = await post({ input: "sí", draft });
  assert.equal(confirma.json.intent, "electricista:budget_confirm", "«sí» a secas confirma");
  assert.ok(confirma.json.pending_action, "abre la puerta");
});

test("QA-C5: pedir un listado NO crea una línea de presupuesto", async (t) => {
  await conBaseAislada(t);

  const facturas = await post({ input: "dame las 3 facturas pendientes" });
  assert.equal(partidas(facturas.json).length, 0, "no es una línea de presupuesto");
  assert.equal(facturas.json.intent, "electricista:invoice_query");

  // Antes creaba "2 ud de Presupuestos" con precio pendiente y volvía a anunciar
  // "Total actual: 0.00 €" (el síntoma del informe, por la puerta de atrás).
  const presupuestos = await post({ input: "dame 2 presupuestos" });
  assert.equal(partidas(presupuestos.json).length, 0, "no puede inventar una línea «Presupuestos»");
  assert.equal(presupuestos.json.intent, "electricista:budget_query");
  assert.doesNotMatch(String(presupuestos.json.answer), /Total actual: \*\*0\.00/i);
});

// ────────────────────────────────────────────────────────────────────────────
// Segunda ronda de QA — defectos introducidos por el propio arreglo
// ────────────────────────────────────────────────────────────────────────────

test("QA-N2: la medida «de N metros» NO se convierte en el precio", async (t) => {
  await conBaseAislada(t);

  // El importe dictado se sustituía por la longitud del material, y el importe
  // equivocado llegaba a guardarse.
  const casos: Array<[string, number, number, number]> = [
    ["un tubo de 3 metros a 10 euros", 1, 10, 10],
    ["un tubo de 2,5 metros a 12 euros", 1, 12, 12],
    ["2 rollos de 100 metros a 45 euros", 2, 45, 90],
    ["una bobina de 50 metros de cable a 40 euros", 1, 40, 40],
  ];
  for (const [frase, cantidad, precio, base] of casos) {
    const r = await post({ input: frase });
    const items = partidas(r.json);
    assert.equal(items.length, 1, `«${frase}»: una sola partida`);
    assert.equal(num(items[0].quantity), cantidad, `cantidad en «${frase}»`);
    assert.equal(num(items[0].unit_price), precio, `PRECIO en «${frase}» (no la medida)`);
    assert.equal(num(r.json.totals.subtotal), base, `base en «${frase}»`);
  }

  // Controles que ya funcionaban y no deben romperse.
  const control = await post({ input: "un bote de 5 litros a 30 euros" });
  assert.equal(num(partidas(control.json)[0].unit_price), 30, "«5 litros» no es el precio");
});

test("QA-N3: el corte por precio no mutila la descripción", async (t) => {
  await conBaseAislada(t);

  const casos: Array<[string, RegExp]> = [
    ["dos bombillas a 25 euros, ordenadores a 12 euros", /^Ordenadores$/i],
    ["dos bombillas a 25 euros, extractores de aire a 80 euros", /^Extractores de aire$/i],
    ["dos bombillas a 25 euros, embellecedores a 4 euros", /^Embellecedores$/i],
  ];
  for (const [frase, esperado] of casos) {
    const r = await post({ input: frase });
    const items = partidas(r.json);
    assert.equal(items.length, 2, `«${frase}»: dos partidas`);
    assert.match(String(items[1].description), esperado, `descripción en «${frase}»`);
  }
});

test("QA-N1/N5: «vale»/«ok» sólo confirman si son una respuesta", async (t) => {
  await conBaseAislada(t);

  // "vale" al principio de un DICTADO no puede confirmar: se perdía la frase.
  for (const frase of [
    "vale, ponme dos bombillas a 25 euros cada una",
    "vale pues dos bombillas a 25 euros",
    "ok, añade dos bombillas a 25 euros",
  ]) {
    const r = await post({ input: frase });
    assert.doesNotMatch(String(r.json.answer), /No hay borrador activo/i, `«${frase}» no puede confirmar`);
    assert.ok(partidas(r.json).length >= 1, `«${frase}» debe producir partidas`);
  }

  // Y las confirmaciones de verdad siguen confirmando.
  const base = await post({ input: "dos bombillas a 25 euros cada una" });
  const draft = base.json.draft;
  for (const frase of ["sí", "sí, guárdalo", "sí házmelo", "vale, guarda", "ok, guarda", "confirmar", "si es correcto"]) {
    const r = await post({ input: frase, draft });
    assert.equal(r.json.intent, "electricista:budget_confirm", `«${frase}» debe confirmar`);
    assert.ok(r.json.pending_action, `«${frase}» debe abrir la puerta`);
    assert.ok(r.json.draft, `«${frase}» no puede perder el borrador`);
  }
});

test("QA-N4: crear un presupuesto no se confunde con pedir un listado", async (t) => {
  await conBaseAislada(t);

  const crear = await post({ input: "dame un presupuesto con dos bombillas a 25 euros" });
  assert.ok(partidas(crear.json).length >= 1, "es un dictado: debe haber partidas");
  assert.notEqual(crear.json.intent, "electricista:budget_query");

  // Un tema con rama propia cede si la frase trae partidas de verdad.
  const catalogo = await post({ input: "ponme 2 tubos del catalogo a 5 euros" });
  assert.ok(partidas(catalogo.json).length >= 1, "mencionar el catálogo no lo convierte en consulta");

  // Pero un listado puro sigue siendo un listado.
  const listado = await post({ input: "dame 2 presupuestos" });
  assert.equal(partidas(listado.json).length, 0);
  assert.equal(listado.json.intent, "electricista:budget_query");

  // Y una frase sobre FACTURAS no se convierte en partida aunque traiga cantidad
  // y precio: las entidades de datos tienen su propia rama y esa guarda NO cede.
  const facturas = await post({ input: "necesito 2 facturas de 30 euros" });
  assert.equal(partidas(facturas.json).length, 0, "«facturas» es una consulta, no una partida");
  assert.equal(facturas.json.intent, "electricista:invoice_query");
});

test("QA-P1/P2: verbos con tilde y nombre de cliente con «con»", async (t) => {
  await conBaseAislada(t);

  for (const frase of ["añádeme dos bombillas a 25 euros", "agrégame dos bombillas a 25 euros"]) {
    const r = await post({ input: frase });
    const items = partidas(r.json);
    assert.equal(items.length, 1, `«${frase}»: una partida`);
    assert.equal(num(items[0].quantity), 2, `cantidad en «${frase}»`);
    assert.equal(num(r.json.totals.subtotal), 50, `base en «${frase}»`);
    assert.doesNotMatch(String(items[0].description), /a[ñn][aá]deme|agr[eé]game/i, "el verbo no va en la descripción");
  }

  const cliente = await post({ input: "presupuesto para Juan con 2 bombillas a 25 euros" });
  assert.equal(cliente.json.draft?.client_name, "Juan", "el «con» no forma parte del nombre");
  assert.equal(num(cliente.json.totals.subtotal), 50);
});

// ────────────────────────────────────────────────────────────────────────────
// Tercera ronda de QA — muletillas, listados y detalles
// ────────────────────────────────────────────────────────────────────────────

test("QA-F1: las muletillas de arranque no rompen la cantidad", async (t) => {
  await conBaseAislada(t);

  // "vale, ponme …" dejaba cantidad 1 y metía la muletilla en la descripción; el
  // importe equivocado se GUARDABA (base 25 en vez de 50).
  const casos = [
    "vale, ponme dos bombillas a 25 euros cada una",
    "bueno, ponme dos bombillas a 25 euros cada una",
    "venga, ponme dos bombillas a 25 euros cada una",
    "a ver, dame dos bombillas a 25 euros cada una",
    "pues ponme dos bombillas a 25 euros cada una",
    "vale pues dos bombillas a 25 euros cada una",
    "ok, añade dos bombillas a 25 euros cada una",
    "inclúyeme dos bombillas a 25 euros cada una",
  ];
  for (const frase of casos) {
    const r = await post({ input: frase });
    const items = partidas(r.json);
    assert.equal(items.length, 1, `«${frase}»: una partida`);
    assert.equal(num(items[0].quantity), 2, `CANTIDAD en «${frase}»`);
    assert.equal(num(r.json.totals.subtotal), 50, `BASE en «${frase}»`);
    assert.doesNotMatch(
      String(items[0].description),
      /vale|bueno|venga|pues|ok|a ver|inclúyeme/i,
      `la muletilla no puede ir en la descripción de «${frase}»`
    );
    assert.match(String(items[0].description), /bombilla/i, `descripción de «${frase}»`);
  }
});

test("QA-F2: pedir listados de datos no crea líneas de presupuesto", async (t) => {
  await conBaseAislada(t);

  for (const [frase, intent] of [
    ["dame los 3 trabajos", "electricista:parte_query"],
    ["dame los 2 partes", "electricista:parte_query"],
    ["dame 2 materiales", "electricista:catalog_query"],
  ] as Array<[string, string]>) {
    const r = await post({ input: frase });
    assert.equal(partidas(r.json).length, 0, `«${frase}» no puede crear una línea`);
    assert.equal(r.json.intent, intent, `intent de «${frase}»`);
    assert.doesNotMatch(String(r.json.answer), /Total actual: \*\*0\.00/i, `«${frase}» no puede anunciar 0,00 €`);
  }

  // Y un dictado con catálogo sigue siendo un dictado.
  const catalogo = await post({ input: "ponme 2 tubos del catalogo a 5 euros" });
  assert.ok(partidas(catalogo.json).length >= 1, "mencionar el catálogo no lo convierte en consulta");
});

test("QA-F3/F4/F5/F6: IVA, tildes, «es correcto» y cliente con «y»", async (t) => {
  await conBaseAislada(t);

  // F3: "dame un presupuesto sin IVA" es CREAR, no cambiar el IVA.
  const sinIva = await post({ input: "dame un presupuesto sin IVA" });
  assert.notEqual(sinIva.json.intent, "electricista:budget_set_tax");
  assert.doesNotMatch(String(sinIva.json.answer), /No hay borrador activo para cambiar el IVA/i);

  // F5: "es correcto" a secas confirma.
  const creado = await post({ input: "dos bombillas a 25 euros cada una" });
  const confirma = await post({ input: "es correcto", draft: creado.json.draft });
  assert.equal(confirma.json.intent, "electricista:budget_confirm", "«es correcto» debe confirmar");
  assert.ok(confirma.json.pending_action);

  // F6: la "y" no forma parte del nombre del cliente.
  const cliente = await post({ input: "presupuesto para Juan y dos bombillas a 25 euros" });
  assert.equal(cliente.json.draft?.client_name, "Juan", "la «y» no entra en el nombre");
  assert.equal(num(cliente.json.totals.subtotal), 50, "las líneas siguen bien");
});

// ────────────────────────────────────────────────────────────────────────────
// Cuarta ronda de QA — artículos, verbos de dictado y regresiones de F2/F3
// ────────────────────────────────────────────────────────────────────────────

test("QA-G: verbos de dictado y artículo delante de la cantidad", async (t) => {
  await conBaseAislada(t);

  // El artículo antes del numeral impedía reconocer la cantidad: salía 1 unidad y
  // el importe equivocado llegaba a guardarse.
  const casos = [
    "muéstrame 2 bombillas a 25 euros",
    "enséñame 2 bombillas a 25 euros",
    "mira los 2 tubos a 5 euros",
    "ponme los 2 tubos a 5 euros",
    "los 2 tubos a 5 euros",
    "si hace falta pon dos bombillas a 25 euros",
  ];
  for (const frase of casos) {
    const r = await post({ input: frase });
    const items = partidas(r.json);
    assert.equal(items.length, 1, `«${frase}»: una partida`);
    assert.equal(num(items[0].quantity), 2, `CANTIDAD en «${frase}» (el artículo no puede comerse el número)`);
    assert.ok(
      !/muéstrame|muestrame|enséñame|mira|hace falta|^los\b/i.test(String(items[0].description)),
      `sin muletilla en la descripción de «${frase}»: ${items[0].description}`
    );
    assert.equal(num(r.json.totals.subtotal) > 0, true, `base calculada en «${frase}»`);
  }

  // "una hora de trabajo": aquí el artículo ES la cantidad y debe conservarse.
  const una = await post({ input: "una hora de trabajo a 30 euros" });
  assert.equal(num(partidas(una.json)[0].quantity), 1);
  assert.equal(num(una.json.totals.subtotal), 30, "«una» es la cantidad, no un artículo a borrar");
});

test("QA-G1: «dame 2 horas de trabajo» sigue siendo un dictado, no un listado", async (t) => {
  await conBaseAislada(t);

  const r = await post({ input: "dame 2 horas de trabajo" });
  const items = partidas(r.json);
  assert.equal(items.length, 1, "debe conservar la partida y pedir el precio");
  assert.equal(num(items[0].quantity), 2);
  assert.equal(items[0].unit_price, null, "precio pendiente");
  assert.notEqual(r.json.intent, "electricista:parte_query", "no es una consulta de partes");

  // Y los listados de verdad siguen siendo listados.
  for (const [frase, intent] of [
    ["dame los 3 trabajos", "electricista:parte_query"],
    ["dame los 2 partes", "electricista:parte_query"],
    ["dame 2 materiales", "electricista:catalog_query"],
  ] as Array<[string, string]>) {
    const l = await post({ input: frase });
    assert.equal(partidas(l.json).length, 0, `«${frase}» no crea línea`);
    assert.equal(l.json.intent, intent, `intent de «${frase}»`);
  }
});

test("QA-G2/G3: la orden de IVA no se pierde y «es verdad que…» no confirma", async (t) => {
  await conBaseAislada(t);

  // G2: pedir la tasa CON la palabra "presupuesto" debe cambiar la tasa.
  const creado = await post({ input: "dos bombillas a 25 euros cada una" });
  const draft = creado.json.draft;
  for (const frase of [
    "quiero poner el IVA del presupuesto al 10%",
    "pon el IVA del presupuesto al 10%",
    "cambia el IVA del presupuesto al 10%",
  ]) {
    const r = await post({ input: frase, draft });
    assert.equal(r.json.intent, "electricista:budget_set_tax", `«${frase}» debe cambiar el IVA`);
    assert.equal(num(r.json.draft?.tax_rate), 10, `tasa aplicada en «${frase}»`);
  }

  // Crear con "sin IVA" sigue creando (no cae en cambiar el IVA).
  const sinIva = await post({ input: "dame un presupuesto sin IVA" });
  assert.notEqual(sinIva.json.intent, "electricista:budget_set_tax");
  assert.doesNotMatch(String(sinIva.json.answer), /No hay borrador activo para cambiar el IVA/i);

  // G3: "es verdad que son 30 euros" aplica el precio, NO abre el diálogo de guardado.
  const verdad = await post({ input: "es verdad que son 30 euros", draft });
  assert.equal(verdad.json.pending_action ?? null, null, "no puede abrir el diálogo de guardado");
  assert.notEqual(String(verdad.json.answer), "", "debe responder algo");

  // Pero "es correcto" a secas SÍ confirma.
  const correcto = await post({ input: "es correcto", draft });
  assert.equal(correcto.json.intent, "electricista:budget_confirm");
  assert.ok(correcto.json.pending_action, "abre la puerta");
});

// ────────────────────────────────────────────────────────────────────────────
// Guarda de seguridad: «puntos de luz» es un presupuesto normal, NO una alerta
// ────────────────────────────────────────────────────────────────────────────
test("la guarda eléctrica no bloquea «puntos de luz» y sí detecta «con luz»", async (t) => {
  await conBaseAislada(t);

  // El patrón anterior era `/con.*luz/`: el `.*` casaba con cualquier cosa entre
  // "con" y "luz", así que bloqueaba una partida del PROPIO catálogo del proyecto.
  const normales = [
    "hazme un presupuesto con 4 puntos de luz a 20 euros",
    "presupuesto con 2 puntos de luz y una hora de trabajo",
    "presupuesto de 3 puntos de luz a 25 euros",
    "instalación de punto de luz a 40 euros",
    "presupuesto con la luz del pasillo a 60 euros",
  ];
  for (const frase of normales) {
    assert.equal(isDangerousElectricalQuery(frase), false, `«${frase}» NO puede activar la guarda`);
  }

  // Y las formas reales de decir "energizado" siguen detectándose.
  const peligrosas = [
    "trabaja con la luz puesta",
    "cambia el enchufe con la luz dada",
    "corta el cable con luz",
    "manipula el cuadro con la luz conectada",
    "hazlo con la luz encendida",
  ];
  for (const frase of peligrosas) {
    assert.equal(isDangerousElectricalQuery(frase), true, `«${frase}» DEBE activar la guarda`);
  }

  // Y de extremo a extremo: un presupuesto con puntos de luz se crea de verdad.
  const r = await post({ input: "hazme un presupuesto con 4 puntos de luz a 20 euros" });
  assert.equal(r.json.source, "engine", "no puede responder con la alerta de seguridad");
  const items = partidas(r.json);
  assert.equal(items.length, 1, "debe crear la partida");
  assert.equal(num(items[0].quantity), 4);
  assert.equal(num(items[0].unit_price), 20);
  assert.equal(num(r.json.totals.subtotal), 80, "4 x 20 = 80");
});

// ────────────────────────────────────────────────────────────────────────────
// Normalización de vocabulario: NO puede duplicar la forma canónica
// ────────────────────────────────────────────────────────────────────────────
test("normalizeInput no duplica la forma canónica (descripción del presupuesto)", async (t) => {
  await conBaseAislada(t);

  // `\benchufe\b` también casaba DENTRO de "bases de enchufe", así que la línea
  // salía como "Bases de base de enchufe" y eso va IMPRESO en el presupuesto.
  const sinDuplicar: Array<[string, RegExp]> = [
    ["seis bases de enchufe a dieciocho euros", /^seis bases de enchufe a dieciocho euros$/i],
    ["dos tubos corrugados a 5 euros", /^dos tubos corrugados a 5 euros$/i],
    ["un cable manguera de 3x2.5", /^un cable manguera de 3x2.5$/i],
    ["un foco led empotrable a 30 euros", /^un foco led empotrable a 30 euros$/i],
    ["dos interruptores diferenciales a 40 euros", /^dos interruptores diferenciales a 40 euros$/i],
  ];
  for (const [entrada, esperado] of sinDuplicar) {
    const salida = electricistaDomainAdapter.normalizeInput!(entrada) as string;
    assert.match(salida, esperado, `«${entrada}» no puede reescribirse`);
  }

  // Y la jerga que SÍ hay que expandir sigue expandiéndose.
  const expandir: Array<[string, RegExp]> = [
    ["seis enchufes a dieciocho euros", /bases de enchufe/],
    ["tres tubos a 5 euros", /tubos corrugados/],
    ["una manguera de 3x2.5", /cable manguera/],
    ["Pon un magneto de 16A", /magnetot[eé]rmico/],
    ["un cuadro a 200 euros", /cuadro de distribuci[oó]n el[eé]ctrica/],
    ["dos focos led a 30 euros", /downlight led empotrable/],
  ];
  for (const [entrada, esperado] of expandir) {
    const salida = electricistaDomainAdapter.normalizeInput!(entrada) as string;
    assert.match(salida, esperado, `«${entrada}» debe expandirse`);
  }

  // De extremo a extremo: la descripción que se guarda es la correcta.
  const r = await post({
    input:
      "hazme un presupuesto de seis bases de enchufe a dieciocho euros, tres metros de cable a cuatro euros y dos horas de trabajo a cincuenta",
  });
  const items = partidas(r.json);
  assert.equal(items.length, 3, "tres partidas");
  assert.doesNotMatch(String(items[0].description), /base[s]? de enchufe.*base/i, "descripción sin duplicar");
  assert.match(String(items[0].description), /bases de enchufe/i);
  assert.equal(num(r.json.totals.subtotal), 220, "6x18 + 3x4 + 2x50 = 220");
});

// ────────────────────────────────────────────────────────────────────────────
// Regresión: la política fiscal NO cambia (precios ANTES de IVA)
// ────────────────────────────────────────────────────────────────────────────
test("política fiscal: los precios dictados son BASE y el IVA 21% se añade encima", async (t) => {
  await conBaseAislada(t);

  const r = await post({ input: "dos bombillas a 25 euros cada una" });
  assert.equal(num(r.json.totals.subtotal), 50, "2 x 25 = 50 de BASE");
  assert.equal(num(r.json.totals.tax_amount), 10.5, "21% de 50");
  assert.equal(num(r.json.totals.total), 60.5, "50 + 10,50");
});

// ────────────────────────────────────────────────────────────────────────────
// Regresión: decimales con coma
// ────────────────────────────────────────────────────────────────────────────
test("decimales con coma: «3,5 metros de cable a 2,75 euros»", async (t) => {
  await conBaseAislada(t);

  const r = await post({ input: "3,5 metros de cable a 2,75 euros" });
  const items = partidas(r.json);
  assert.equal(items.length, 1);
  assert.equal(num(items[0].quantity), 3.5);
  assert.equal(num(items[0].unit_price), 2.75);
  assert.equal(num(r.json.totals.subtotal), 9.63, "3,5 x 2,75 = 9,625 → 9,63");
});

// ────────────────────────────────────────────────────────────────────────────
// Regresión: una pausa del STT no parte una partida en dos
// ────────────────────────────────────────────────────────────────────────────
test("pausa del STT: «dos bombillas, 25 euros cada una» es UNA partida con precio", async (t) => {
  await conBaseAislada(t);

  const r = await post({ input: "dos bombillas, 25 euros cada una" });
  const items = partidas(r.json);
  assert.equal(items.length, 1, "la coma no crea una segunda partida");
  assert.equal(num(items[0].quantity), 2);
  assert.equal(num(items[0].unit_price), 25);
  assert.match(String(items[0].description), /bombilla/i);
  assert.equal(num(r.json.totals.subtotal), 50);
});
