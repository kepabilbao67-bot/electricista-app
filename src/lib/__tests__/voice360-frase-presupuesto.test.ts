/**
 * Voz 360 — P0: la locución de presupuesto debe producir las PARTIDAS correctas
 * y quedarse en BORRADOR (sin guardar nada).
 *
 * FALLO REAL (móvil, APK): al dictar
 *   "Presupuesto para Juan Pérez: dos bombillas a 25 euros cada una y dos horas
 *    de trabajo a 50 euros la hora."
 * el motor devolvía UNA sola línea con el precio metido en la descripción
 * ("Bombillas a 25 euros cada una y dos horas ..."), precio pendiente y
 * subtotal 0 €. Es decir: lo hablado NO llegaba a formar el presupuesto.
 *
 * CAUSA: el extractor de partidas usaba una única expresión regular sobre todo
 * el texto que exigía coma, punto y coma o fin de frase como separador. Una
 * locución dictada separa las partidas con " y ", así que todo se fundía en una
 * línea. Ahora se segmenta con splitItemSegments() (el mismo separador que ya
 * usa el parser de pedidos por voz, que solo corta ante una cantidad nueva).
 *
 * IMPORTANTE: la transcripción de voz y el texto escrito entran por el MISMO
 * campo `input` del MISMO endpoint, así que estas aserciones cubren las dos
 * vías: no hay lógica paralela de voz.
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

const ROUTE_URL = "http://localhost:3000/api/asistente/voice360";

/** Locución exacta de la prueba funcional obligatoria. */
const FRASE =
  "Presupuesto para Juan Pérez: dos bombillas a 25 euros cada una y dos horas de trabajo a 50 euros la hora.";

async function postVoice360(body: unknown): Promise<{ status: number; json: any }> {
  const request = new NextRequest(ROUTE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const response = await handleVoice360Route(request);
  return { status: response.status, json: await response.json() };
}

function num(value: unknown): number {
  return Number(value);
}

test("Voz 360 — la frase de presupuesto produce 2 partidas y subtotal 150 €", async (t) => {
  const previousTestDbUrl = process.env.TEST_DATABASE_URL;
  const testDb = createClient({ url: "file::memory:" });
  process.env.TEST_DATABASE_URL = `file:${process.env.TEMP ?? "."}/voice360-frase-test.db`;
  setDbClientForTesting(testDb);
  await initializeDatabase();
  assert.equal(getDbClient(), testDb, "el motor debe usar la BD de pruebas en memoria");

  t.after(() => {
    resetDbClient();
    if (previousTestDbUrl === undefined) delete process.env.TEST_DATABASE_URL;
    else process.env.TEST_DATABASE_URL = previousTestDbUrl;
    try {
      testDb.close();
    } catch {
      /* ignore */
    }
  });

  const step = await postVoice360({ input: FRASE });
  assert.equal(step.status, 200);
  assert.equal(step.json.intent, "electricista:budget_draft", "debe ser un BORRADOR");

  const items = step.json.draft.items as Array<Record<string, unknown>>;
  assert.equal(items.length, 2, "la frase tiene DOS partidas, no una");

  // Partida 1: 2 bombillas x 25 € = 50 €
  assert.equal(num(items[0].quantity), 2, "cantidad de bombillas");
  assert.equal(num(items[0].unit_price), 25, "precio unitario de las bombillas");
  assert.match(
    String(items[0].description),
    /bombilla/i,
    "la primera partida debe ser de bombillas"
  );

  // Partida 2: 2 horas x 50 € = 100 €
  assert.equal(num(items[1].quantity), 2, "cantidad de horas");
  assert.equal(num(items[1].unit_price), 50, "precio unitario de la hora");
  assert.match(String(items[1].description), /hora/i, "la segunda partida debe ser horas");

  // Totales exigidos por la prueba funcional
  const totals = step.json.totals;
  assert.equal(num(totals.subtotal), 150, "subtotal antes de impuestos = 50 + 100");
  assert.deepEqual(totals.incomplete, [], "no debe quedar ninguna partida sin precio");
  assert.equal(num(totals.tax_amount), 31.5, "IVA 21% de 150");
  assert.equal(num(totals.total), 181.5, "total con IVA");

  // El cliente se conserva completo, con acentos incluidos.
  assert.equal(step.json.draft.client_name, "Juan Pérez", "el nombre no debe truncarse");

  // Debe seguir siendo un borrador: nada persistido hasta confirmar.
  const saved = await testDb.execute("SELECT COUNT(*) as count FROM budgets");
  assert.equal(num(saved.rows[0].count), 0, "no debe guardarse ningún presupuesto sin confirmar");

  // La misma frase es la que envía el texto escrito: mismo borrador.
  const otra = await postVoice360({ input: FRASE });
  assert.equal(otra.json.draft.items.length, 2);
  assert.equal(num(otra.json.totals.subtotal), 150, "texto y voz comparten el mismo motor");
});

test("Voz 360 — regresiones: una partida por coma y sin precio pendiente", async (t) => {
  const previousTestDbUrl = process.env.TEST_DATABASE_URL;
  const testDb = createClient({ url: "file::memory:" });
  process.env.TEST_DATABASE_URL = `file:${process.env.TEMP ?? "."}/voice360-frase-test2.db`;
  setDbClientForTesting(testDb);
  await initializeDatabase();

  t.after(() => {
    resetDbClient();
    if (previousTestDbUrl === undefined) delete process.env.TEST_DATABASE_URL;
    else process.env.TEST_DATABASE_URL = previousTestDbUrl;
    try {
      testDb.close();
    } catch {
      /* ignore */
    }
  });

  // Sigue produciendo UNA línea con su precio (no debe romperse al segmentar).
  const una = await postVoice360({ input: "Presupuesto para Test Cliente: 4 horas a 40 euros" });
  assert.equal(una.json.draft.items.length, 1, "una sola partida");
  assert.equal(num(una.json.draft.items[0].quantity), 4);
  assert.equal(num(una.json.draft.items[0].unit_price), 40);
  assert.equal(num(una.json.totals.subtotal), 160);

  // Varias partidas separadas por coma siguen funcionando.
  const dos = await postVoice360({ input: "Presupuesto de 3 metros de cable a 4 euros, 2 horas a 50 euros" });
  assert.equal(dos.json.draft.items.length, 2, "dos partidas separadas por coma");
  assert.equal(num(dos.json.totals.subtotal), 112, "3x4 + 2x50 = 112");

  // " y " NO corta si no le sigue una cantidad: sigue siendo una partida.
  const pegada = await postVoice360({ input: "Presupuesto de 2 tubos de PVC y cobre a 10 euros" });
  assert.equal(pegada.json.draft.items.length, 1, "sin cantidad detrás, ' y ' no separa");
});

/**
 * ────────────────────────────────────────────────────────────────────────────
 * D4 — GUARDA DE SEGURIDAD: COBERTURA DE TRABAJO EN TENSIÓN
 *
 * El patrón anterior exigía la preposición `con`/`sin`/`en` pegada a la palabra
 * clave, así que las formas normales de decir "voy a trabajar con tensión" NO se
 * detectaban: "cambia el magnetotérmico bajo tensión", "quita el magnetotérmico
 * con corriente", "sin bajar el general", "corta el cable con la mano mojada".
 *
 * La guarda es determinista (no pasa por el modelo) y debe seguir sin dar falsos
 * positivos que bloqueen un presupuesto normal.
 * ────────────────────────────────────────────────────────────────────────────
 */
test("Voz 360 — la guarda de seguridad cubre el trabajo en tensión y no bloquea presupuestos", () => {
  // Frases PELIGROSAS que deben detectarse (todas son órdenes reales de trabajo).
  const peligrosas = [
    "cambia el magnetotérmico bajo tensión",
    "trabaja con el cuadro en tensión",
    "quita el magnetotérmico con corriente",
    "sin bajar el general",
    "corta el cable con la mano mojada",
    "hazlo sin cortar la corriente",
    "sigue trabajando sin desconectar",
    "manipula el cuadro en caliente",
    "toca el cuadro con las manos mojadas",
  ];
  for (const frase of peligrosas) {
    assert.equal(
      isDangerousElectricalQuery(frase),
      true,
      `"${frase}" debe activar la guarda de seguridad`
    );
  }

  // Frases NORMALES de presupuesto / consulta: NUNCA deben bloquearse.
  const normales = [
    "Haz un presupuesto para Juan Pérez, cuatro enchufes a dieciocho euros",
    "cambia los cuatro enchufes por seis",
    "cambia el precio a veinte euros",
    "cambia el magnetotérmico a 25 euros",
    "Pon el precio del cable a 8 euros",
    "añade dos horas de trabajo a cincuenta euros",
    "quita el cable",
    "¿cuánto cuesta un comprobador de tensión?",
    "presupuesto de un cuadro de distribución eléctrica a 200 euros",
    "mano de obra: dos horas a cincuenta euros",
    "sin IVA, el presupuesto de 3 metros de cable",
  ];
  for (const frase of normales) {
    assert.equal(
      isDangerousElectricalQuery(frase),
      false,
      `"${frase}" es una frase normal y NO puede bloquearse`
    );
  }
});
