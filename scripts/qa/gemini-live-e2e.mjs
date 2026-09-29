/**
 * ELECTRICISTA360 — QA P0-1 · Gemini Live END-TO-END REAL
 *
 * Qué prueba (contra la API REAL de Google, sin mocks):
 *   1. Mintea un token efímero EXACTAMENTE igual que
 *      `/api/asistente/gemini-live/token` (mismo cuerpo, mismo modelo).
 *   2. Abre el WebSocket restringido `BidiGenerateContentConstrained`.
 *   3. Manda el `setup` como primer mensaje y espera `setupComplete`.
 *   4. SINTETIZA VOZ REAL con un modelo TTS y la envía como audio de entrada
 *      16 kHz Int16 LE, en chunks de 40 ms, igual que hace el móvil.
 *      -> prueba AUDIO_IN (si Gemini transcribe lo que le llega).
 *   5. Recoge el audio de respuesta (24 kHz) y lo cuenta en bytes
 *      -> prueba AUDIO_OUT.
 *   6. Prueba el BARGE-IN del proveedor: manda voz encima de la respuesta y
 *      espera `serverContent.interrupted`.
 *
 * NO imprime la clave ni el token: sólo métricas y estados.
 *
 * Uso:  node scripts/qa/gemini-live-e2e.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..", "..");

const MODELO_LIVE = process.env.GEMINI_LIVE_MODEL?.trim() || "gemini-3.8-live";
const MODELO_TTS = process.env.GEMINI_TTS_MODEL?.trim() || "gemini-3.8-flash-tts";
const WS_LIVE =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";
const BYTES_POR_CHUNK = 1280; // 40 ms a 16 kHz Int16 mono

function claveApi() {
  if (process.env.GEMINI_API_KEY?.trim()) return process.env.GEMINI_API_KEY.trim();
  const env = readFileSync(join(RAIZ, ".env.local"), "utf8");
  const linea = env.split(/\r?\n/).find((l) => /^\s*GEMINI_API_KEY\s*=/.test(l));
  if (!linea) throw new Error("GEMINI_API_KEY no encontrada en .env.local");
  return linea.replace(/^\s*GEMINI_API_KEY\s*=\s*/, "").trim().replace(/^["']|["']$/g, "");
}

const informe = {
  tokenHttp: null,
  tokenOk: false,
  wsOpen: false,
  setupComplete: false,
  setupMs: null,
  audioInChunks: 0,
  audioInBytes: 0,
  transcripcionEntrada: "",
  audioOutChunks: 0,
  audioOutBytes: 0,
  mimeSalida: null,
  rateSalida: null,
  primerAudioOutMs: null,
  turnComplete: false,
  bargeInInterrupted: false,
  errores: [],
};

function aBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

function int16leABuffer(int16) {
  const b = Buffer.alloc(int16.length * 2);
  for (let i = 0; i < int16.length; i += 1) b.writeInt16LE(int16[i], i * 2);
  return b;
}

/** Remuestreo lineal simple (24 kHz TTS -> 16 kHz Gemini). */
function remuestrear(muestras, origen, destino) {
  if (origen === destino) return muestras;
  const n = Math.floor((muestras.length * destino) / origen);
  const salida = new Int16Array(n);
  for (let i = 0; i < n; i += 1) {
    const pos = (i * origen) / destino;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, muestras.length - 1);
    const f = pos - i0;
    salida[i] = Math.round(muestras[i0] * (1 - f) + muestras[i1] * f);
  }
  return salida;
}

/** Sintetiza voz REAL (PCM 24 kHz) con un modelo TTS de Google. */
async function sintetizarVoz(texto, apiKey) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELO_TTS}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: texto }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
          },
        },
      }),
    }
  );
  if (!res.ok) throw new Error(`TTS_HTTP_${res.status}`);
  const json = await res.json();
  const parte = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!parte) throw new Error("TTS_SIN_AUDIO");
  const mime = parte.inlineData.mimeType ?? "";
  const rate = Number(/rate=(\d+)/.exec(mime)?.[1] ?? 24000);
  const bytes = Buffer.from(parte.inlineData.data, "base64");
  const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.length / 2));
  return { int16: Int16Array.from(int16), rate, mime };
}

/** Cuerpo del token: idéntico al de la ruta del backend. */
async function mintearToken(apiKey) {
  const ahora = Date.now();
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      uses: 1,
      expireTime: new Date(ahora + 30 * 60_000).toISOString(),
      newSessionExpireTime: new Date(ahora + 60_000).toISOString(),
      bidiGenerateContentSetup: {
        model: `models/${MODELO_LIVE}`,
        generationConfig: { responseModalities: ["AUDIO"] },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        sessionResumption: {},
      },
    }),
  });
  informe.tokenHttp = res.status;
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.name) {
    throw new Error(`TOKEN_FALLO_${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  }
  informe.tokenOk = true;
  return json.name;
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function principal() {
  const apiKey = claveApi();
  console.log(`[1/6] Modelo Live: ${MODELO_LIVE} · TTS: ${MODELO_TTS}`);

  const token = await mintearToken(apiKey);
  console.log(`[2/6] Token efímero OK · HTTP ${informe.tokenHttp}`);

  // Voz real: pregunta + frase de interrupción.
  const pregunta = await sintetizarVoz(
    "Hola, ¿me estás oyendo? Cuéntame en una frase qué eres capaz de hacer.",
    apiKey
  );
  const interrupcion = await sintetizarVoz("Espera, para un momento, tengo otra pregunta.", apiKey);
  console.log(
    `[3/6] TTS OK · pregunta ${(pregunta.int16.length / pregunta.rate).toFixed(1)} s @${pregunta.rate} Hz`
  );

  const ws = new WebSocket(`${WS_LIVE}?access_token=${encodeURIComponent(token)}`);
  ws.binaryType = "arraybuffer";

  const t0 = Date.now();
  let resolverSetup;
  let rechazarSetup;
  const esperaSetup = new Promise((res, rej) => {
    resolverSetup = res;
    rechazarSetup = rej;
    setTimeout(() => rej(new Error("SETUP_TIMEOUT")), 15000);
  });

  ws.onopen = () => {
    informe.wsOpen = true;
    ws.send(
      JSON.stringify({
        setup: {
          model: `models/${MODELO_LIVE}`,
          generationConfig: { responseModalities: ["AUDIO"] },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      })
    );
  };

  ws.onerror = (e) => {
    informe.errores.push(`WS_ERROR:${e?.message ?? ""}`);
    rechazarSetup?.(new Error("WS_ERROR"));
  };
  ws.onclose = (e) => {
    informe.errores.push(`WS_CLOSE_${e.code}`);
    rechazarSetup?.(new Error(`WS_CLOSE_${e.code}`));
  };

  ws.onmessage = (evento) => {
    const texto =
      typeof evento.data === "string"
        ? evento.data
        : Buffer.from(evento.data).toString("utf8");
    let msg;
    try {
      msg = JSON.parse(texto);
    } catch {
      return;
    }
    if (msg.setupComplete) {
      informe.setupComplete = true;
      informe.setupMs = Date.now() - t0;
      resolverSetup?.();
      return;
    }
    if (msg.error) informe.errores.push(`GEMINI:${JSON.stringify(msg.error).slice(0, 200)}`);
    const sc = msg.serverContent;
    if (!sc) return;
    if (sc.interrupted === true) informe.bargeInInterrupted = true;
    if (sc.inputTranscription?.text) informe.transcripcionEntrada += sc.inputTranscription.text;
    for (const parte of sc.modelTurn?.parts ?? []) {
      const datos = parte.inlineData?.data;
      if (!datos) continue;
      if (informe.mimeSalida === null) {
        informe.mimeSalida = parte.inlineData.mimeType ?? null;
        informe.rateSalida = Number(/rate=(\d+)/.exec(informe.mimeSalida ?? "")?.[1] ?? null);
      }
      if (informe.primerAudioOutMs === null) informe.primerAudioOutMs = Date.now() - t0;
      informe.audioOutChunks += 1;
      informe.audioOutBytes += Buffer.from(datos, "base64").length;
    }
    if (sc.turnComplete === true) informe.turnComplete = true;
  };

  await esperaSetup;
  console.log(`[4/6] WS OPEN + setupComplete en ${informe.setupMs} ms`);

  /** Envía PCM Int16 a 16 kHz como haría el móvil. */
  const enviarAudio = async (voz) => {
    const a16 = remuestrear(voz.int16, voz.rate, 16000);
    const bytes = int16leABuffer(a16);
    for (let off = 0; off < bytes.length; off += BYTES_POR_CHUNK) {
      const trozo = bytes.subarray(off, Math.min(off + BYTES_POR_CHUNK, bytes.length));
      ws.send(
        JSON.stringify({
          realtimeInput: { audio: { data: aBase64(trozo), mimeType: "audio/pcm;rate=16000" } },
        })
      );
      informe.audioInChunks += 1;
      informe.audioInBytes += trozo.length;
      await dormir(40); // tiempo real, como el micrófono
    }
    ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
  };

  await enviarAudio(pregunta);
  // Silencio real tras hablar: Gemini necesita ver el fin de la locución.
  await dormir(1200);

  // Espera a que llegue la primera respuesta hablada.
  const limite = Date.now() + 20000;
  while (informe.audioOutChunks === 0 && Date.now() < limite) await dormir(200);
  if (informe.audioOutChunks > 0) {
    console.log(
      `[5/6] AUDIO_OUT: ${informe.audioOutChunks} chunks · ${informe.audioOutBytes} bytes · ${informe.mimeSalida} · primer chunk a ${informe.primerAudioOutMs} ms`
    );
    // BARGE-IN: se habla encima de la respuesta y se espera `interrupted`.
    await enviarAudio(interrupcion);
    const limiteBarge = Date.now() + 12000;
    while (!informe.bargeInInterrupted && Date.now() < limiteBarge) await dormir(150);
    console.log(`[6/6] BARGE-IN (interrupted del proveedor): ${informe.bargeInInterrupted}`);
  } else {
    console.log("[5/6] SIN AUDIO DE RESPUESTA");
  }

  try {
    ws.close(1000, "fin");
  } catch {
    /* ignore */
  }
  await dormir(300);

  console.log("\n=== INFORME P0-1 (protocolo real) ===");
  console.log(JSON.stringify(informe, null, 2));

  const ok =
    informe.tokenOk &&
    informe.wsOpen &&
    informe.setupComplete &&
    informe.audioInChunks > 0 &&
    informe.audioOutChunks > 0 &&
    informe.transcripcionEntrada.trim().length > 0;
  console.log(`\nRESULTADO: ${ok ? "PASS" : "FAIL"}`);
  process.exit(ok ? 0 : 1);
}

principal().catch((e) => {
  console.error("FALLO:", e.message);
  console.error(JSON.stringify(informe, null, 2));
  process.exit(1);
});
