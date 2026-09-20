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

async function postVoice360(body: unknown): Promise<{ status: number; json: any }> {
  const request = new NextRequest(ROUTE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
      "8. Segundo uso del mismo token es rechazado y no persiste nada",
      async () => {
        const budgetsBefore = await countRows(testDb, "budgets");

        const confirm = await postVoice360({ input: "Guárdalo", draft: await newDraft() });
        const token = confirm.json.pending_action?.token;
        assert.ok(token, "requiere token");

        const first = await postVoice360({ confirm_token: token });
        assert.equal(first.status, 200, "el primer uso debe guardar");
        const afterFirst = await countRows(testDb, "budgets");
        assert.equal(afterFirst, budgetsBefore + 1, "el primer uso guarda una sola vez");

        const second = await postVoice360({ confirm_token: token });
        assert.equal(second.status, 400, "el segundo uso debe ser rechazado");
        assert.match(
          String(second.json.error),
          /inválido o expirado/,
          "debe explicar el rechazo"
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
      assert.equal(second.status, 400, "el token es de un solo uso");
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
      "24. P1.2 intacto: 'Cambia las horas a 10' y 'Pon el precio del cable a 8 euros'",
      async () => {
        const base = await baseDraft();

        const horas = await postVoice360({ input: "Cambia las horas a 10", draft: base });
        assert.equal(
          horas.json.intent,
          "electricista:general",
          "P1.2 sigue sin reconocerse: NO se arregla aquí"
        );
        assert.notEqual(horas.json.intent, "electricista:budget_set_tax");

        const cable = await postVoice360({
          input: "Pon el precio del cable a 8 euros",
          draft: base,
        });
        assert.equal(
          cable.json.intent,
          "electricista:budget_add_item",
          "comportamiento previo intacto: NO se arregla aquí"
        );
        assert.notEqual(cable.json.intent, "electricista:budget_set_tax");
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
