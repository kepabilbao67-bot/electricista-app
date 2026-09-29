/**
 * VOZ 360 — FLUJO COMPLETO VOZ → PRESUPUESTO (usabilidad real)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * QUÉ SE DEMUESTRA (no basta con que compile)
 *
 *   HABLAR → TRANSCRIBIR → INTERPRETAR → BORRADOR EN MEMORIA → MOSTRAR →
 *   CORREGIR POR VOZ → CONFIRMAR → GUARDAR UNA SOLA VEZ
 *
 * Con la locución EXACTA de la prueba obligatoria y las correcciones habladas
 * del enunciado:
 *   · el borrador se construye entero y NO se guarda nada;
 *   · cada corrección por voz modifica EL MISMO borrador y recalcula;
 *   · "guárdalo" abre la puerta de confirmación pero no escribe;
 *   · una confirmación válida persiste EXACTAMENTE 1 presupuesto;
 *   · repetir la misma confirmación (doble click / reintento) NO duplica nada.
 *
 * AISLAMIENTO: cliente libsql en memoria; nunca se toca electricista.db.
 * ────────────────────────────────────────────────────────────────────────────
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
import { POST as voice360 } from "@/app/api/asistente/voice360/route";

const RUTA = "http://localhost:3110/api/asistente/voice360";

/** Locución dictada (equivalente a 15-30 s de habla con pausas naturales). */
const LOCUCION =
  "Presupuesto para Juan Pérez: 4 enchufes a 18 euros, " +
  "3 metros de cable a 4 euros, " +
  "2 magnetotérmicos a 22 euros " +
  "y 2 horas de trabajo a 50 euros.";

/**
 * Locución OBLIGATORIA dictada ENTERA CON NÚMEROS EN LETRA, tal como la puede
 * devolver el reconocedor al hablar (y como la dicta el usuario en la prueba
 * funcional). Antes sólo se entendían los números hasta el quince y algunos
 * redondos: "dieciocho" y "veintidós" se perdían.
 */
const LOCUCION_EN_LETRA =
  "Haz un presupuesto para Juan Pérez, " +
  "cuatro enchufes a dieciocho euros, " +
  "tres metros de cable a cuatro euros, " +
  "dos magnetotérmicos a veintidós euros " +
  "y dos horas de trabajo a cincuenta euros.";

async function post(body: unknown): Promise<{ status: number; json: any }> {
  const request = new NextRequest(RUTA, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const response = await voice360(request);
  return { status: response.status, json: await response.json() };
}

async function contarPresupuestos(): Promise<number> {
  const db = getDbClient();
  const res = await db.execute("SELECT COUNT(*) AS c FROM budgets");
  return Number(res.rows[0].c);
}

async function contarLineas(): Promise<number> {
  const db = getDbClient();
  const res = await db.execute("SELECT COUNT(*) AS c FROM budget_items");
  return Number(res.rows[0].c);
}

function num(v: unknown): number {
  return Number(v);
}

test("Voz 360 — flujo completo: borrador, corrección por voz, confirmación e idempotencia", async (t) => {
  const testDb = createClient({ url: "file::memory:" });
  setDbClientForTesting(testDb);
  await initializeDatabase();

  t.after(() => {
    resetDbClient();
    try {
      testDb.close();
    } catch {
      /* ignore */
    }
  });

  // ── 0. PRUEBA OBLIGATORIA: la misma frase dictada con NÚMEROS EN LETRA ──
  // (es la locución del enunciado: "cuatro enchufes a dieciocho euros, tres
  // metros de cable a cuatro euros, dos magnetotérmicos a veintidós euros y dos
  // horas de trabajo a cincuenta euros").
  const enLetra = await post({ input: LOCUCION_EN_LETRA });
  assert.equal(enLetra.status, 200);
  assert.equal(enLetra.json.intent, "electricista:budget_draft", "debe generar BORRADOR");
  assert.equal(enLetra.json.draft.client_name, "Juan Pérez", "el nombre va completo");
  assert.equal(enLetra.json.draft.items.length, 4, "cuatro partidas");

  const lineasEnLetra = enLetra.json.draft.items as Array<Record<string, unknown>>;
  assert.equal(num(lineasEnLetra[0].quantity), 4);
  assert.equal(num(lineasEnLetra[0].unit_price), 18, "«dieciocho euros» = 18");
  assert.equal(num(lineasEnLetra[1].quantity), 3);
  assert.equal(num(lineasEnLetra[1].unit_price), 4);
  assert.equal(num(lineasEnLetra[2].quantity), 2);
  assert.equal(num(lineasEnLetra[2].unit_price), 22, "«veintidós euros» = 22");
  assert.equal(num(lineasEnLetra[3].quantity), 2);
  assert.equal(num(lineasEnLetra[3].unit_price), 50, "«cincuenta euros» = 50");
  // 4×18 + 3×4 + 2×22 + 2×50 = 72 + 12 + 44 + 100 = 228
  assert.equal(num(enLetra.json.totals.subtotal), 228, "importes calculados");
  assert.equal(num(enLetra.json.totals.total), 275.88, "total con IVA 21 %");
  assert.equal(enLetra.json.pending_action, null, "mostrarlo NO abre el guardado");
  assert.equal(await contarPresupuestos(), 0, "0 registros antes de confirmar");

  // ── 1. LOCUCIÓN → BORRADOR EN MEMORIA ─────────────────────────────────
  const paso1 = await post({ input: LOCUCION });

  assert.equal(paso1.status, 200);
  assert.equal(paso1.json.intent, "electricista:budget_draft", "lo dictado debe quedar como BORRADOR");
  assert.equal(paso1.json.pending_action, null, "interpretar NUNCA abre el guardado");

  let draft = paso1.json.draft;
  assert.equal(draft.items.length, 4, "la locución tiene CUATRO partidas");
  assert.equal(draft.client_name, "Juan Pérez", "el nombre no se trunca");

  const esperado = [
    { qty: 4, precio: 18, desc: /enchufe/i },
    { qty: 3, precio: 4, desc: /cable/i },
    { qty: 2, precio: 22, desc: /magnetot/i },
    { qty: 2, precio: 50, desc: /hora/i },
  ];
  esperado.forEach((linea, indice) => {
    assert.equal(num(draft.items[indice].quantity), linea.qty, `cantidad de la línea ${indice + 1}`);
    assert.equal(num(draft.items[indice].unit_price), linea.precio, `precio de la línea ${indice + 1}`);
    assert.match(String(draft.items[indice].description), linea.desc);
  });

  // 4×18 + 3×4 + 2×22 + 2×50 = 72 + 12 + 44 + 100 = 228 €
  assert.equal(num(paso1.json.totals.subtotal), 228, "base imponible");
  assert.equal(num(paso1.json.totals.tax_amount), 47.88, "IVA 21 % de 228");
  assert.equal(num(paso1.json.totals.total), 275.88, "total con IVA");
  assert.deepEqual(paso1.json.totals.incomplete, [], "ninguna línea sin precio");

  assert.equal(await contarPresupuestos(), 0, "MOSTRAR el borrador no guarda nada");

  // ── 2. CORRECCIÓN POR VOZ: "cambia los cuatro enchufes por seis" ──────
  const paso2 = await post({ input: "cambia los cuatro enchufes por seis", draft });
  assert.equal(paso2.json.intent, "electricista:budget_modify_item");
  draft = paso2.json.draft;
  assert.equal(draft.items.length, 4, "se modifica EL MISMO borrador, no se añade una línea");
  assert.equal(num(draft.items[0].quantity), 6, "cantidad corregida a 6");
  assert.ok(num(draft.revision) > num(paso1.json.draft.revision), "la revisión avanza");
  // 6×18 + 12 + 44 + 100 = 264 € → IVA 55,44 → total 319,44
  assert.equal(num(paso2.json.totals.subtotal), 264, "recalculado tras la corrección");
  assert.equal(num(paso2.json.totals.total), 319.44, "total recalculado");
  assert.equal(await contarPresupuestos(), 0, "corregir tampoco guarda");

  // ── 3. "el magnetotérmico son 25 euros" ───────────────────────────────
  const paso3 = await post({ input: "el magnetotérmico son 25 euros", draft });
  draft = paso3.json.draft;
  assert.equal(num(draft.items[2].unit_price), 25, "precio dicho en voz natural");
  assert.equal(num(paso3.json.totals.subtotal), 270, "6×18 + 12 + 2×25 + 100 = 270");
  assert.equal(await contarPresupuestos(), 0);

  // ── 4. "quita el cable" ───────────────────────────────────────────────
  const paso4 = await post({ input: "quita el cable", draft });
  assert.equal(paso4.json.intent, "electricista:budget_remove_item");
  draft = paso4.json.draft;
  assert.equal(draft.items.length, 3, "la línea del cable desaparece");
  assert.equal(
    draft.items.some((i: any) => /cable/i.test(String(i.description))),
    false,
    "no queda ninguna línea de cable"
  );
  assert.equal(num(paso4.json.totals.subtotal), 258, "270 − 12 = 258");
  assert.equal(await contarPresupuestos(), 0);

  // ── 5. "añade un detector de humo" + precio por voz ──────────────────
  const paso5 = await post({ input: "añade un detector de humo", draft });
  assert.equal(paso5.json.intent, "electricista:budget_add_item", "no debe caer en partes de trabajo");
  draft = paso5.json.draft;
  assert.equal(draft.items.length, 4, "se añade una línea nueva");
  assert.equal(paso5.json.totals.incomplete.length, 1, "la línea nueva queda con precio pendiente");
  assert.match(String(paso5.json.totals.incomplete[0]), /detector/i, "y no se le inventa un precio");

  const paso5b = await post({ input: "el detector de humo son 200 euros", draft });
  draft = paso5b.json.draft;
  assert.equal(num(draft.items[3].unit_price), 200, "precio puesto por voz, forma natural");
  assert.deepEqual(paso5b.json.totals.incomplete, [], "ya no queda ningún precio pendiente");
  // 6×18 + 2×25 + 2×50 + 200 = 108 + 50 + 100 + 200 = 458
  assert.equal(num(paso5b.json.totals.subtotal), 458, "base tras completar la línea añadida");
  assert.equal(await contarPresupuestos(), 0);

  // ── 6. "el cliente es Juan Pérez" ───────────────────────────────────
  const paso6 = await post({ input: "el cliente es Juan Pérez", draft });
  assert.equal(paso6.json.intent, "electricista:budget_set_client");
  draft = paso6.json.draft;
  assert.equal(draft.client_name, "Juan Pérez");
  assert.equal(await contarPresupuestos(), 0);

  // ── 7. "cambia el IVA al 10" ──────────────────────────────────────────
  const paso7 = await post({ input: "cambia el IVA al 10", draft });
  assert.equal(paso7.json.intent, "electricista:budget_set_tax");
  draft = paso7.json.draft;
  assert.equal(num(draft.tax_rate), 10, "tipo de IVA corregido por voz");
  assert.equal(num(paso7.json.totals.tax_amount), 45.8, "IVA 10 % de 458");
  assert.equal(num(paso7.json.totals.total), 503.8, "total con IVA del 10 %");
  assert.equal(await contarPresupuestos(), 0, "seguimos sin guardar nada");

  // ── 8. "guárdalo" → AWAITING_CONFIRMATION, todavía sin escribir ───────
  const paso8 = await post({ input: "guárdalo", draft });
  assert.equal(paso8.json.intent, "electricista:budget_confirm");
  assert.ok(paso8.json.pending_action, "hace falta confirmación explícita");
  assert.match(String(paso8.json.pending_action.label), /Crear presupuesto/i);
  assert.equal(await contarPresupuestos(), 0, "decir \"guárdalo\" NO escribe: abre la puerta");

  // ── 9. Confirmación válida → EXACTAMENTE 1 presupuesto ────────────────
  const token = paso8.json.pending_action.token;
  const paso9 = await post({ confirm_token: token, draft });
  assert.match(String(paso9.json.answer), /guardado/i);
  assert.equal(await contarPresupuestos(), 1, "un presupuesto persistido");
  assert.equal(await contarLineas(), 4, "con sus 4 líneas");

  // ── 10. IDEMPOTENCIA: repetir la confirmación no duplica nada ─────────
  for (let intento = 0; intento < 3; intento += 1) {
    const repetido = await post({ confirm_token: token, draft });
    assert.equal(repetido.status, 200, "la repetición se responde igual, sin error");
    assert.equal(repetido.json.idempotent, true, "se reconoce como repetición");
    assert.equal(await contarPresupuestos(), 1, "sigue habiendo 1 solo presupuesto");
    assert.equal(await contarLineas(), 4, "y 4 líneas, no 8 ni 12");
  }

  // ── 11. Confirmación con precios pendientes: no escribe y no consume ──
  const ana = await post({ input: "Presupuesto para Ana de 3 focos a 20 euros" });
  const borradorAna = ana.json.draft;
  assert.deepEqual(ana.json.totals.incomplete, [], "borrador completo");

  const puerta = await post({ input: "confirmar", draft: borradorAna });
  assert.ok(puerta.json.pending_action, "se abre la puerta de confirmación");
  const tokenAna = puerta.json.pending_action.token;

  // Un borrador manipulado (o editado) sin precios NO puede guardarse, y el token
  // sigue vivo para poder confirmarlo cuando el dato esté completo.
  const sinPrecio = {
    ...borradorAna,
    items: borradorAna.items.map((item: any) => ({ ...item, unit_price: null })),
  };
  const intentoInvalido = await post({ confirm_token: tokenAna, draft: sinPrecio });
  assert.equal(intentoInvalido.status, 400, "no se guarda un presupuesto con precios pendientes");
  assert.match(String(intentoInvalido.json.error), /Faltan precios/i);
  assert.equal(await contarPresupuestos(), 1, "no se ha escrito nada más");

  const guardadoFinal = await post({ confirm_token: tokenAna, draft: borradorAna });
  assert.match(String(guardadoFinal.json.answer), /guardado/i);
  assert.equal(await contarPresupuestos(), 2, "ahora sí: un segundo presupuesto, no dos");

  // ── 12. Cancelar descarta el borrador sin escribir ────────────────────
  const aCancelar = await post({ input: "Presupuesto para Luis de 1 cuadro a 200 euros" });
  const cancelado = await post({ input: "cancela", draft: aCancelar.json.draft });
  assert.match(String(cancelado.json.answer), /descartado/i);
  assert.equal(cancelado.json.draft, null, "el borrador se descarta");
  assert.equal(await contarPresupuestos(), 2, "cancelar no escribe");

  // ── 13. Guarda de seguridad eléctrica: nunca acción persistida ────────
  // Sin borrador en curso no hay nada que conservar (y nada que crear).
  const peligro = await post({ input: "Cambia el magnetotérmico con tensión" });
  assert.equal(peligro.json.source, "safety");
  assert.equal(peligro.json.draft, null, "una frase peligrosa no crea borrador");
  assert.equal(peligro.json.pending_action, null, "ni abre ninguna acción");
  assert.equal(await contarPresupuestos(), 2, "y por supuesto no guarda nada");

  // CON borrador en curso la advertencia NO puede costarle al usuario su trabajo
  // (ver el bloque dedicado al final: la guarda conserva el borrador intacto).

  // ── 14. AMBIGÜEDAD: si hay dos líneas que coinciden, PREGUNTA ─────────
  const dosLineas = await post({ input: "Presupuesto para Marta de 2 tubos de PVC y 3 tubos de cobre a 5 euros" });
  const borradorDos = dosLineas.json.draft;
  assert.equal(borradorDos.items.length, 2, "dos partidas distintas");
  const antesSubtotal = num(dosLineas.json.totals.subtotal);

  const modificarAmbiguo = await post({ input: "cambia los tubos a 8", draft: borradorDos });
  assert.match(String(modificarAmbiguo.json.answer), /varias líneas|A cuál te refieres/i);
  assert.equal(num(modificarAmbiguo.json.totals.subtotal), antesSubtotal, "no cambia nada sin aclarar");

  const quitarAmbiguo = await post({ input: "quita los tubos", draft: borradorDos });
  assert.match(String(quitarAmbiguo.json.answer), /varias líneas|A cuál te refieres/i);
  assert.equal(quitarAmbiguo.json.draft.items.length, 2, "no se elimina ninguna línea sin aclarar");
  assert.equal(await contarPresupuestos(), 2, "preguntar nunca escribe");
});

/**
 * ────────────────────────────────────────────────────────────────────────────
 * P0 — CORRECCIONES HABLADAS Y GUARDA DE SEGURIDAD SIN PÉRDIDA DE TRABAJO
 *
 * Tres defectos de la capa de órdenes, todos con el MISMO síntoma: el usuario
 * habla una corrección correcta y el borrador no cambia (o se pierde).
 *
 *   1. "cambia cuatro enchufes por seis" (SIN artículo, la forma que de verdad se
 *      habla) NO se reconocía como modificación: el objeto cuantificado detrás del
 *      verbo hacía que el intent cayera hasta `general`, así que la respuesta era
 *      una pregunta abierta de IA y la cantidad 4 seguía en el borrador.
 *      Sólo funcionaba la variante con artículo.
 *   2. "cambia el precio a veinte euros" (SIN nombrar la línea) respondía
 *      «No encuentro "precio" en el borrador»: el patrón de cantidad capturaba la
 *      palabra "precio" como si fuera el nombre de una línea.
 *   3. La guarda de seguridad devolvía `draft: null`, y la pantalla asignaba ese
 *      `null` sin condiciones: una sola frase peligrosa BORRABA de la pantalla el
 *      presupuesto que el usuario tenía a medio dictar.
 *
 * Lo que NO cambia: la advertencia de seguridad sigue siendo determinista
 * (`source: "safety"`), la orden peligrosa NO se ejecuta, no se persiste nada y
 * sigue haciendo falta confirmación explícita.
 *
 * AISLAMIENTO: cliente libsql en memoria; nunca se toca electricista.db.
 * ────────────────────────────────────────────────────────────────────────────
 */
/** BD en memoria aislada para las regresiones P0 (nunca toca electricista.db). */
async function abrirEntornoDeBorrador(t: { after: (fn: () => void) => void }) {
  const testDb = createClient({ url: "file::memory:" });
  setDbClientForTesting(testDb);
  await initializeDatabase();

  t.after(() => {
    resetDbClient();
    try {
      testDb.close();
    } catch {
      /* ignore */
    }
  });

  /** Borrador real de la locución obligatoria: 4 líneas, 228 € de base. */
  const borradorInicial = async (): Promise<any> => {
    const step = await post({ input: LOCUCION_EN_LETRA });
    assert.equal(step.status, 200);
    assert.equal(step.json.draft.items.length, 4, "cuatro partidas");
    assert.equal(num(step.json.totals.subtotal), 228, "4x18 + 3x4 + 2x22 + 2x50");
    return step.json.draft;
  };

  return { testDb, borradorInicial };
}

/** D1 — "cambia cuatro enchufes por seis" (SIN artículo): la forma que se habla. */
test("Voz 360 — D1: la corrección de cantidad hablada SIN artículo modifica la MISMA línea", async (t) => {
  const { borradorInicial } = await abrirEntornoDeBorrador(t);
  const base = await borradorInicial();

  const sinArticulo = await post({ input: "cambia cuatro enchufes por seis", draft: base });
  assert.equal(
    sinArticulo.json.intent,
    "electricista:budget_modify_item",
    "la forma hablada SIN artículo debe ser una MODIFICACIÓN, no una pregunta abierta"
  );
  assert.equal(
    sinArticulo.status === 200 && sinArticulo.json.source !== "ai",
    true,
    "no puede resolverse delegando en el modelo"
  );
  assert.equal(sinArticulo.json.draft.items.length, 4, "se corrige LA MISMA línea, no se añade otra");
  assert.equal(num(sinArticulo.json.draft.items[0].quantity), 6, "cantidad 4 → 6 en la línea de enchufes");
  assert.equal(num(sinArticulo.json.draft.items[0].unit_price), 18, "el precio no se toca");
  // 6x18 + 3x4 + 2x22 + 2x50 = 108 + 12 + 44 + 100 = 264
  assert.equal(num(sinArticulo.json.totals.subtotal), 264, "recalculado en el mismo borrador");
  assert.equal(num(sinArticulo.json.totals.total), 319.44, "total con IVA 21 %");
  assert.equal(await contarPresupuestos(), 0, "corregir por voz no guarda nada");

  // La variante CON artículo sigue funcionando igual (no regresión).
  const conArticulo = await post({
    input: "cambia los seis enchufes por cuatro",
    draft: sinArticulo.json.draft,
  });
  assert.equal(conArticulo.json.intent, "electricista:budget_modify_item");
  assert.equal(conArticulo.json.draft.items.length, 4, "sin líneas nuevas");
  assert.equal(num(conArticulo.json.draft.items[0].quantity), 4, "cantidad 6 → 4");
  assert.equal(num(conArticulo.json.totals.subtotal), 228, "vuelve a 228");
});

/** D2 — "cambia el precio a veinte euros": precio SIN nombrar la línea. */
test("Voz 360 — D2: el precio dicho sin nombrar la línea se aplica (o se pregunta)", async (t) => {
  const { borradorInicial } = await abrirEntornoDeBorrador(t);

  const baseDos = await borradorInicial();

  const precioSinLinea = await post({ input: "cambia el precio a veinte euros", draft: baseDos });
  assert.equal(
    precioSinLinea.json.intent,
    "electricista:budget_modify_item",
    "es una modificación del borrador"
  );
  assert.doesNotMatch(
    String(precioSinLinea.json.answer),
    /No encuentro/i,
    "«precio» NO es el nombre de una línea: no puede responderse con un error"
  );
  assert.equal(precioSinLinea.json.draft.items.length, 4, "no se añade ninguna línea");

  const conPrecio20 = precioSinLinea.json.draft.items.filter(
    (item: any) => num(item.unit_price) === 20
  );
  assert.equal(conPrecio20.length, 1, "«a veinte euros» se aplica como precio 20 a UNA sola línea");
  assert.equal(
    num(precioSinLinea.json.draft.items[3].unit_price),
    20,
    "la línea señalada es la última tocada del borrador (la recién dictada: las horas)"
  );
  // 4x18 + 3x4 + 2x22 + 2x20 = 72 + 12 + 44 + 40 = 168
  assert.equal(num(precioSinLinea.json.totals.subtotal), 168, "base recalculada");
  assert.equal(num(precioSinLinea.json.totals.total), 203.28, "total con IVA 21 %");
  assert.equal(await contarPresupuestos(), 0, "corregir por voz no guarda nada");

  // Si de verdad NO se puede saber a qué línea se refiere, se PREGUNTA: ni se
  // inventa una línea ni se responde con un error.
  const huerfano = {
    revision: 1,
    client_name: "",
    client_candidates: [],
    tax_rate: 21,
    notes: [],
    items: [
      {
        id: "linea-desconocida-1",
        description: "Cable",
        quantity: 1,
        unit: "m",
        unit_price: 5,
        total: 5,
      },
      {
        id: "linea-desconocida-2",
        description: "Tubo",
        quantity: 1,
        unit: "ud",
        unit_price: 5,
        total: 5,
      },
    ],
  };
  const sinSaberCual = await post({ input: "cambia el precio a veinte euros", draft: huerfano });
  assert.match(
    String(sinSaberCual.json.answer),
    /a qué línea|cuál/i,
    "con dos líneas y sin poder decidir, debe PREGUNTAR"
  );
  assert.doesNotMatch(String(sinSaberCual.json.answer), /No encuentro/i, "preguntar no es fallar");
  assert.equal(num(sinSaberCual.json.totals.subtotal), 10, "no cambia nada sin aclarar");
});

/** D3 — la guarda de seguridad ADVIERTE pero no destruye el borrador en curso. */
test("Voz 360 — D3: una frase peligrosa advierte sin descartar el borrador del usuario", async (t) => {
  const { borradorInicial } = await abrirEntornoDeBorrador(t);

  const baseTres = await borradorInicial();
  const antesDelAviso = await contarPresupuestos();

  const peligro = await post({
    input: "cambia el magnetotérmico bajo tensión",
    draft: baseTres,
  });

  assert.equal(peligro.json.source, "safety", "la guarda es determinista y no se delega al modelo");
  assert.match(
    String(peligro.json.answer),
    /ADVERTENCIA DE SEGURIDAD|5 reglas de oro/i,
    "la advertencia obligatoria se sigue mostrando"
  );
  assert.equal(peligro.json.pending_action, null, "una orden peligrosa no abre ninguna acción");
  assert.equal(await contarPresupuestos(), antesDelAviso, "y no persiste nada");

  assert.ok(
    peligro.json.draft,
    "P0: la frase peligrosa NO puede descartar el borrador del usuario"
  );
  assert.equal(
    peligro.json.draft.items.length,
    baseTres.items.length,
    "el borrador sobrevive con sus líneas"
  );
  assert.equal(num(peligro.json.draft.items[2].quantity), 2, "línea del magnetotérmico intacta");
  assert.equal(
    num(peligro.json.draft.items[2].unit_price),
    22,
    "la orden peligrosa NO se ha ejecutado sobre el borrador"
  );
  assert.equal(
    num(peligro.json.totals.subtotal),
    228,
    "los totales del borrador conservado siguen siendo los suyos"
  );
});
