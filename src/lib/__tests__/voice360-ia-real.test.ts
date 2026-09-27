/**
 * Voz 360 — IA REAL, FRASES LARGAS, INTERRUPCIÓN Y RECUPERACIÓN
 *
 * ────────────────────────────────────────────────────────────────────────────
 * QUÉ SE COMPRUEBA AQUÍ (y por qué)
 *
 * 1. IA REAL: una pregunta abierta de voz se responde con el modelo
 *    configurado, mediante una llamada HTTP REAL al endpoint compatible con
 *    OpenAI. El transporte apunta a un servidor local de prueba, igual que hace
 *    la propia fábrica de KepaForce al validar su proveedor: se recorre toda la
 *    cadena real (route → guardas → prompt de sistema → cliente → HTTP) sin
 *    gastar créditos ni depender de la red.
 *    Se verifica además que:
 *      - el prompt de sistema que viaja es el del asistente (incluye el mapa de
 *        módulos de la app), no un texto improvisado;
 *      - la credencial NO viaja en el cuerpo de la petición;
 *      - no se hace NINGUNA llamada cuando la respuesta es de seguridad, de
 *        datos reales o de conocimiento de la app.
 *
 * 2. RECUPERACIÓN: si el modelo falla (HTTP 500) o no hay credencial, la
 *    respuesta NO es un error: se responde con el motor local y `source: local`.
 *
 * 3. FRASES LARGAS SIN CORTE PREMATURO: el dictado nativo de Android usa el
 *    núcleo de voz probado. Un `onResults` del reconocedor es un SEGMENTO (no el
 *    fin del turno), los segmentos se acumulan con `mergeUtterances` y el cierre
 *    lo decide `finalizeReason` desde un latido. Si el reconocedor corta en una
 *    pausa natural, lo ya entendido se conserva en vez de perderse.
 *
 * 4. INTERRUMPIR: la respuesta hablada (TTS) se puede cortar con un botón y se
 *    corta sola en cuanto el usuario vuelve a hablar.
 *
 * 5. RECUPERACIÓN EN PANTALLA: tras un error se puede reintentar el último texto.
 *
 * AISLAMIENTO: cliente libsql en memoria; nunca se toca electricista.db.
 * ────────────────────────────────────────────────────────────────────────────
 */

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { createClient } from "@libsql/client";
import {
  resetDbClient,
  setDbClientForTesting,
} from "@/lib/db";
import { POST as handleVoice360Route } from "@/app/api/asistente/voice360/route";

const ROOT = process.cwd();
const ROUTE_URL = "http://localhost:3000/api/asistente/voice360";

/** Credencial FICTICIA: nunca es una clave real y jamás sale del proceso. */
const CLAVE_FICTICIA = "clave-ficticia-de-prueba-ia-voz360";

/** Pregunta que NO es una orden, ni una consulta de datos, ni materia de la app. */
const PREGUNTA_ABIERTA = "Explícame la diferencia entre un interruptor diferencial y un magnetotérmico";

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf-8");
}

// ────────────────────────────────────────────────────────────────────────────
// Servidor local que hace de proveedor del modelo
// ────────────────────────────────────────────────────────────────────────────

interface StubCall {
  method: string;
  url: string;
  authorization: string | null;
  body: string;
}

interface StubServer {
  baseUrl: string;
  calls: StubCall[];
  close: () => Promise<void>;
}

/**
 * Levanta un servidor local que responde como la API de chat. Devuelve la URL
 * base y TODAS las peticiones recibidas, para poder demostrar que la llamada
 * ocurrió de verdad y con qué contenido.
 */
async function startStub(
  responder: (call: StubCall) => { status: number; body: unknown }
): Promise<StubServer> {
  const calls: StubCall[] = [];

  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const call: StubCall = {
        method: req.method ?? "",
        url: req.url ?? "",
        authorization: (req.headers.authorization as string | undefined) ?? null,
        body: Buffer.concat(chunks).toString("utf-8"),
      };
      calls.push(call);

      const respuesta = responder(call);
      res.writeHead(respuesta.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(respuesta.body));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("sin puerto del stub");

  return {
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    calls,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** Respuesta correcta con el texto que se quiera. */
function respuestaOk(texto: string) {
  return {
    status: 200,
    body: {
      model: "modelo-de-prueba",
      choices: [{ message: { role: "assistant", content: texto }, finish_reason: "stop" }],
      usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Utilidades de entorno y BD
// ────────────────────────────────────────────────────────────────────────────

interface EnvBackup {
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
  AI_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
}

function guardarEnv(): EnvBackup {
  return {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    AI_API_KEY: process.env.AI_API_KEY,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL,
  };
}

function restaurarEnv(backup: EnvBackup): void {
  for (const [clave, valor] of Object.entries(backup)) {
    if (valor === undefined) delete process.env[clave];
    else process.env[clave] = valor;
  }
}

async function postVoice360(body: unknown): Promise<{ status: number; json: any }> {
  const request = new NextRequest(ROUTE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const response = await handleVoice360Route(request);
  return { status: response.status, json: await response.json() };
}

function conBaseDeDatosDePrueba(t: { after: (fn: () => void) => void }): void {
  const testDb = createClient({ url: "file::memory:" });
  setDbClientForTesting(testDb);
  t.after(() => {
    resetDbClient();
    try {
      testDb.close();
    } catch {
      /* ignore */
    }
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 1. IA REAL — una llamada HTTP de verdad
// ────────────────────────────────────────────────────────────────────────────

describe("Voz 360 — IA real: la pregunta abierta se responde con el modelo", () => {
  test("1. Se llama al proveedor y su respuesta es la que se muestra (source: ai)", async (t) => {
    conBaseDeDatosDePrueba(t);
    const env = guardarEnv();
    const stub = await startStub(() => respuestaOk("Respuesta generada por el modelo de prueba."));

    process.env.OPENAI_API_KEY = CLAVE_FICTICIA;
    process.env.OPENAI_BASE_URL = stub.baseUrl;
    process.env.OPENAI_MODEL = "modelo-de-prueba";
    delete process.env.AI_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;

    t.after(async () => {
      restaurarEnv(env);
      await stub.close();
    });

    const res = await postVoice360({ input: PREGUNTA_ABIERTA });

    assert.equal(res.status, 200, "la pregunta debe responderse sin error");
    assert.equal(res.json.source, "ai", "la respuesta debe venir de la IA real");
    assert.equal(res.json.answer, "Respuesta generada por el modelo de prueba.");
    assert.equal(res.json.draft, null, "una pregunta no crea borrador");
    assert.equal(res.json.pending_action, null, "una pregunta no abre ninguna acción");

    // La llamada ocurrió de verdad, una sola vez, contra /chat/completions.
    assert.equal(stub.calls.length, 1, "debe hacerse exactamente una llamada al modelo");
    assert.equal(stub.calls[0].method, "POST");
    assert.match(stub.calls[0].url, /\/chat\/completions$/, "ruta compatible con OpenAI");

    const enviado = JSON.parse(stub.calls[0].body) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
    };
    assert.equal(enviado.model, "modelo-de-prueba", "el modelo configurado es el que se usa");

    const sistema = enviado.messages.find((m) => m.role === "system")?.content ?? "";
    const usuario = enviado.messages.find((m) => m.role === "user")?.content ?? "";

    assert.match(usuario, /interruptor diferencial/i, "el modelo recibe la pregunta del usuario");
    assert.match(
      sistema,
      /Módulos de la aplicación:/,
      "el prompt de sistema es el del asistente (incluye el mapa de módulos)"
    );
    assert.match(
      sistema,
      /NUNCA afirmes que una acción se guardó/,
      "el prompt conserva la regla de no afirmar acciones no confirmadas"
    );

    // Seguridad: la credencial NO viaja en el cuerpo.
    assert.doesNotMatch(stub.calls[0].body, /clave-ficticia/, "la credencial no puede ir en el prompt");
    assert.equal(
      stub.calls[0].authorization,
      `Bearer ${CLAVE_FICTICIA}`,
      "la credencial viaja en la cabecera Authorization"
    );
  });

  test("2. Si el modelo falla, la voz sigue respondiendo (source: local)", async (t) => {
    conBaseDeDatosDePrueba(t);
    const env = guardarEnv();
    const stub = await startStub(() => ({
      status: 500,
      body: { error: { message: "fallo simulado del proveedor" } },
    }));

    process.env.OPENAI_API_KEY = CLAVE_FICTICIA;
    process.env.OPENAI_BASE_URL = stub.baseUrl;
    delete process.env.AI_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;

    t.after(async () => {
      restaurarEnv(env);
      await stub.close();
    });

    const res = await postVoice360({ input: PREGUNTA_ABIERTA });

    assert.equal(res.status, 200, "un fallo del modelo no puede romper la conversación");
    assert.equal(res.json.source, "local", "se usa el respaldo local");
    assert.match(res.json.answer, /presupuestos/i, "el respaldo local es la guía de Voz 360");
    assert.equal(stub.calls.length, 1, "se intentó la llamada antes de degradar");
  });

  test("3. Sin credencial no se hace NINGUNA llamada y se responde en local", async (t) => {
    conBaseDeDatosDePrueba(t);
    const env = guardarEnv();
    const stub = await startStub(() => respuestaOk("no debería usarse"));

    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    process.env.OPENAI_BASE_URL = stub.baseUrl;

    t.after(async () => {
      restaurarEnv(env);
      await stub.close();
    });

    const res = await postVoice360({ input: PREGUNTA_ABIERTA });

    assert.equal(res.status, 200);
    assert.equal(res.json.source, "local");
    assert.equal(stub.calls.length, 0, "sin credencial no se lanza ninguna llamada (fail-closed)");
  });

  test("4. La guarda de seguridad eléctrica NO se delega al modelo", async (t) => {
    conBaseDeDatosDePrueba(t);
    const env = guardarEnv();
    const stub = await startStub(() => respuestaOk("no debería usarse"));

    process.env.OPENAI_API_KEY = CLAVE_FICTICIA;
    process.env.OPENAI_BASE_URL = stub.baseUrl;
    delete process.env.AI_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;

    t.after(async () => {
      restaurarEnv(env);
      await stub.close();
    });

    // Frase PELIGROSA con verbo de modificación: antes podía caer en una rama de
    // borrador y la advertencia de seguridad no se mostraba nunca.
    const peligrosa = await postVoice360({ input: "Cambia el magnetotérmico con tensión" });
    assert.equal(peligrosa.json.source, "safety", "la seguridad se resuelve de forma determinista");
    assert.match(peligrosa.json.answer, /5 reglas de oro|ADVERTENCIA DE SEGURIDAD/i);
    assert.equal(peligrosa.json.draft, null, "una consulta peligrosa no puede crear un borrador");
    assert.equal(peligrosa.json.pending_action, null);

    const pregunta = await postVoice360({ input: "¿Puedo cambiar el magnetotérmico con tensión?" });
    assert.equal(pregunta.json.source, "safety");

    assert.equal(stub.calls.length, 0, "una consulta peligrosa no llega al modelo");
  });

  test("5. Una consulta de datos reales sigue siendo determinista (no gasta IA)", async (t) => {
    conBaseDeDatosDePrueba(t);
    const env = guardarEnv();
    const stub = await startStub(() => respuestaOk("no debería usarse"));

    process.env.OPENAI_API_KEY = CLAVE_FICTICIA;
    process.env.OPENAI_BASE_URL = stub.baseUrl;
    delete process.env.AI_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;

    t.after(async () => {
      restaurarEnv(env);
      await stub.close();
    });

    const res = await postVoice360({ input: "¿Qué facturas tengo pendientes?" });

    assert.equal(res.json.intent, "electricista:invoice_query");
    assert.equal(res.json.source, "engine", "las consultas de datos van por el motor");
    assert.equal(stub.calls.length, 0, "no se llama al modelo para leer la BD");
  });

  test("6. «¿Cómo añado un cliente?» se explica, no se responde con la lista de clientes", async (t) => {
    conBaseDeDatosDePrueba(t);
    const env = guardarEnv();
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;

    t.after(() => restaurarEnv(env));

    const res = await postVoice360({ input: "¿Cómo añado un cliente?" });

    assert.equal(res.json.intent, "electricista:general", "una pregunta de ayuda no es una consulta de datos");
    assert.doesNotMatch(
      res.json.answer,
      /No encontré clientes|Clientes encontrados/,
      "no debe devolver el listado de clientes de la BD"
    );
    assert.equal(res.json.draft, null);
    assert.equal(res.json.pending_action, null, "explicar no abre ninguna acción sensible");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. FRASES LARGAS, INTERRUPCIÓN Y RECUPERACIÓN
// ────────────────────────────────────────────────────────────────────────────

describe("Voz 360 — frases largas, interrupción y recuperación", () => {
  test("7. El dictado nativo pide parciales y tolera pausas naturales", () => {
    const native = read("android/app/src/main/java/com/electricista360/app/NativeStt.java");

    assert.match(
      native,
      /EXTRA_PARTIAL_RESULTS, true/,
      "debe pedirse resultado parcial para no perder lo ya dicho"
    );
    assert.match(
      native,
      /EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 4000L/,
      "el silencio de cierre debe ampliarse: el valor por defecto corta la frase"
    );
    assert.match(
      native,
      /EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 4000L/,
      "el silencio de pausa natural debe ser más largo que el de defecto"
    );
    assert.match(
      native,
      /EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 1000L/,
      "debe exigirse una duración mínima antes de cerrar la frase"
    );
    assert.match(
      native,
      /reconocedor\.startListening\(intentDictado\(\)\)/,
      "la escucha debe usar el intent de frases largas"
    );
    assert.match(
      native,
      /emitir\("partial", parcial\)/,
      "la hipótesis parcial debe llegar al WebView por el canal único"
    );
    assert.match(
      native,
      /window\.__electricistaSttEvent/,
      "el canal de eventos es uno solo para todos los tipos"
    );
    const voice = read("src/components/VoiceDictation.tsx");
    assert.match(voice, /tipo === "partial"/, "el cliente debe escuchar la hipótesis parcial");
    assert.match(voice, /n\.actual = \{ segments: n\.actual\.segments, interim: texto \};/);
  });

  /**
   * El corte prematuro ya NO se resuelve entregando y terminando (eso cortaba la
   * locución en la primera pausa): el puente entrega el SEGMENTO con lo que ya
   * había entendido y REANUDA la escucha (o usa la parcial retenida si el motor
   * cerró por silencio), y el cliente lo ACUMULA con el SDK. El texto se entrega
   * entero cuando el turno termina de verdad. Lo que se protege aquí es el
   * INVARIANTE (nada de lo entendido se pierde), no la forma del código.
   */
  test("8. Si el reconocedor corta en una pausa, se conserva lo ya entendido", () => {
    const native = read("android/app/src/main/java/com/electricista360/app/NativeStt.java");
    assert.match(native, /ultimoParcial/, "el puente debe guardar la hipótesis parcial del tramo");

    // Un `onResults` entrega SEGMENTO y la escucha se reanuda: no cierra el turno.
    const onResults = native.slice(
      native.indexOf("public void onResults(Bundle results)"),
      native.indexOf("public void onError(int error)")
    );
    assert.match(onResults, /emitir\("final", texto\)/, "el resultado del tramo se entrega como segmento");
    assert.match(onResults, /reanudar\(\);/, "y la escucha se REANUDA: el corte en la pausa no la termina");
    assert.doesNotMatch(
      onResults,
      /emitir\("stopped"\)/,
      "un segmento NO puede dar el turno por terminado (era el corte en la pausa)"
    );

    // Fin de locución por silencio (SPEECH_TIMEOUT / NO_MATCH / CLIENT): la parcial
    // retenida se entrega como segmento en lugar de perderse, y se sigue.
    const onError = native.slice(native.indexOf("public void onError(int error)"));
    assert.match(onError, /boolean finPorSilencio =/);
    assert.match(
      onError,
      /if \(finPorSilencio\) \{[\s\S]{0,300}!ultimoParcial\.isEmpty\(\)[\s\S]{0,200}emitir\("final", texto\)/,
      "la parcial retenida se entrega como segmento: nada de lo dicho se pierde"
    );
    assert.match(
      onError,
      /if \(finPorSilencio\) \{[\s\S]{0,600}reanudar\(\);/,
      "tras el fin por silencio la escucha continúa"
    );

    // El cliente ACUMULA con el SDK y lo entregado al cerrar es TODO.
    const voice = read("src/components/VoiceDictation.tsx");
    assert.match(
      voice,
      /n\.actual = mergeUtterances\(\s*n\.actual,\s*utteranceFromResults\(\[\{ transcript: texto, isFinal: true \}\]\)\s*\)/,
      "el cliente debe fusionar los segmentos con mergeUtterances (sin perder ni duplicar)"
    );
    assert.match(
      voice,
      /const dicho = finalUtteranceText\(n\.actual\);/,
      "al cerrar se entrega TODO lo acumulado, con la parcial en curso incluida"
    );
    assert.match(voice, /isEmptyUtterance\(n\.actual\)/, "y se sabe si de verdad se oyó algo");
  });

  /**
   * Detener es una parada SUAVE: el puente deja que el motor entregue el último
   * segmento y emite `stopped`, que cierra el turno con TODO lo acumulado. Si el
   * puente no contestara, una red de seguridad entrega igualmente lo que hay. El
   * invariante es el mismo de siempre: pulsar Detener no puede tirar nada de lo
   * ya dictado, y no puede entregarlo dos veces.
   */
  test("9. Detener el dictado no tira lo ya dictado (recuperación)", () => {
    const voice = read("src/components/VoiceDictation.tsx");
    const stop = voice.slice(voice.indexOf("const stopListening"), voice.indexOf("const descartarEscucha"));
    assert.match(stop, /puenteSttNativo\(\)\?\.stop\(\)/, "Detener para el micrófono en el acto");
    assert.match(
      stop,
      /programarCierreNativoForzado\(\)/,
      "y arma una red de seguridad por si el puente no contesta"
    );
    const red = voice.slice(
      voice.indexOf("function programarCierreNativoForzado"),
      voice.indexOf("function arrancarLatidoNativo")
    );
    assert.match(red, /cerrarTurnoNativo\("manual"\)/, "la red de seguridad cierra el turno igualmente");
    // La entrega FUSIONA todo lo acumulado y ocurre en UN único sitio.
    const cierre = voice.slice(
      voice.indexOf("function cerrarTurnoNativo"),
      voice.indexOf("function cerrarSesionNativaSinEntrega")
    );
    assert.match(cierre, /finalUtteranceText\(n\.actual\)/, "se entrega TODO lo acumulado");
    assert.match(cierre, /entregarTurno\(dicho\)/, "por el camino único de entrega");
    assert.ok(
      cierre.indexOf("puenteSttNativo()?.stop()") < cierre.indexOf("entregarTurno(dicho)"),
      "el micrófono se libera ANTES de entregar (no se sigue captando ni se realimenta)"
    );
    assert.match(voice, /if \(entregaHechaRef\.current \|\| descartadoRef\.current\) return;/, "entrega idempotente");
    assert.equal(
      (voice.match(/onTranscriptRef\.current\(/g) ?? []).length,
      1,
      "y en un único punto del componente"
    );

    const native = read("android/app/src/main/java/com/electricista360/app/NativeStt.java");
    const parada = native.slice(native.indexOf("public void stop()"), native.indexOf("public void cancel()"));
    assert.match(parada, /usuarioPidioParar = true;/, "la parada marca que el usuario ha terminado");
    assert.match(
      parada,
      /reconocedor\.stopListening\(\)/,
      "se pide el resultado FINAL del tramo en curso en lugar de tirarlo"
    );
    // El segmento final se entrega ANTES de cerrar: por eso Detener no pierde nada.
    const onResults = native.slice(
      native.indexOf("public void onResults(Bundle results)"),
      native.indexOf("public void onError(int error)")
    );
    const posSegmento = onResults.indexOf('emitir("final", texto)');
    const posCierre = onResults.indexOf('emitir("stopped", "")');
    assert.ok(posSegmento > 0 && posCierre > 0, "debe entregarse el segmento y luego cerrar");
    assert.ok(posSegmento < posCierre, "el último segmento llega ANTES del cierre del turno");
    assert.match(
      onResults,
      /if \(usuarioPidioParar\)[\s\S]{0,120}emitir\("stopped", ""\)/,
      "y solo entonces se cierra"
    );
    // El tope de reanudaciones también cierra entregando lo acumulado, no con error.
    assert.match(
      native,
      /reinicios >= MAX_REINICIOS[\s\S]{0,120}emitir\("stopped"/,
      "al agotar las reanudaciones se cierra el turno (y el cliente entrega lo que haya)"
    );
  });

  test("10. La respuesta hablada se puede interrumpir (botón y voz del usuario)", () => {
    const page = read("src/app/asistente/page.tsx");

    assert.match(page, /function stopSpeaking\(\)/, "debe existir una forma explícita de cortar la voz");
    assert.match(
      page,
      /speechSynthesis\?\.cancel\(\)/,
      "cortar la voz debe cancelar la síntesis en curso"
    );
    assert.match(
      page,
      /utterance\.onstart = \(\) => \{[\s\S]{0,80}setSpeaking\(true\)/,
      "debe saberse cuándo habla"
    );
    assert.match(page, /utterance\.onend = \(\) => \{[\s\S]{0,80}setSpeaking\(false\)/);
    assert.match(page, /speechTokenRef/, "una locución cancelada no debe pisar el estado de la nueva");
    assert.match(page, /Detener voz/, "debe haber un control visible para interrumpir");
    assert.match(
      page,
      /onListeningStart=\{\(\) => \{[\s\S]{0,120}stopSpeaking\(\)/,
      "si el usuario vuelve a hablar, el asistente debe callarse"
    );
    assert.match(
      page,
      /const \[speaking, setSpeaking\] = useState\(false\)/,
      "el estado de habla debe existir para mostrar el control"
    );

    const voice = read("src/components/VoiceDictation.tsx");
    assert.match(voice, /onListeningStart\?: \(\) => void/, "el dictado debe avisar de que empieza a escuchar");
    assert.match(
      voice,
      /onListeningStartRef\.current\?\.\(\)/,
      "el aviso debe emitirse al arrancar la escucha"
    );
  });

  test("11. Tras un error se puede reintentar sin volver a dictar", () => {
    const page = read("src/app/asistente/page.tsx");
    assert.match(page, /lastUserTextRef/, "debe recordarse el último texto enviado");
    assert.match(page, /Reintentar/, "debe existir el control de reintento");
    assert.match(
      page,
      /onClick=\{\(\) => void send\(lastUserTextRef\.current\)\}/,
      "reintentar debe reenviar exactamente el último texto"
    );
  });

  test("12. La procedencia de la respuesta es visible para el usuario", () => {
    const page = read("src/app/asistente/page.tsx");
    assert.match(page, /SOURCE_LABELS/, "debe haber etiquetas de procedencia");
    assert.match(page, /ai: "IA"/, "la respuesta de IA debe identificarse como tal");
    assert.match(
      page,
      /\(data\.source as AnswerSource\)/,
      "la UI debe conservar la procedencia que devuelve el motor"
    );
  });
});
