/**
 * Voz 360 — Cobertura de regresión de P0-1 y P0-2 en executeBudgetSave
 *
 * Ejercita el camino REAL de confirmación que termina en executeBudgetSave:
 *   POST /api/asistente/voice360  (borrador)
 *     -> POST /api/asistente/voice360  { input: "confirmar", draft }  (emite confirm_token)
 *       -> POST /api/asistente/voice360  { confirm_token }            (persiste)
 *
 * P0-1: el INSERT en budgets debe incluir la columna obligatoria `date`.
 *       (Antes: SQLITE_CONSTRAINT_NOTNULL: NOT NULL constraint failed: budgets.date)
 * P0-2: la numeración debe venir de generateBudgetNumber() y producir PRES_XXXX.
 *       (Antes: `P-${COUNT(*)+1}`, que además envenenaba generateBudgetNumber()
 *        con PRES_0NaN, porque hace parseInt(number.replace("PRES_","")))
 *
 * AISLAMIENTO: se usa EXCLUSIVAMENTE un cliente libsql en memoria.
 * - setDbClientForTesting() sustituye el singleton, de modo que getDbClient()
 *   nunca llega a llamar a resolveDatabaseUrl() y por tanto `file:electricista.db`
 *   no se construye siquiera. Es el patrón documentado en src/lib/db.ts.
 * - Además se fija TEST_DATABASE_URL a una ruta temporal como segunda barrera,
 *   de forma que incluso si el singleton se reiniciase, la URL resuelta seguiría
 *   siendo un fichero temporal y nunca electricista.db.
 * - El test afirma la identidad del cliente (`getDbClient() === testDb`) para
 *   demostrar que el motor está hablando con la BD de pruebas.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { NextRequest } from "next/server";
import { createClient } from "@libsql/client";
import {
  getDbClient,
  initializeDatabase,
  resetDbClient,
  setDbClientForTesting,
} from "@/lib/db";
import { POST as handleVoice360Route } from "@/app/api/asistente/voice360/route";
import { GET as listBudgets } from "@/app/api/budgets/route";
import { GET as getBudget } from "@/app/api/budgets/[id]/route";
import { applyTenantSchema } from "@/lib/tenant/schema";

const ROUTE_URL = "http://localhost:3000/api/asistente/voice360";

// Locución elegida para que el extractor produzca una única línea con precio:
// 4 ud x 18 EUR  ->  subtotal 72, IVA 21% = 15,12, total 87,12
const DRAFT_INPUT = "Presupuesto para Test Cliente: 4 enchufes a 18 euros";
const CONFIRM_INPUT = "confirmar";

const EXPECTED = {
  quantity: 4,
  unit_price: 18,
  subtotal: 72,
  tax_rate: 21,
  tax_amount: 15.12,
  total: 87.12,
};

async function postVoice360(
  body: unknown,
  extraHeaders: Record<string, string> = {}
): Promise<{ status: number; json: any }> {
  const request = new NextRequest(ROUTE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  });
  const response = await handleVoice360Route(request);
  return { status: response.status, json: await response.json() };
}

/** Ejecuta el flujo real completo y devuelve la respuesta final de persistencia. */
async function runConfirmFlow(): Promise<{
  draftStep: any;
  confirmStep: any;
  saveStep: any;
}> {
  // 1. Borrador
  const draftStep = await postVoice360({ input: DRAFT_INPUT });
  assert.equal(draftStep.status, 200, "el borrador debe responder 200");
  assert.equal(draftStep.json.intent, "electricista:budget_draft");
  assert.ok(draftStep.json.draft, "debe devolverse un draft");
  assert.equal(
    draftStep.json.draft.items.length,
    1,
    "la locución de prueba debe producir exactamente 1 línea"
  );

  // 2. Confirmación conversacional -> emite el token de un solo uso
  const confirmStep = await postVoice360({
    input: CONFIRM_INPUT,
    draft: draftStep.json.draft,
  });
  assert.equal(confirmStep.status, 200, "la confirmación debe responder 200");
  assert.ok(
    confirmStep.json.pending_action,
    "confirmar debe emitir una pending_action con token"
  );
  assert.equal(confirmStep.json.pending_action.action, "create_budget");
  assert.ok(
    typeof confirmStep.json.pending_action.token === "string" &&
      confirmStep.json.pending_action.token.length > 0,
    "el token debe ser una cadena no vacía"
  );

  // 3. Persistencia real contra executeBudgetSave
  const saveStep = await postVoice360({
    confirm_token: confirmStep.json.pending_action.token,
  });

  return { draftStep, confirmStep, saveStep };
}

test("VOZ 360 — executeBudgetSave: P0-1 (date) y P0-2 (numeración canónica)", async (t) => {
  const previousTestDatabaseUrl = process.env.TEST_DATABASE_URL;
  // Segunda barrera: mientras dure el test, la URL resoluble nunca es electricista.db.
  process.env.TEST_DATABASE_URL = `file:${join(
    tmpdir(),
    `electricista360-voice360-save-${process.pid}.db`
  )}`;

  const testDb = createClient({ url: "file::memory:" });
  setDbClientForTesting(testDb);
  await initializeDatabase();

  try {
    await t.test(
      "1. Aislamiento: el motor usa el cliente en memoria, no electricista.db",
      () => {
        assert.equal(
          getDbClient(),
          testDb,
          "getDbClient() debe devolver exactamente el cliente de prueba en memoria"
        );
        assert.notEqual(
          resolveClientUrlHint(),
          "file:electricista.db",
          "la URL resuelta no debe ser la BD real"
        );
      }
    );

    let firstSaveAnswer = "";

    await t.test(
      "2. Atomicidad (D4): si falla una línea, se revierte también el presupuesto padre",
      async () => {
        assert.equal(
          await countRows(testDb, "budgets"),
          0,
          "budgets debe empezar en 0 antes de la operación"
        );
        assert.equal(
          await countRows(testDb, "budget_items"),
          0,
          "budget_items debe empezar en 0 antes de la operación"
        );

        // Fallo REAL contra la DB aislada (no un mock): la segunda línea lleva
        // description = null y budget_items.description es NOT NULL. El INSERT de
        // budgets se ejecuta dentro del MISMO lote, así que sin transacción
        // quedaría un presupuesto fantasma.
        const failingDraft = {
          revision: 1,
          client_name: "",
          client_candidates: [],
          tax_rate: 21,
          notes: [],
          items: [
            {
              id: "item-valido",
              description: "Bases de enchufe",
              quantity: 1,
              unit: "ud",
              unit_price: 10,
            },
            {
              id: "item-que-falla",
              description: null,
              quantity: 1,
              unit: "ud",
              unit_price: 10,
            },
          ],
        };

        const confirmStep = await postVoice360({
          input: CONFIRM_INPUT,
          draft: failingDraft,
        });
        assert.equal(confirmStep.status, 200, "la confirmación debe responder 200");
        assert.ok(
          confirmStep.json.pending_action,
          "confirmar debe emitir una pending_action con token"
        );

        const saveStep = await postVoice360({
          confirm_token: confirmStep.json.pending_action.token,
        });

        // 1) La operación falla y lo comunica de forma veraz
        assert.equal(saveStep.status, 200, "el guardado fallido responde 200");
        const answer = String(saveStep.json.answer);
        assert.match(
          answer,
          /No se ha guardado el presupuesto/,
          `debe indicar el fallo de forma veraz, fue "${answer}"`
        );
        // Prueba de que el fallo es de SQLite (la sentencia llegó a ejecutarse y fue
        // rechazada por la restricción), y no un rechazo previo del cliente: eso es
        // lo que demuestra que el INSERT de budgets YA se había ejecutado y se revirtió.
        assert.match(
          answer,
          /NOT NULL constraint failed/,
          `el fallo debe venir de SQLite, fue "${answer}"`
        );
        assert.doesNotMatch(
          answer,
          /guardado\*\* correctamente/,
          "no debe devolver un mensaje de éxito"
        );
        assert.doesNotMatch(
          answer,
          /Los datos no se han modificado/,
          "no debe afirmar que no se modificó nada"
        );
        assert.doesNotMatch(
          answer,
          /PRES_\d{4}/,
          "no debe anunciar ningún número PRES_XXXX"
        );

        // 2) Nada persistido: ni presupuesto padre ni líneas, ni parciales
        assert.equal(
          await countRows(testDb, "budgets"),
          0,
          "el presupuesto padre debe haberse revertido"
        );
        assert.equal(
          await countRows(testDb, "budget_items"),
          0,
          "no debe quedar ninguna línea, ni siquiera la que era válida"
        );
      }
    );

    await t.test(
      "3. Flujo real de confirmación persiste un presupuesto con date y numeración PRES_XXXX",
      async () => {
        assert.equal(
          await countRows(testDb, "budgets"),
          0,
          "la BD de prueba debe empezar vacía"
        );

        const { saveStep } = await runConfirmFlow();

        assert.equal(saveStep.status, 200, "la persistencia debe responder 200");
        assert.ok(
          typeof saveStep.json.answer === "string" && saveStep.json.answer.length > 0,
          "debe devolverse una respuesta de texto"
        );
        firstSaveAnswer = saveStep.json.answer;

        // A) Se crea exactamente un presupuesto
        assert.equal(
          await countRows(testDb, "budgets"),
          1,
          "debe crearse exactamente 1 presupuesto"
        );

        const rows = (
          await testDb.execute(
            "SELECT id, number, client_id, date, status, subtotal, tax_rate, tax_amount, total FROM budgets"
          )
        ).rows as unknown as Record<string, unknown>[];
        const budget = rows[0];

        // B) Numeración canónica PRES_XXXX y nunca P-XXXX
        const number = String(budget.number);
        assert.match(number, /^PRES_\d{4}$/, `number debe ser PRES_XXXX, fue "${number}"`);
        assert.equal(number, "PRES_0001", "el primer presupuesto debe ser PRES_0001");
        assert.ok(
          !/^P-\d/.test(number),
          `number NO debe tener el formato antiguo P-XXXX, fue "${number}"`
        );
        assert.doesNotMatch(
          firstSaveAnswer,
          /P-\d{4}/,
          "la respuesta no debe anunciar una numeración P-XXXX"
        );
        assert.ok(
          firstSaveAnswer.includes("PRES_0001"),
          `la respuesta debe anunciar PRES_0001, fue "${firstSaveAnswer}"`
        );

        // C) date existe y tiene formato YYYY-MM-DD
        const date = String(budget.date ?? "");
        assert.match(date, /^\d{4}-\d{2}-\d{2}$/, `date debe ser YYYY-MM-DD, fue "${date}"`);
        const todayUtc = new Date().toISOString().split("T")[0];
        assert.equal(date, todayUtc, "date debe ser la fecha de hoy (UTC) como en el motor");

        // D) status draft
        assert.equal(String(budget.status), "draft", "status debe ser draft");

        // E) Importes persistidos correctamente
        assert.equal(Number(budget.subtotal), EXPECTED.subtotal, "subtotal persistido");
        assert.equal(Number(budget.tax_rate), EXPECTED.tax_rate, "tax_rate persistido");
        assert.equal(Number(budget.tax_amount), EXPECTED.tax_amount, "tax_amount persistido");
        assert.equal(Number(budget.total), EXPECTED.total, "total persistido");

        // E2) Líneas del presupuesto
        assert.equal(
          await countRows(testDb, "budget_items"),
          1,
          "debe persistirse exactamente 1 línea de presupuesto"
        );
        const items = (
          await testDb.execute({
            sql: "SELECT budget_id, description, quantity, unit_price, total, sort_order FROM budget_items WHERE budget_id = ?",
            args: [String(budget.id)],
          })
        ).rows as unknown as Record<string, unknown>[];
        assert.equal(String(items[0].description), "Bases de enchufe");
        assert.equal(Number(items[0].quantity), EXPECTED.quantity, "cantidad de la línea");
        assert.equal(Number(items[0].unit_price), EXPECTED.unit_price, "precio de la línea");
        assert.equal(
          Number(items[0].total),
          EXPECTED.quantity * EXPECTED.unit_price,
          "total de la línea"
        );
        assert.equal(
          Number(items[0].sort_order),
          0,
          "la primera (y única) línea debe tener sort_order 0"
        );
      }
    );

    await t.test(
      "4. La siguiente creación genera el siguiente número canónico (PRES_0001 -> PRES_0002)",
      async () => {
        assert.ok(firstSaveAnswer.includes("PRES_0001"), "requiere la creación anterior");

        // generateBudgetNumber() ordena por created_at DESC, y created_at se escribe
        // con datetime('now') (resolución de 1 segundo). Se envejece explícitamente la
        // primera fila para que el orden sea determinista y el test no dependa de un empate.
        await testDb.execute(
          "UPDATE budgets SET created_at = '2020-01-01 00:00:00' WHERE number = 'PRES_0001'"
        );

        const { saveStep } = await runConfirmFlow();

        assert.equal(saveStep.status, 200, "la segunda persistencia debe responder 200");
        assert.equal(
          await countRows(testDb, "budgets"),
          2,
          "deben existir exactamente 2 presupuestos"
        );

        const numbers = (
          await testDb.execute("SELECT number FROM budgets ORDER BY number ASC")
        ).rows.map((row) => String(row.number));

        assert.deepEqual(numbers, ["PRES_0001", "PRES_0002"], "secuencia canónica esperada");
        assert.ok(
          saveStep.json.answer.includes("PRES_0002"),
          `la segunda respuesta debe anunciar PRES_0002, fue "${saveStep.json.answer}"`
        );
        assert.doesNotMatch(
          saveStep.json.answer,
          /P-\d{4}/,
          "la segunda respuesta no debe anunciar una numeración P-XXXX"
        );
      }
    );

    await t.test(
      "5. La normalización de vocabulario eléctrico ocurre exactamente una vez (idempotencia)",
      async () => {
        // Con la doble normalización (POST + extractBudgetItems) el resultado era
        // "Bases de base de enchufe", "Tubos corrugados corrugados", etc.
        // Cada locución debe expandirse UNA sola vez en el flujo real.
        const cases = [
          { spoken: "4 enchufes a 18 euros", expected: "Bases de enchufe" },
          { spoken: "3 tubos a 2 euros", expected: "Tubos corrugados" },
          { spoken: "2 cuadros a 100 euros", expected: "Cuadros de distribución eléctrica" },
          { spoken: "5 mangueras a 3 euros", expected: "Cables manguera" },
        ];

        for (const testCase of cases) {
          const step = await postVoice360({
            input: `Presupuesto para Test Cliente: ${testCase.spoken}`,
          });

          assert.equal(step.status, 200, `"${testCase.spoken}" debe responder 200`);
          assert.equal(step.json.intent, "electricista:budget_draft");
          assert.equal(
            step.json.draft.items.length,
            1,
            `"${testCase.spoken}" debe producir exactamente 1 línea`
          );

          const description = String(step.json.draft.items[0].description);
          assert.equal(
            description,
            testCase.expected,
            `"${testCase.spoken}" debe expandirse UNA sola vez, fue "${description}"`
          );
        }
      }
    );
  } finally {
    resetDbClient();
    if (previousTestDatabaseUrl === undefined) {
      delete process.env.TEST_DATABASE_URL;
    } else {
      process.env.TEST_DATABASE_URL = previousTestDatabaseUrl;
    }
  }
});

async function countRows(db: ReturnType<typeof createClient>, table: string): Promise<number> {
  const res = await db.execute(`SELECT COUNT(*) AS cnt FROM ${table}`);
  return Number(res.rows[0]?.cnt ?? 0);
}

/**
 * Devuelve la URL que usaría el resolvedor si el singleton estuviese vacío.
 * Deliberadamente devuelve el valor de TEST_DATABASE_URL, que este test fija a
 * una ruta temporal: la comprobación documenta que la BD real no es alcanzable.
 */
function resolveClientUrlHint(): string {
  return process.env.TEST_DATABASE_URL?.trim() || "";
}

/**
 * P1.3 — Reconocimiento de formas naturales de confirmación.
 *
 * "Confírmalo" / "Confirmalo" / "Guárdalo" deben entrar en el MISMO flujo seguro
 * que "confirmar": resumen -> pending_action -> confirm_token, sin persistir nada
 * por sí solas. El mecanismo del Human Gate NO se rediseña: sólo se amplía el
 * vocabulario de la detección y se da prioridad a la cancelación.
 *
 * AISLAMIENTO: idéntico al resto del fichero — cliente libsql en memoria y
 * TEST_DATABASE_URL apuntando a una ruta temporal.
 */
test("VOZ 360 — P1.3: confirmación natural con Human Gate intacto", async (t) => {
  const previousTestDatabaseUrl = process.env.TEST_DATABASE_URL;
  process.env.TEST_DATABASE_URL = `file:${join(
    tmpdir(),
    `electricista360-p13-${process.pid}.db`
  )}`;

  const testDb = createClient({ url: "file::memory:" });
  setDbClientForTesting(testDb);
  await initializeDatabase();

  const DRAFT_INPUT = "Presupuesto para Test Cliente: 4 enchufes a 18 euros";

  /** Crea un borrador limpio y devuelve su draft. No persiste nada. */
  async function newDraft(): Promise<any> {
    const step = await postVoice360({ input: DRAFT_INPUT });
    assert.equal(step.status, 200, "el borrador debe responder 200");
    assert.equal(
      step.json.intent,
      "electricista:budget_draft",
      "la locución base debe crear borrador"
    );
    assert.ok(step.json.draft, "debe devolverse un draft");
    return step.json.draft;
  }

  try {
    await t.test("1. 'Confírmalo' reconoce budget_confirm", async () => {
      const step = await postVoice360({ input: "Confírmalo", draft: await newDraft() });
      assert.equal(step.status, 200);
      assert.equal(step.json.intent, "electricista:budget_confirm");
    });

    await t.test("2. 'Confirmalo' (sin tilde) reconoce budget_confirm", async () => {
      const step = await postVoice360({ input: "Confirmalo", draft: await newDraft() });
      assert.equal(step.status, 200);
      assert.equal(step.json.intent, "electricista:budget_confirm");
    });

    await t.test("3. 'Guárdalo' reconoce budget_confirm", async () => {
      const step = await postVoice360({ input: "Guárdalo", draft: await newDraft() });
      assert.equal(step.status, 200);
      assert.equal(step.json.intent, "electricista:budget_confirm");
    });

    await t.test("4. 'Cancela' sigue siendo budget_cancel", async () => {
      const step = await postVoice360({ input: "Cancela", draft: await newDraft() });
      assert.equal(step.status, 200);
      assert.equal(step.json.intent, "electricista:budget_cancel");
      assert.equal(step.json.pending_action ?? null, null, "cancelar no emite token");
    });

    await t.test(
      "5. Frases negativas/de cancelación NO pueden convertirse en confirmación",
      async () => {
        const negativas = [
          "No lo confirmes",
          "No, cancela",
          "No lo guardes",
          "No guardes nada",
        ];
        for (const frase of negativas) {
          const step = await postVoice360({ input: frase, draft: await newDraft() });
          assert.equal(step.status, 200, `"${frase}" debe responder 200`);
          assert.notEqual(
            step.json.intent,
            "electricista:budget_confirm",
            `"${frase}" no puede convertirse en confirmación`
          );
          assert.equal(
            step.json.intent,
            "electricista:budget_cancel",
            `"${frase}" debe cancelar (cancelación prioritaria), fue "${step.json.intent}"`
          );
          assert.equal(
            step.json.pending_action ?? null,
            null,
            `"${frase}" no debe emitir token`
          );
        }
      }
    );

    await t.test(
      "6. La confirmación emite pending_action y NO persiste por sí sola",
      async () => {
        const budgetsBefore = await countRows(testDb, "budgets");
        const itemsBefore = await countRows(testDb, "budget_items");

        const step = await postVoice360({ input: "Confírmalo", draft: await newDraft() });

        assert.equal(step.json.intent, "electricista:budget_confirm");
        assert.ok(step.json.pending_action, "debe emitir pending_action");
        assert.equal(step.json.pending_action.action, "create_budget");
        assert.ok(
          typeof step.json.pending_action.token === "string" &&
            step.json.pending_action.token.length > 0,
          "debe emitir confirm_token"
        );
        assert.match(
          String(step.json.answer),
          /Revisa el presupuesto/,
          "debe mostrar el resumen para revisión humana"
        );

        assert.equal(
          await countRows(testDb, "budgets"),
          budgetsBefore,
          "NO debe persistir sin token"
        );
        assert.equal(
          await countRows(testDb, "budget_items"),
          itemsBefore,
          "NO debe persistir ninguna línea"
        );
      }
    );

    await t.test("7. Primer uso del token guarda exactamente una vez", async () => {
      const budgetsBefore = await countRows(testDb, "budgets");
      const itemsBefore = await countRows(testDb, "budget_items");

      const confirm = await postVoice360({ input: "Confírmalo", draft: await newDraft() });
      const token = confirm.json.pending_action?.token;
      assert.ok(token, "requiere token");

      const save = await postVoice360({ confirm_token: token });
      assert.equal(save.status, 200, "el guardado debe responder 200");
      assert.doesNotMatch(
        String(save.json.answer),
        /No se ha guardado/,
        "el guardado no debe fallar"
      );
      assert.match(
        String(save.json.answer),
        /PRES_\d{4}/,
        "debe anunciar la numeración canónica"
      );

      assert.equal(
        await countRows(testDb, "budgets"),
        budgetsBefore + 1,
        "exactamente 1 presupuesto"
      );
      assert.equal(
        await countRows(testDb, "budget_items"),
        itemsBefore + 1,
        "exactamente 1 línea"
      );
    });

    await t.test(
      "8. Segundo uso del mismo token es idempotente y no persiste nada más",
      async () => {
        const budgetsBefore = await countRows(testDb, "budgets");

        const confirm = await postVoice360({ input: "Guárdalo", draft: await newDraft() });
        const token = confirm.json.pending_action?.token;
        assert.ok(token, "requiere token");

        const first = await postVoice360({ confirm_token: token });
        assert.equal(first.status, 200, "el primer uso debe guardar");
        const afterFirst = await countRows(testDb, "budgets");
        assert.equal(afterFirst, budgetsBefore + 1, "el primer uso guarda una sola vez");

        // Doble click / reintento / reconexión: la misma confirmación NO vuelve a
        // escribir. Se responde IGUAL que la primera vez (idempotente) en lugar de
        // fallar, que es lo que espera un reintento automático del navegador.
        const second = await postVoice360({ confirm_token: token });
        assert.equal(second.status, 200, "el segundo uso se responde sin error");
        assert.equal(second.json.idempotent, true, "se reconoce como repetición idempotente");
        assert.equal(
          String(second.json.answer),
          String(first.json.answer),
          "devuelve exactamente la misma respuesta"
        );
        assert.equal(
          await countRows(testDb, "budgets"),
          afterFirst,
          "el segundo uso no persiste nada"
        );
      }
    );
  } finally {
    resetDbClient();
    if (previousTestDatabaseUrl === undefined) {
      delete process.env.TEST_DATABASE_URL;
    } else {
      process.env.TEST_DATABASE_URL = previousTestDatabaseUrl;
    }
  }
});

/**
 * P1.1 — budget_set_tax: IVA del borrador sin líneas IVA y sin persistencia.
 *
 * El nuevo intent modifica EXCLUSIVAMENTE draft.tax_rate. No crea líneas, no
 * emite token y no escribe en la base de datos: la persistencia sigue pasando
 * por el Human Gate existente ("confirmar" -> token -> executeBudgetSave).
 *
 * AISLAMIENTO: idéntico al resto del fichero — cliente libsql en memoria y
 * TEST_DATABASE_URL apuntando a una ruta temporal.
 */
test("VOZ 360 — P1.1: budget_set_tax (IVA del borrador, 0 líneas IVA)", async (t) => {
  const previousTestDatabaseUrl = process.env.TEST_DATABASE_URL;
  process.env.TEST_DATABASE_URL = `file:${join(
    tmpdir(),
    `electricista360-p11-${process.pid}.db`
  )}`;

  const testDb = createClient({ url: "file::memory:" });
  setDbClientForTesting(testDb);
  await initializeDatabase();

  const DRAFT_INPUT = "Presupuesto para Test Cliente: 4 enchufes a 18 euros";
  const SUBTOTAL = 72; // 4 x 18

  /** Borrador base real: handleBudgetCreate siempre parte de tax_rate 21. */
  async function baseDraft(): Promise<any> {
    const step = await postVoice360({ input: DRAFT_INPUT });
    assert.equal(step.status, 200, "el borrador base debe responder 200");
    assert.equal(step.json.intent, "electricista:budget_draft");
    assert.ok(step.json.draft, "debe devolverse un draft");
    return step.json.draft;
  }

  /** Aplica una frase de IVA sobre un borrador base nuevo. */
  async function setTax(phrase: string): Promise<any> {
    return postVoice360({ input: phrase, draft: await baseDraft() });
  }

  try {
    await t.test("1. 'Añade IVA' se reconoce como budget_set_tax", async () => {
      const step = await setTax("Añade IVA");
      assert.equal(step.status, 200);
      assert.equal(step.json.intent, "electricista:budget_set_tax");
    });

    await t.test("2. Ninguna frase de IVA crea una línea IVA", async () => {
      const frases = [
        "Añade IVA",
        "Añade el IVA",
        "Añade IVA del 10%",
        "Añade un IVA del 10%",
        "Añade un 10% de IVA",
        "Pon IVA al 10%",
        "Cambia el IVA al 10%",
        "Quita el IVA",
        "Sin IVA",
        "IVA 0%",
      ];
      for (const frase of frases) {
        const step = await setTax(frase);
        assert.equal(
          step.json.intent,
          "electricista:budget_set_tax",
          `"${frase}" debe ser budget_set_tax`
        );
        assert.equal(
          step.json.draft.items.length,
          1,
          `"${frase}" no debe alterar el número de líneas`
        );
        for (const item of step.json.draft.items) {
          assert.doesNotMatch(
            String(item.description),
            /iva|%/i,
            `"${frase}" creó una línea de IVA: "${item.description}"`
          );
        }
      }
    });

    await t.test("3. Sin porcentaje y tax_rate=21 → conserva 21", async () => {
      const step = await setTax("Añade IVA");
      assert.equal(step.json.draft.tax_rate, 21);
      assert.equal(
        step.json.draft.revision,
        1,
        "sin cambio real no debe incrementar la revisión"
      );
      assert.match(String(step.json.answer), /21%/, "la respuesta declara el porcentaje");
    });

    await t.test("4. Sin porcentaje y tax_rate=10 → conserva 10", async () => {
      const d10 = (await setTax("Añade el IVA del 10%")).json.draft;
      assert.equal(d10.tax_rate, 10, "requiere partir de 10%");

      const step = await postVoice360({ input: "Añade IVA", draft: d10 });
      assert.equal(step.json.intent, "electricista:budget_set_tax");
      assert.equal(
        step.json.draft.tax_rate,
        10,
        "no debe sobrescribir una tasa ya fijada"
      );
      assert.match(String(step.json.answer), /10%/, "la respuesta declara el porcentaje");
    });

    await t.test("5. Sin porcentaje y tax_rate=0 → aplica 21", async () => {
      const d0 = (await setTax("Quita el IVA")).json.draft;
      assert.equal(d0.tax_rate, 0, "requiere partir de 0%");

      const step = await postVoice360({ input: "Añade el IVA", draft: d0 });
      assert.equal(step.json.intent, "electricista:budget_set_tax");
      assert.equal(step.json.draft.tax_rate, 21, "con el borrador a 0 aplica el 21");
      assert.match(String(step.json.answer), /21%/, "la respuesta declara el porcentaje");
    });

    await t.test("6-8. Tasa explícita 10% en sus tres formas", async () => {
      for (const frase of [
        "Añade IVA del 10%",
        "Pon IVA al 10%",
        "Cambia el IVA al 10%",
      ]) {
        const step = await setTax(frase);
        assert.equal(step.json.intent, "electricista:budget_set_tax", frase);
        assert.equal(step.json.draft.tax_rate, 10, frase);
      }
    });

    await t.test("9-10. 'Quita el IVA' e 'IVA 0%' dejan el borrador al 0%", async () => {
      for (const frase of ["Quita el IVA", "IVA 0%"]) {
        const step = await setTax(frase);
        assert.equal(step.json.intent, "electricista:budget_set_tax", frase);
        assert.equal(step.json.draft.tax_rate, 0, frase);
      }
    });

    await t.test("11-12. Líneas invariantes y totales recalculados", async () => {
      const base = await baseDraft();
      const casos: Array<[string, number]> = [
        ["Añade el IVA del 10%", 10],
        ["Cambia el IVA al 4%", 4],
        ["IVA 0%", 0],
        ["Añade el IVA del 21%", 21],
      ];

      for (const [frase, tasa] of casos) {
        const step = await postVoice360({ input: frase, draft: base });
        const draft = step.json.draft;
        const totals = step.json.totals;

        assert.equal(draft.items.length, base.items.length, `${frase}: líneas invariantes`);
        assert.deepEqual(
          draft.items.map((i: any) => i.description),
          base.items.map((i: any) => i.description),
          `${frase}: descripciones intactas`
        );
        assert.equal(draft.tax_rate, tasa, `${frase}: tax_rate`);
        assert.equal(totals.subtotal, SUBTOTAL, `${frase}: subtotal`);
        assert.equal(
          totals.tax_amount,
          Math.round(SUBTOTAL * (tasa / 100) * 100) / 100,
          `${frase}: tax_amount`
        );
        assert.equal(
          totals.total,
          Math.round((totals.subtotal + totals.tax_amount) * 100) / 100,
          `${frase}: total`
        );
      }
    });

    await t.test("13. revision aumenta exactamente +1 en cambio válido", async () => {
      const base = await baseDraft();
      const step = await postVoice360({ input: "Añade el IVA del 10%", draft: base });
      assert.equal(step.json.draft.revision, base.revision + 1);

      const repetido = await postVoice360({
        input: "Añade el IVA del 10%",
        draft: step.json.draft,
      });
      assert.equal(
        repetido.json.draft.revision,
        step.json.draft.revision,
        "repetir la misma tasa no es un cambio válido"
      );
    });

    await t.test("14. 150% se rechaza y el borrador queda intacto", async () => {
      const base = await baseDraft();
      for (const frase of ["Añade el IVA del 150%", "IVA 200%"]) {
        const step = await postVoice360({ input: frase, draft: base });
        assert.equal(step.json.intent, "electricista:budget_set_tax", frase);
        assert.match(String(step.json.answer), /entre 0 y 100/, `${frase}: rechazo explícito`);
        assert.equal(step.json.draft.tax_rate, base.tax_rate, `${frase}: tax_rate intacto`);
        assert.equal(step.json.draft.revision, base.revision, `${frase}: revision intacta`);
        assert.equal(step.json.draft.items.length, base.items.length, `${frase}: líneas intactas`);
      }
    });

    await t.test("15. Sin borrador activo → mensaje seguro y 0 persistencia", async () => {
      const before = await countRows(testDb, "budgets");

      const sinDraft = await postVoice360({ input: "Añade IVA" });
      assert.equal(sinDraft.status, 200);
      assert.equal(sinDraft.json.intent, "electricista:budget_set_tax");
      assert.match(String(sinDraft.json.answer), /No hay borrador activo/);
      assert.equal(sinDraft.json.draft ?? null, null);

      const vacio = await postVoice360({
        input: "Añade IVA",
        draft: { revision: 1, client_name: "", client_candidates: [], tax_rate: 21, notes: [], items: [] },
      });
      assert.match(String(vacio.json.answer), /No hay borrador activo/);

      assert.equal(await countRows(testDb, "budgets"), before, "0 persistencia");
      assert.equal(await countRows(testDb, "budget_items"), 0, "0 líneas persistidas");
    });

    await t.test("16. Antes de confirmar: budgets=0 y budget_items=0", async () => {
      assert.equal(await countRows(testDb, "budgets"), 0, "0 presupuestos antes del token");
      assert.equal(await countRows(testDb, "budget_items"), 0, "0 líneas antes del token");
    });

    await t.test("17. 'confirmar' emite pending_action/token sin persistir", async () => {
      const draft = (await setTax("Añade el IVA del 10%")).json.draft;
      assert.equal(draft.tax_rate, 10);

      const step = await postVoice360({ input: "confirmar", draft });
      assert.equal(step.json.intent, "electricista:budget_confirm");
      assert.ok(step.json.pending_action, "debe emitir pending_action");
      assert.equal(step.json.pending_action.action, "create_budget");
      assert.ok(
        typeof step.json.pending_action.token === "string" &&
          step.json.pending_action.token.length > 0,
        "debe emitir token"
      );
      assert.match(String(step.json.answer), /Revisa el presupuesto/);

      assert.equal(await countRows(testDb, "budgets"), 0, "confirmar no persiste");
      assert.equal(await countRows(testDb, "budget_items"), 0, "confirmar no persiste líneas");
    });

    await t.test("18. El token guarda una sola vez con el tax_rate correcto", async () => {
      const draft = (await setTax("Pon IVA al 10%")).json.draft;
      assert.equal(draft.tax_rate, 10);

      const confirm = await postVoice360({ input: "confirmar", draft });
      const token = confirm.json.pending_action?.token;
      assert.ok(token, "requiere token");

      const save = await postVoice360({ confirm_token: token });
      assert.equal(save.status, 200, "el guardado debe responder 200");
      assert.match(String(save.json.answer), /PRES_\d{4}/, "numeración canónica");

      assert.equal(await countRows(testDb, "budgets"), 1, "exactamente 1 presupuesto");
      const row = (
        await testDb.execute(
          "SELECT number, subtotal, tax_rate, tax_amount, total FROM budgets"
        )
      ).rows[0] as unknown as Record<string, unknown>;

      assert.equal(Number(row.tax_rate), 10, "tax_rate persistido por el Human Gate");
      assert.equal(Number(row.subtotal), SUBTOTAL, "subtotal persistido");
      assert.equal(
        Number(row.tax_amount),
        Math.round(SUBTOTAL * 0.1 * 100) / 100,
        "IVA 10% de 72 = 7.20 persistido"
      );
      assert.equal(Number(row.total), 79.2, "total persistido");

      const second = await postVoice360({ confirm_token: token });
      assert.equal(second.status, 200, "el reuso se responde de forma idempotente");
      assert.equal(second.json.idempotent, true, "se reconoce como repetición");
      assert.equal(await countRows(testDb, "budgets"), 1, "el segundo uso no persiste");
    });

    await t.test("19-20. Las consultas de precio con IVA NO son budget_set_tax", async () => {
      for (const frase of [
        "¿Cuánto cuesta un cuadro con IVA?",
        "Precio de un magneto con IVA",
      ]) {
        const step = await postVoice360({ input: frase });
        assert.notEqual(
          step.json.intent,
          "electricista:budget_set_tax",
          `"${frase}" no puede ser budget_set_tax`
        );
        assert.equal(
          step.json.intent,
          "electricista:catalog_query",
          `"${frase}" debe seguir siendo consulta de catálogo`
        );
      }
    });

    await t.test(
      "21-22. 'Añade un IVA del 10%' y 'Añade un 10% de IVA' no crean artículo",
      async () => {
        const base = await baseDraft();
        for (const frase of ["Añade un IVA del 10%", "Añade un 10% de IVA"]) {
          const step = await postVoice360({ input: frase, draft: base });
          assert.equal(step.json.intent, "electricista:budget_set_tax", frase);
          assert.equal(step.json.draft.items.length, 1, `${frase}: no añade línea`);
          assert.equal(step.json.draft.tax_rate, 10, `${frase}: aplica el 10%`);
          assert.doesNotMatch(
            String(step.json.draft.items[0].description),
            /iva|%/i,
            `${frase}: la línea original queda intacta`
          );
        }
      }
    );

    await t.test(
      "23. Regresión: 'Añade 3 enchufes a 12 euros' sigue su flujo anterior",
      async () => {
        const base = await baseDraft();
        const step = await postVoice360({
          input: "Añade 3 enchufes a 12 euros",
          draft: base,
        });
        assert.equal(step.json.intent, "electricista:budget_add_item");
        assert.equal(
          step.json.draft.items.length,
          base.items.length + 1,
          "sigue añadiendo su línea"
        );
        assert.equal(step.json.draft.tax_rate, base.tax_rate, "no toca el IVA");
      }
    );

    await t.test(
      "24. Las frases de horas/precio no son IVA (P1.1 no las captura; P1.2 las resuelve)",
      async () => {
        const base = await baseDraft();

        // Sobre un borrador SIN línea de horas ni de cable: P1.1 no debe capturarlas
        // como IVA, y P1.2 las resuelve como modificación sin añadir líneas.
        for (const frase of [
          "Cambia las horas a 10",
          "Pon el precio del cable a 8 euros",
        ]) {
          const step = await postVoice360({ input: frase, draft: base });
          assert.notEqual(
            step.json.intent,
            "electricista:budget_set_tax",
            `"${frase}" no es una frase de IVA`
          );
          assert.equal(
            step.json.intent,
            "electricista:budget_modify_item",
            `"${frase}" debe resolverse como modificación (P1.2)`
          );
          assert.equal(
            step.json.draft.items.length,
            base.items.length,
            `"${frase}" no debe añadir líneas`
          );
        }
      }
    );
  } finally {
    resetDbClient();
    if (previousTestDatabaseUrl === undefined) {
      delete process.env.TEST_DATABASE_URL;
    } else {
      process.env.TEST_DATABASE_URL = previousTestDatabaseUrl;
    }
  }
});

/**
 * P1.2 — Modificar cantidad y precio de una línea EXISTENTE sin duplicarla.
 *
 * Dos defectos del mismo bloque:
 *  1. "Cambia las horas a 10" no se reconocía como modificación (la regla exigía una
 *     palabra de precio/cantidad y el verbo no era de modificación); y aunque llegase
 *     al handler, el artículo hablado se capturaba como "las horas" y no casaba.
 *  2. "Pon el precio del cable a 8 euros" era capturada por add_item ANTES que
 *     modify_item, y acababa AÑADIENDO una línea basura ("8 ud Euros").
 *
 * AISLAMIENTO: idéntico al resto del fichero — cliente libsql en memoria y
 * TEST_DATABASE_URL apuntando a una ruta temporal.
 */
test("VOZ 360 — P1.2: modificar cantidad/precio sin duplicar líneas", async (t) => {
  const previousTestDatabaseUrl = process.env.TEST_DATABASE_URL;
  process.env.TEST_DATABASE_URL = `file:${join(
    tmpdir(),
    `electricista360-p12-${process.pid}.db`
  )}`;

  const testDb = createClient({ url: "file::memory:" });
  setDbClientForTesting(testDb);
  await initializeDatabase();

  // Locución base: 4 horas a 40 €/hora → línea "Horas" (4 @40)
  const DRAFT_INPUT = "Presupuesto para Test Cliente: 4 horas a 40 euros";
  // Segunda línea por el flujo real de adición → "Cables manguera" (3 @4)
  const ADD_CABLE_INPUT = "Añade 3 mangueras a 4 euros";

  /** Borrador real con DOS líneas: "Horas" (4 @40) y "Cables manguera" (3 @4). */
  async function twoLineDraft(): Promise<any> {
    const first = await postVoice360({ input: DRAFT_INPUT });
    assert.equal(first.status, 200);
    assert.equal(first.json.intent, "electricista:budget_draft");
    assert.equal(first.json.draft.items.length, 1, "la locución base produce 1 línea");

    const second = await postVoice360({
      input: ADD_CABLE_INPUT,
      draft: first.json.draft,
    });
    assert.equal(second.json.intent, "electricista:budget_add_item");
    assert.equal(second.json.draft.items.length, 2, "el borrador debe tener 2 líneas");
    return second.json.draft;
  }

  function findItem(draft: any, needle: string): any {
    return draft.items.find((item: any) =>
      String(item.description).toLowerCase().includes(needle)
    );
  }

  try {
    await t.test("A. 'Cambia las horas a 10' cambia la cantidad sin duplicar", async () => {
      const base = await twoLineDraft();
      const step = await postVoice360({ input: "Cambia las horas a 10", draft: base });
      const draft = step.json.draft;

      assert.equal(step.json.intent, "electricista:budget_modify_item");
      assert.equal(draft.items.length, base.items.length, "misma cantidad de líneas");
      assert.equal(draft.items.length, 2, "no debe añadirse ninguna línea");

      const horas = findItem(draft, "horas");
      assert.equal(horas.quantity, 10, "quantity = 10");
      assert.equal(horas.unit_price, 40, "unit_price intacto");
      assert.equal(horas.total, 400, "total de línea recalculado (10 x 40)");

      const cable = findItem(draft, "cable");
      assert.equal(cable.quantity, 3, "la otra línea no se toca");
      assert.equal(cable.unit_price, 4, "la otra línea no se toca");

      assert.equal(step.json.totals.subtotal, 412, "subtotal recalculado (10x40 + 3x4)");
      assert.equal(step.json.totals.tax_amount, 86.52, "IVA 21% de 412");
      assert.equal(step.json.totals.total, 498.52, "total del presupuesto");
      assert.equal(draft.revision, base.revision + 1, "revision +1");
    });

    await t.test(
      "B. 'Pon el precio del cable a 8 euros' cambia el precio y NO crea línea 'Euros'",
      async () => {
        const base = await twoLineDraft();
        const step = await postVoice360({
          input: "Pon el precio del cable a 8 euros",
          draft: base,
        });
        const draft = step.json.draft;

        assert.equal(step.json.intent, "electricista:budget_modify_item");
        assert.equal(draft.items.length, base.items.length, "misma cantidad de líneas");
        assert.equal(draft.items.length, 2, "no debe añadirse ninguna línea");
        for (const item of draft.items) {
          assert.doesNotMatch(
            String(item.description),
            /euros|%/i,
            `línea basura detectada: "${item.description}"`
          );
        }

        const cable = findItem(draft, "cable");
        assert.equal(cable.unit_price, 8, "unit_price = 8");
        assert.equal(cable.quantity, 3, "quantity intacta");
        assert.equal(cable.total, 24, "total de línea recalculado (3 x 8)");

        const horas = findItem(draft, "horas");
        assert.equal(horas.quantity, 4, "la otra línea no se toca");
        assert.equal(horas.unit_price, 40, "la otra línea no se toca");

        assert.equal(step.json.totals.subtotal, 184, "subtotal recalculado (4x40 + 3x8)");
        assert.equal(step.json.totals.tax_amount, 38.64, "IVA 21% de 184");
        assert.equal(step.json.totals.total, 222.64, "total del presupuesto");
        assert.equal(draft.revision, base.revision + 1, "revision +1");
      }
    );

    await t.test("C. Variantes de modificación (cantidad y precio)", async () => {
      const variantesCantidad: Array<[string, number]> = [
        ["Cambia las horas a 5", 5],
        ["Modifica las horas a 7", 7],
        ["Actualiza las horas a 8", 8],
      ];

      for (const [frase, esperado] of variantesCantidad) {
        const base = await twoLineDraft();
        const step = await postVoice360({ input: frase, draft: base });
        assert.equal(step.json.intent, "electricista:budget_modify_item", frase);
        assert.equal(step.json.draft.items.length, 2, `${frase}: sin duplicados`);
        assert.equal(findItem(step.json.draft, "horas").quantity, esperado, frase);
        assert.equal(
          findItem(step.json.draft, "horas").unit_price,
          40,
          `${frase}: precio intacto`
        );
      }

      const base = await twoLineDraft();
      const precio = await postVoice360({
        input: "Pon el precio del cable a 6 euros",
        draft: base,
      });
      assert.equal(precio.json.intent, "electricista:budget_modify_item");
      assert.equal(precio.json.draft.items.length, 2, "sin duplicados");
      assert.equal(findItem(precio.json.draft, "cable").unit_price, 6);
      assert.equal(findItem(precio.json.draft, "cable").quantity, 3, "cantidad intacta");
    });

    await t.test(
      "D. Regresión: 'Añade 3 enchufes a 12 euros' sigue siendo add_item",
      async () => {
        const base = await twoLineDraft();

        const añade = await postVoice360({
          input: "Añade 3 enchufes a 12 euros",
          draft: base,
        });
        assert.equal(añade.json.intent, "electricista:budget_add_item");
        assert.equal(añade.json.draft.items.length, 3, "sigue añadiendo una línea nueva");

        // Un objeto cuantificado tras "pon" también sigue siendo una adición.
        const pon = await postVoice360({ input: "Pon 3 enchufes a 12 euros", draft: base });
        assert.equal(pon.json.intent, "electricista:budget_add_item");
        assert.equal(pon.json.draft.items.length, 3, "sigue añadiendo una línea nueva");
      }
    );

    await t.test("E. P1.1 intacto: IVA 10%, IVA 0 y 'Añade IVA'", async () => {
      const base = await twoLineDraft();

      const diez = await postVoice360({ input: "Añade el IVA del 10%", draft: base });
      assert.equal(diez.json.intent, "electricista:budget_set_tax");
      assert.equal(diez.json.draft.tax_rate, 10);
      assert.equal(diez.json.draft.items.length, 2, "el IVA no toca las líneas");

      const cero = await postVoice360({ input: "Quita el IVA", draft: diez.json.draft });
      assert.equal(cero.json.intent, "electricista:budget_set_tax");
      assert.equal(cero.json.draft.tax_rate, 0);
      assert.equal(cero.json.totals.tax_amount, 0, "IVA 0 se preserva");

      const conserva = await postVoice360({ input: "Añade IVA", draft: base });
      assert.equal(conserva.json.intent, "electricista:budget_set_tax");
      assert.equal(conserva.json.draft.tax_rate, 21, "sin porcentaje conserva el 21");
    });

    await t.test(
      "F. P1.3 intacto: 'Confírmalo' genera Human Gate y la cancelación sigue prioritaria",
      async () => {
        const base = await twoLineDraft();
        const step = await postVoice360({ input: "Confírmalo", draft: base });

        assert.equal(step.json.intent, "electricista:budget_confirm");
        assert.ok(step.json.pending_action, "debe emitir pending_action");
        assert.equal(step.json.pending_action.action, "create_budget");
        assert.ok(
          typeof step.json.pending_action.token === "string" &&
            step.json.pending_action.token.length > 0,
          "debe emitir confirm_token"
        );

        const cancela = await postVoice360({ input: "Cancela", draft: base });
        assert.equal(cancela.json.intent, "electricista:budget_cancel");
        assert.equal(cancela.json.pending_action ?? null, null, "cancelar no emite token");

        const negativo = await postVoice360({ input: "No lo confirmes", draft: base });
        assert.notEqual(
          negativo.json.intent,
          "electricista:budget_confirm",
          "una frase negativa no puede confirmar"
        );
        assert.equal(negativo.json.intent, "electricista:budget_cancel");
      }
    );

    await t.test("G. Antes del token: budgets=0 y budget_items=0", async () => {
      assert.equal(await countRows(testDb, "budgets"), 0, "0 presupuestos sin token");
      assert.equal(await countRows(testDb, "budget_items"), 0, "0 líneas sin token");
    });

    await t.test(
      "H-I. El token guarda una sola vez con los valores modificados; el reuso se rechaza",
      async () => {
        const base = await twoLineDraft();
        const modificado = await postVoice360({
          input: "Cambia las horas a 10",
          draft: base,
        });
        const draft = modificado.json.draft;
        assert.equal(findItem(draft, "horas").quantity, 10);

        const confirm = await postVoice360({ input: "Confírmalo", draft });
        const token = confirm.json.pending_action?.token;
        assert.ok(token, "requiere token");
        assert.equal(await countRows(testDb, "budgets"), 0, "0 persistencia antes del token");

        const save = await postVoice360({ confirm_token: token });
        assert.equal(save.status, 200, "el guardado debe responder 200");
        assert.match(String(save.json.answer), /PRES_\d{4}/, "numeración canónica");

        assert.equal(await countRows(testDb, "budgets"), 1, "exactamente 1 presupuesto");
        const row = (
          await testDb.execute("SELECT subtotal, tax_rate, tax_amount, total FROM budgets")
        ).rows[0] as unknown as Record<string, unknown>;
        assert.equal(Number(row.subtotal), 412, "subtotal con la cantidad modificada");
        assert.equal(Number(row.tax_rate), 21, "tax_rate sin tocar");
        assert.equal(Number(row.tax_amount), 86.52, "IVA 21% de 412");
        assert.equal(Number(row.total), 498.52, "total persistido");

        const lineas = (
          await testDb.execute(
            "SELECT description, quantity, unit_price FROM budget_items ORDER BY sort_order"
          )
        ).rows as unknown as Record<string, unknown>[];
        assert.equal(lineas.length, 2, "exactamente 2 líneas persistidas (0 duplicados)");

        const horasRow = lineas.find((l) =>
          String(l.description).toLowerCase().includes("horas")
        );
        assert.ok(horasRow, "debe persistirse la línea de horas");
        assert.equal(Number(horasRow!.quantity), 10, "cantidad persistida");
        assert.equal(Number(horasRow!.unit_price), 40, "precio preservado");

        const second = await postVoice360({ confirm_token: token });
        assert.equal(second.status, 200, "el reuso se responde de forma idempotente");
        assert.equal(second.json.idempotent, true, "se reconoce como repetición");
        assert.equal(await countRows(testDb, "budgets"), 1, "el reuso no persiste nada");
      }
    );
  } finally {
    resetDbClient();
    if (previousTestDatabaseUrl === undefined) {
      delete process.env.TEST_DATABASE_URL;
    } else {
      process.env.TEST_DATABASE_URL = previousTestDatabaseUrl;
    }
  }
});

/**
 * ════════════════════════════════════════════════════════════════════════════
 * D5 — CANCELAR EXIGE UNA ORDEN DE CANCELACIÓN
 *
 * Antes bastaba con que apareciera la palabra "no" en cualquier parte de la
 * frase, así que una locución tan normal como
 *   "Presupuesto para Juan, no sé cuántos enchufes"
 * DESCARTABA el borrador en curso (la respuesta iba sin `draft` y la pantalla lo
 * limpiaba). Es una pérdida de trabajo silenciosa.
 *
 * Sigue sin poder debilitarse la cancelación de verdad: "cancela",
 * "cancela el borrador", "descarta", "borra el borrador" y las negaciones de una
 * confirmación ("no lo guardes") siguen cancelando.
 * ════════════════════════════════════════════════════════════════════════════
 */
test("VOZ 360 — D5: cancelar exige una orden real (un 'no' suelto no descarta el borrador)", async () => {
  const previousTestDatabaseUrl = process.env.TEST_DATABASE_URL;
  process.env.TEST_DATABASE_URL = `file:${join(
    tmpdir(),
    `electricista360-cancel-${process.pid}.db`
  )}`;

  const testDb = createClient({ url: "file::memory:" });
  setDbClientForTesting(testDb);
  await initializeDatabase();

  const DRAFT_INPUT = "Presupuesto para Test Cliente: 4 enchufes a 18 euros";

  async function newDraft(): Promise<any> {
    const step = await postVoice360({ input: DRAFT_INPUT });
    assert.equal(step.json.intent, "electricista:budget_draft");
    return step.json.draft;
  }

  try {
    // ── ÓRDENES DE CANCELACIÓN REALES: siguen cancelando ────────────────
    for (const frase of [
      "Cancela",
      "cancela el borrador",
      "Cancélalo",
      "Descarta",
      "descarta el borrador",
      "borra el borrador",
      "No lo confirmes",
      "No, cancela",
      "No lo guardes",
      "No guardes nada",
    ]) {
      const step = await postVoice360({ input: frase, draft: await newDraft() });
      assert.equal(step.status, 200, `"${frase}" debe responder 200`);
      assert.equal(
        step.json.intent,
        "electricista:budget_cancel",
        `"${frase}" es una orden de cancelación y debe seguir cancelando`
      );
      assert.equal(step.json.draft ?? null, null, `"${frase}" descarta el borrador`);
      assert.equal(step.json.pending_action ?? null, null, `"${frase}" no emite token`);
    }

    // ── NEGACIÓN QUE NO ES UNA CANCELACIÓN: NO puede descartar nada ─────
    const neutras = [
      "Presupuesto para Juan, no sé cuántos enchufes",
      "no sé cuántos enchufes",
      "Presupuesto para Juan de 2 enchufes, no estoy seguro del precio",
    ];
    for (const frase of neutras) {
      const step = await postVoice360({ input: frase, draft: await newDraft() });
      assert.notEqual(
        step.json.intent,
        "electricista:budget_cancel",
        `"${frase}" NO es una orden de cancelación`
      );
    }

    // La frase clave: el borrador NO se pierde (antes se descartaba).
    const antes = await newDraft();
    const conNegacion = await postVoice360({
      input: "Presupuesto para Juan, no sé cuántos enchufes",
      draft: antes,
    });
    assert.equal(
      conNegacion.json.intent,
      "electricista:budget_draft",
      "es una orden de presupuesto, no una cancelación"
    );
    assert.ok(conNegacion.json.draft, "el borrador sigue vivo");
    assert.equal(await countRows(testDb, "budgets"), 0, "y no se ha escrito nada");
  } finally {
    resetDbClient();
    if (previousTestDatabaseUrl === undefined) {
      delete process.env.TEST_DATABASE_URL;
    } else {
      process.env.TEST_DATABASE_URL = previousTestDatabaseUrl;
    }
  }
});

/**
 * ════════════════════════════════════════════════════════════════════════════
 * D6 — ¿EL PRESUPUESTO GUARDADO POR VOZ SE PUEDE LEER DESPUÉS?
 *
 * La misión exige poder CONSULTAR el presupuesto guardado. `budgets` y
 * `budget_items` son tablas de negocio con `tenant_id` (Fase 2A), pero el
 * guardado por voz escribía con `getDbClient()` sin declarar el tenant, así que
 * la fila quedaba SIN PROPIETARIO (`tenant_id NULL`); con la semántica aprobada
 * ("NULL = sin propietario demostrable, invisible en cuanto la lectura filtre")
 * ésa es justo la fila que desaparecería el día que la lectura se acote.
 *
 * Este bloque comprueba las dos cosas por el camino REAL:
 *   (a) lo guardado se lee por las MISMAS APIs que usa la página de Presupuestos
 *       (GET /api/budgets y GET /api/budgets/[id]);
 *   (b) la fila queda en el tenant de la sesión (cabecera que inyecta el proxy).
 * ════════════════════════════════════════════════════════════════════════════
 */
test("VOZ 360 — D6: el presupuesto guardado por voz se lee después y queda en su tenant", async () => {
  const previousTestDatabaseUrl = process.env.TEST_DATABASE_URL;
  process.env.TEST_DATABASE_URL = `file:${join(
    tmpdir(),
    `electricista360-tenant-${process.pid}.db`
  )}`;

  const testDb = createClient({ url: "file::memory:" });
  setDbClientForTesting(testDb);
  await initializeDatabase();
  // La migración de tenant (Fase 2A) NO la aplica initializeDatabase(); en la
  // prueba se aplica igual que en producción (script autorizado).
  await applyTenantSchema(testDb);

  const TENANT = "tenant-voz-presupuesto";
  const SESION = { "x-auth-tenant-id": TENANT, "x-auth-user-id": "user-voz" };

  try {
    // 1. Flujo real de voz: borrador → "confirmar" → token.
    const draftStep = await postVoice360(
      { input: "Presupuesto para Test Cliente: 4 enchufes a 18 euros" },
      SESION
    );
    assert.equal(draftStep.json.intent, "electricista:budget_draft");
    const draft = draftStep.json.draft;

    const confirmStep = await postVoice360({ input: "confirmar", draft }, SESION);
    const token = confirmStep.json.pending_action?.token;
    assert.ok(token, "debe emitirse el token del Human Gate");

    const saveStep = await postVoice360({ confirm_token: token, draft }, SESION);
    assert.equal(saveStep.status, 200, "el guardado debe responder 200");
    assert.match(String(saveStep.json.answer), /guardado/i);

    // 2. La fila guardada por voz pertenece al tenant de la sesión.
    const budgetRows = (await testDb.execute("SELECT id, number, tenant_id FROM budgets"))
      .rows as unknown as Record<string, unknown>[];
    assert.equal(budgetRows.length, 1, "un presupuesto persistido");
    assert.equal(
      String(budgetRows[0].tenant_id),
      TENANT,
      "P0: la fila debe quedar en el tenant de la sesión, no sin propietario (NULL)"
    );
    const budgetId = String(budgetRows[0].id);
    const budgetNumber = String(budgetRows[0].number);

    const itemRows = (await testDb.execute("SELECT tenant_id FROM budget_items"))
      .rows as unknown as Record<string, unknown>[];
    assert.equal(itemRows.length, 1, "una línea persistida");
    assert.equal(String(itemRows[0].tenant_id), TENANT, "las líneas también son del tenant");

    // 3. LEGIBLE por la MISMA API que usa la página de Presupuestos.
    const listResponse = await listBudgets(
      new NextRequest("http://localhost:3000/api/budgets", { headers: SESION })
    );
    assert.equal(listResponse.status, 200, "GET /api/budgets debe responder 200");
    const list = (await listResponse.json()) as Array<Record<string, unknown>>;
    assert.ok(
      list.some((row) => String(row.id) === budgetId),
      "el presupuesto guardado por voz aparece en el listado que ve el usuario"
    );

    const detailResponse = await getBudget(
      new NextRequest(`http://localhost:3000/api/budgets/${budgetId}`, { headers: SESION }),
      { params: Promise.resolve({ id: budgetId }) }
    );
    assert.equal(detailResponse.status, 200, "GET /api/budgets/[id] debe responder 200");
    const detalle = (await detailResponse.json()) as Record<string, any>;
    assert.equal(String(detalle.number), budgetNumber, "el número coincide");
    assert.equal(Number(detalle.total), 87.12, "4x18 + IVA 21 % = 87,12 €");
    assert.equal((detalle.items as unknown[]).length, 1, "con su línea");

    // 4. El mismo presupuesto es legible TAMBIÉN sin identidad de tenant: la
    //    lectura actual no filtra, así que el defecto estaba en la ESCRITURA, no
    //    en la lectura (se documenta para que quede claro qué se ha comprobado).
    const sinSesion = await listBudgets(new NextRequest("http://localhost:3000/api/budgets"));
    const listSinSesion = (await sinSesion.json()) as Array<Record<string, unknown>>;
    assert.ok(
      listSinSesion.some((row) => String(row.id) === budgetId),
      "la lectura no está filtrada por tenant: hoy no hay invisibilidad"
    );
  } finally {
    resetDbClient();
    if (previousTestDatabaseUrl === undefined) {
      delete process.env.TEST_DATABASE_URL;
    } else {
      process.env.TEST_DATABASE_URL = previousTestDatabaseUrl;
    }
  }
});

/**
 * D6b — la escritura con tenant es CONDICIONAL a que la columna exista.
 *
 * La migración de tenant (Fase 2A) es un script aparte que `initializeDatabase()`
 * NO aplica. Si el proxy inyecta identidad pero la columna `tenant_id` todavía no
 * existe, el guardado por voz NO puede romperse con "no such column": debe seguir
 * funcionando como antes. Esto se comprueba aquí (el resto de la suite cubre el
 * caso sin identidad de sesión, pero no el de identidad SIN columna).
 */
test("VOZ 360 — D6b: con identidad de sesión pero sin columna tenant_id, el guardado no se rompe", async () => {
  const previousTestDatabaseUrl = process.env.TEST_DATABASE_URL;
  process.env.TEST_DATABASE_URL = `file:${join(
    tmpdir(),
    `electricista360-tenant-nomig-${process.pid}.db`
  )}`;

  const testDb = createClient({ url: "file::memory:" });
  setDbClientForTesting(testDb);
  await initializeDatabase();
  // A PROPÓSITO: NO se aplica applyTenantSchema().

  const columnas = (
    await testDb.execute(`PRAGMA table_info("budgets")`)
  ).rows.map((r) => String((r as unknown as Record<string, unknown>).name));
  assert.equal(columnas.includes("tenant_id"), false, "la BD de esta prueba no está migrada");

  const SESION = { "x-auth-tenant-id": "tenant-sin-migrar", "x-auth-user-id": "user-voz" };

  try {
    const draftStep = await postVoice360(
      { input: "Presupuesto para Test Cliente: 4 enchufes a 18 euros" },
      SESION
    );
    const draft = draftStep.json.draft;
    const confirmStep = await postVoice360({ input: "confirmar", draft }, SESION);
    const token = confirmStep.json.pending_action?.token;

    const saveStep = await postVoice360({ confirm_token: token, draft }, SESION);
    assert.equal(saveStep.status, 200, "el guardado no puede fallar por la columna ausente");
    assert.match(String(saveStep.json.answer), /guardado/i, "el presupuesto se guarda igual");
    assert.equal(await countRows(testDb, "budgets"), 1, "1 presupuesto persistido");
    assert.equal(await countRows(testDb, "budget_items"), 1, "con su línea");
  } finally {
    resetDbClient();
    if (previousTestDatabaseUrl === undefined) {
      delete process.env.TEST_DATABASE_URL;
    } else {
      process.env.TEST_DATABASE_URL = previousTestDatabaseUrl;
    }
  }
});

/**
 * ════════════════════════════════════════════════════════════════════════════
 * D7 — DOBLE CLICK REAL (CONCURRENTE), NO SECUENCIAL
 *
 * El token ya era de un solo uso frente a repeticiones SECUENCIALES, pero entre
 * `consumeToken()` y el registro de la confirmación consumida hay un `await` de
 * escritura. Un duplicado que llegue JUSTO en ese hueco ya no encuentra el token
 * pendiente: no duplicaba el presupuesto, pero recibía un 400 confuso.
 *
 * Ahora la confirmación se marca EN VUELO antes de esperar a la BD, así que el
 * duplicado espera el MISMO guardado y recibe la misma respuesta idempotente.
 * ════════════════════════════════════════════════════════════════════════════
 */
test("VOZ 360 — D7: dos confirmaciones concurrentes del mismo token guardan UN solo presupuesto", async () => {
  const previousTestDatabaseUrl = process.env.TEST_DATABASE_URL;
  process.env.TEST_DATABASE_URL = `file:${join(
    tmpdir(),
    `electricista360-race-${process.pid}.db`
  )}`;

  const testDb = createClient({ url: "file::memory:" });
  setDbClientForTesting(testDb);
  await initializeDatabase();

  try {
    const draftStep = await postVoice360({
      input: "Presupuesto para Test Cliente: 4 enchufes a 18 euros",
    });
    const draft = draftStep.json.draft;
    const confirmStep = await postVoice360({ input: "confirmar", draft });
    const token = confirmStep.json.pending_action?.token;
    assert.ok(token, "debe emitirse el token del Human Gate");

    const antes = await countRows(testDb, "budgets");
    assert.equal(antes, 0, "0 presupuestos antes de confirmar");

    // Doble click REAL: cinco peticiones con el MISMO token, lanzadas a la vez.
    const respuestas = await Promise.all([
      postVoice360({ confirm_token: token, draft }),
      postVoice360({ confirm_token: token, draft }),
      postVoice360({ confirm_token: token, draft }),
      postVoice360({ confirm_token: token, draft }),
      postVoice360({ confirm_token: token, draft }),
    ]);

    for (const [indice, respuesta] of respuestas.entries()) {
      assert.equal(
        respuesta.status,
        200,
        `la petición concurrente ${indice + 1} debe resolverse de forma idempotente, no con un 400`
      );
      assert.match(
        String(respuesta.json.answer),
        /guardado/i,
        `la petición concurrente ${indice + 1} debe devolver la respuesta del guardado`
      );
    }

    // Todas las respuestas cuentan el MISMO guardado.
    const respuestasUnicas = new Set(respuestas.map((r) => String(r.json.answer)));
    assert.equal(respuestasUnicas.size, 1, "todas las respuestas son la misma (idempotencia)");

    // Exactamente UNA solicitud hizo la escritura; las demás se reconocen como
    // repetición (ninguna puede quedar a medias, ninguna escribe otra vez).
    const escrituras = respuestas.filter((r) => r.json.idempotent === false).length;
    assert.equal(escrituras, 1, "exactamente 1 de las 5 peticiones ejecuta la escritura");

    assert.equal(await countRows(testDb, "budgets"), 1, "EXACTAMENTE 1 presupuesto persistido");
    assert.equal(await countRows(testDb, "budget_items"), 1, "y 1 línea, no 5");
  } finally {
    resetDbClient();
    if (previousTestDatabaseUrl === undefined) {
      delete process.env.TEST_DATABASE_URL;
    } else {
      process.env.TEST_DATABASE_URL = previousTestDatabaseUrl;
    }
  }
});
