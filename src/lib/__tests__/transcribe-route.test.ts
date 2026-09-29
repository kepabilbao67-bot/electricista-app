import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/asistente/transcribe/route";

/**
 * DICTAR — FALLBACK DE TRANSCRIPCIÓN EN EL SERVIDOR
 *
 * Estas pruebas fijan el contrato que usa el botón "Dictar" cuando la Web Speech
 * API del navegador no sirve:
 *
 *   audio (multipart) → POST /api/asistente/transcribe → { text }
 *
 * Ninguna prueba sale a Internet: `fetch` se sustituye por un doble, así que se
 * comprueba la LÓGICA (proveedores, códigos y mensajes) sin depender de terceros.
 * Además se verifica explícitamente que las claves NO aparecen en la respuesta.
 */

const CLAVE_OPENAI = "sk-prueba-no-real-0000000000";
const CLAVE_GOOGLE = "clave-google-de-prueba-0000000000";
const fetchOriginal = globalThis.fetch;

interface Llamada {
  url: string;
  init: RequestInit | undefined;
}

function audioDePrueba(bytes = 2048, tipo = "audio/webm"): File {
  return new File([new Uint8Array(bytes)], "dictado.webm", { type: tipo });
}

function peticionConAudio(audio: File | null): NextRequest {
  const form = new FormData();
  if (audio) form.append("audio", audio);
  return new NextRequest("http://localhost:3000/api/asistente/transcribe", {
    method: "POST",
    body: form,
  });
}

/** Sustituye fetch global y registra las llamadas. */
function doblarFetch(handler: (llamada: Llamada) => Promise<Response>): Llamada[] {
  const llamadas: Llamada[] = [];
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    const llamada = { url: String(url), init };
    llamadas.push(llamada);
    return handler(llamada);
  }) as typeof fetch;
  return llamadas;
}

function respuestaJson(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/asistente/transcribe — dictado por servidor", () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
  });

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
  });

  test("1. sin ninguna clave de voz responde 503 STT_NOT_CONFIGURED (mensaje que el cliente entiende)", async () => {
    const res = await POST(peticionConAudio(audioDePrueba()));
    assert.equal(res.status, 503);
    const json = await res.json();
    assert.equal(json.error, "STT_NOT_CONFIGURED");
  });

  test("2. sin campo de audio responde 400 AUDIO_REQUIRED", async () => {
    process.env.OPENAI_API_KEY = CLAVE_OPENAI;
    const res = await POST(peticionConAudio(null));
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, "AUDIO_REQUIRED");
  });

  test("3. con OpenAI configurado devuelve el texto reconocido", async () => {
    process.env.OPENAI_API_KEY = CLAVE_OPENAI;
    const llamadas = doblarFetch(async () =>
      respuestaJson({ text: "Quiero un presupuesto para un enchufe, dos interruptores y dos horas de mano de obra" })
    );

    const res = await POST(peticionConAudio(audioDePrueba()));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(
      json.text,
      "Quiero un presupuesto para un enchufe, dos interruptores y dos horas de mano de obra"
    );
    assert.equal(json.provider, "openai");
    assert.equal(llamadas.length, 1);
    assert.match(llamadas[0].url, /api\.openai\.com\/v1\/audio\/transcriptions/);
  });

  test("4. si OpenAI falla, se usa el segundo proveedor y el dictado SIGUE funcionando", async () => {
    process.env.OPENAI_API_KEY = CLAVE_OPENAI;
    process.env.GEMINI_API_KEY = CLAVE_GOOGLE;
    const llamadas = doblarFetch(async (llamada) => {
      if (llamada.url.includes("api.openai.com")) {
        return respuestaJson({ error: { message: "invalid key" } }, 401);
      }
      return respuestaJson({ candidates: [{ content: { parts: [{ text: "dos horas de mano de obra" }] } }] });
    });

    const res = await POST(peticionConAudio(audioDePrueba()));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.text, "dos horas de mano de obra");
    assert.equal(json.provider, "google");
    assert.equal(llamadas.length, 2, "debe intentar los DOS proveedores");
  });

  test("5. audio sin voz (proveedor responde vacío) → 422 STT_EMPTY, que el cliente traduce a 'no se ha oído nada'", async () => {
    process.env.OPENAI_API_KEY = CLAVE_OPENAI;
    doblarFetch(async () => respuestaJson({ text: "   " }));
    const res = await POST(peticionConAudio(audioDePrueba()));
    assert.equal(res.status, 422);
    assert.equal((await res.json()).error, "STT_EMPTY");
  });

  test("6. todos los proveedores caídos → 502 STT_UPSTREAM_ERROR (nunca 200 sin texto)", async () => {
    process.env.OPENAI_API_KEY = CLAVE_OPENAI;
    process.env.GEMINI_API_KEY = CLAVE_GOOGLE;
    doblarFetch(async () => respuestaJson({ error: { message: "boom" } }, 500));
    const res = await POST(peticionConAudio(audioDePrueba()));
    assert.equal(res.status, 502);
    assert.equal((await res.json()).error, "STT_UPSTREAM_ERROR");
  });

  test("7. una excepción de red del proveedor no rompe la ruta (502, no 500)", async () => {
    process.env.OPENAI_API_KEY = CLAVE_OPENAI;
    doblarFetch(async () => {
      throw new Error("network down");
    });
    const res = await POST(peticionConAudio(audioDePrueba()));
    assert.equal(res.status, 502);
  });

  test("8. las claves NUNCA aparecen en la respuesta", async () => {
    process.env.OPENAI_API_KEY = CLAVE_OPENAI;
    process.env.GEMINI_API_KEY = CLAVE_GOOGLE;
    doblarFetch(async () => respuestaJson({ error: { message: `fallo con ${CLAVE_OPENAI}` } }, 500));

    const res = await POST(peticionConAudio(audioDePrueba()));
    const texto = await res.text();
    assert.ok(!texto.includes(CLAVE_OPENAI), "la clave de OpenAI no puede salir en la respuesta");
    assert.ok(!texto.includes(CLAVE_GOOGLE), "la clave de Google no puede salir en la respuesta");
  });

  test("9. un audio vacío se rechaza sin llamar al proveedor", async () => {
    process.env.OPENAI_API_KEY = CLAVE_OPENAI;
    const llamadas = doblarFetch(async () => respuestaJson({ text: "no debería llegar" }));
    const res = await POST(peticionConAudio(audioDePrueba(0)));
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, "AUDIO_SIZE_INVALID");
    assert.equal(llamadas.length, 0, "no se debe llamar al proveedor con audio vacío");
  });

  test("10. la clave de Google también sirve como único proveedor", async () => {
    process.env.GEMINI_API_KEY = CLAVE_GOOGLE;
    const llamadas = doblarFetch(async () =>
      respuestaJson({ candidates: [{ content: { parts: [{ text: "presupuesto para un enchufe" }] } }] })
    );
    const res = await POST(peticionConAudio(audioDePrueba()));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.text, "presupuesto para un enchufe");
    assert.equal(llamadas.length, 1);
    assert.match(llamadas[0].url, /generativelanguage\.googleapis\.com/);
  });

  /**
   * MEDIDO EN REAL (10 ciclos de dictado seguidos): el proveedor contestó 429
   * ("You exceeded your current quota") y ese dictado se perdía con un error aunque
   * el siguiente funcionara. Un reintento acotado convierte ese hipo en un dictado
   * correcto, que es lo que el usuario espera.
   */
  test("11. un 429 del proveedor se reintenta UNA vez y el dictado sale bien", async () => {
    process.env.GEMINI_API_KEY = CLAVE_GOOGLE;
    let intentos = 0;
    const llamadas = doblarFetch(async () => {
      intentos += 1;
      if (intentos === 1) return respuestaJson({ error: { message: "quota exceeded" } }, 429);
      return respuestaJson({ candidates: [{ content: { parts: [{ text: "dos horas de mano de obra" }] } }] });
    });

    const res = await POST(peticionConAudio(audioDePrueba()));
    assert.equal(res.status, 200, "el reintento debe salvar el dictado");
    assert.equal((await res.json()).text, "dos horas de mano de obra");
    assert.equal(llamadas.length, 2, "un fallo transitorio se intenta dos veces, no más");
  });

  test("12. un error NO transitorio (401) no se reintenta: no se gasta cuota ni tiempo", async () => {
    process.env.OPENAI_API_KEY = CLAVE_OPENAI;
    const llamadas = doblarFetch(async () => respuestaJson({ error: { message: "invalid key" } }, 401));
    const res = await POST(peticionConAudio(audioDePrueba()));
    assert.equal(res.status, 502);
    assert.equal(llamadas.length, 1, "una clave inválida no mejora reintentando");
  });

  /**
   * MEDIDO EN REAL (ciclos de dictado seguidos): el modelo especializado de
   * transcripción agotó su cuota y devolvía 429 en TODAS las peticiones, así que el
   * dictado se caía una y otra vez con el audio perfecto. La cuota es POR MODELO:
   * probar el modelo de reserva con el mismo audio es lo que salva el dictado.
   */
  test("13. si el modelo de transcripción está saturado (429), el modelo de reserva salva el dictado", async () => {
    process.env.GEMINI_API_KEY = CLAVE_GOOGLE;
    const llamadas = doblarFetch(async (llamada) => {
      if (llamada.url.includes("gemini-3.5-transcribe")) {
        return respuestaJson({ error: { message: "quota exceeded" } }, 429);
      }
      return respuestaJson({
        candidates: [{ content: { parts: [{ text: "dos horas de mano de obra" }] } }],
      });
    });

    const res = await POST(peticionConAudio(audioDePrueba()));
    assert.equal(res.status, 200, "una cuota agotada no puede tumbar el dictado");
    assert.equal((await res.json()).text, "dos horas de mano de obra");
    assert.ok(
      llamadas.some((l) => l.url.includes("gemini-3.5-transcribe")),
      "primero se intenta el modelo especializado"
    );
    assert.ok(
      llamadas.some((l) => l.url.includes("gemini-3.5-flash")),
      "y después el modelo de reserva, con el mismo audio"
    );
  });

  test("14. un audio SIN VOZ no gasta el modelo de reserva (la respuesta correcta era 'no hay voz')", async () => {
    process.env.GEMINI_API_KEY = CLAVE_GOOGLE;
    const llamadas = doblarFetch(async () =>
      respuestaJson({ candidates: [{ content: { parts: [{ text: "   " }] } }] })
    );
    const res = await POST(peticionConAudio(audioDePrueba()));
    assert.equal(res.status, 422);
    assert.equal(llamadas.length, 1, "sin voz no hay nada que arreglar cambiando de modelo");
  });

  /**
   * Los picos de demanda ("high demand", 503) son POR MODELO y transitorios: por eso
   * las reservas se piden a la vez y basta con que UNA responda.
   */
  test("15. con una reserva caída y otra disponible, el dictado sale igual", async () => {
    process.env.GEMINI_API_KEY = CLAVE_GOOGLE;
    const llamadas = doblarFetch(async (llamada) => {
      if (llamada.url.includes("gemini-3.5-transcribe")) {
        return respuestaJson({ error: { message: "quota exceeded" } }, 429);
      }
      if (llamada.url.includes("gemini-3.5-flash-lite")) {
        return respuestaJson({ error: { message: "high demand" } }, 503);
      }
      return respuestaJson({
        candidates: [{ content: { parts: [{ text: "dos horas de mano de obra" }] } }],
      });
    });

    const res = await POST(peticionConAudio(audioDePrueba()));
    assert.equal(res.status, 200, "una reserva caída no puede tumbar el dictado");
    assert.equal((await res.json()).text, "dos horas de mano de obra");
    assert.ok(llamadas.length >= 3, "deben intentarse el principal y las dos reservas");
  });
});

