/**
 * ELECTRICISTA360 — SONDA P0-1: ¿por qué Gemini Live no responde al audio?
 *
 * Compara configuraciones contra la API REAL para aislar la causa:
 *   - transporte: token efímero (BidiGenerateContentConstrained) vs clave directa
 *   - campo de entrada: realtimeInput.audio vs realtimeInput.mediaChunks
 *   - señales de actividad: sin ellas vs activityStart/activityEnd
 *
 * También verifica que el audio enviado NO es silencio (RMS de la onda real).
 * No imprime claves ni tokens.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..", "..");
const MODELO_LIVE = process.env.GEMINI_LIVE_MODEL?.trim() || "gemini-3.8-live";
const MODELO_TTS = process.env.GEMINI_TTS_MODEL?.trim() || "gemini-3.8-flash-tts";
const BASE_WS = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService";
const BYTES_POR_CHUNK = 1280;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function claveApi() {
  if (process.env.GEMINI_API_KEY?.trim()) return process.env.GEMINI_API_KEY.trim();
  const env = readFileSync(join(RAIZ, ".env.local"), "utf8");
  const linea = env.split(/\r?\n/).find((l) => /^\s*GEMINI_API_KEY\s*=/.test(l));
  if (!linea) throw new Error("sin clave");
  return linea.replace(/^\s*GEMINI_API_KEY\s*=\s*/, "").trim().replace(/^["']|["']$/g, "");
}

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

async function sintetizarVoz(texto, apiKey) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO_TTS}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: texto }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } } },
      },
    }),
  });
  if (!res.ok) throw new Error(`TTS_HTTP_${res.status}`);
  const json = await res.json();
  const parte = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  const mime = parte.inlineData.mimeType ?? "";
  const rate = Number(/rate=(\d+)/.exec(mime)?.[1] ?? 24000);
  const bytes = Buffer.from(parte.inlineData.data, "base64");
  const n = Math.floor(bytes.length / 2);
  const copia = Buffer.alloc(n * 2);
  bytes.copy(copia, 0, 0, n * 2);
  return { int16: new Int16Array(copia.buffer, copia.byteOffset, n), rate, mime };
}

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
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.name) throw new Error(`TOKEN_${res.status}`);
  return json.name;
}

function int16leBuffer(int16) {
  const b = Buffer.alloc(int16.length * 2);
  for (let i = 0; i < int16.length; i += 1) b.writeInt16LE(int16[i], i * 2);
  return b;
}

async function ejecutarConfig({ nombre, transporte, campo, actividad }, apiKey, voz, tokenCache) {
  const resultado = {
    nombre,
    transporte,
    campo,
    actividad,
    wsOpen: false,
    setupComplete: false,
    chunksEnviados: 0,
    transcripcion: "",
    chunksAudioOut: 0,
    bytesAudioOut: 0,
    mimeSalida: null,
    turnComplete: false,
    mensajesServidor: [],
    errores: [],
  };

  let url;
  if (transporte === "token") {
    const token = tokenCache.valor ?? (tokenCache.valor = await mintearToken(apiKey));
    url = `${BASE_WS}.BidiGenerateContentConstrained?access_token=${encodeURIComponent(token)}`;
  } else {
    url = `${BASE_WS}.BidiGenerateContent?key=${encodeURIComponent(apiKey)}`;
  }

  const ws = new WebSocket(url);
  ws.binaryType = "arraybuffer";

  let resolver, rechazar;
  const espera = new Promise((res, rej) => {
    resolver = res;
    rechazar = rej;
    setTimeout(() => rej(new Error("SETUP_TIMEOUT")), 15000);
  });

  ws.onopen = () => {
    resultado.wsOpen = true;
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
  ws.onerror = () => rechazar?.(new Error("WS_ERROR"));
  ws.onclose = (e) => {
    resultado.errores.push(`CLOSE_${e.code}`);
    rechazar?.(new Error(`CLOSE_${e.code}`));
  };
  ws.onmessage = (ev) => {
    const texto = typeof ev.data === "string" ? ev.data : Buffer.from(ev.data).toString("utf8");
    let msg;
    try {
      msg = JSON.parse(texto);
    } catch {
      resultado.mensajesServidor.push(`NO_JSON:${texto.slice(0, 120)}`);
      return;
    }
    if (msg.setupComplete) {
      resultado.setupComplete = true;
      resolver?.();
      return;
    }
    if (msg.error) resultado.errores.push(`ERROR:${JSON.stringify(msg.error).slice(0, 220)}`);
    const sc = msg.serverContent;
    if (!sc) {
      resultado.mensajesServidor.push(JSON.stringify(msg).slice(0, 200));
      return;
    }
    if (sc.inputTranscription?.text) resultado.transcripcion += sc.inputTranscription.text;
    for (const p of sc.modelTurn?.parts ?? []) {
      if (!p.inlineData?.data) continue;
      resultado.mimeSalida ??= p.inlineData.mimeType ?? null;
      resultado.chunksAudioOut += 1;
      resultado.bytesAudioOut += Buffer.from(p.inlineData.data, "base64").length;
    }
    if (sc.turnComplete) resultado.turnComplete = true;
  };

  try {
    await espera;
  } catch (e) {
    resultado.errores.push(`SETUP:${e.message}`);
    try {
      ws.close();
    } catch {}
    return resultado;
  }

  const a16 = remuestrear(voz.int16, voz.rate, 16000);
  const bytes = int16leBuffer(a16);

  if (actividad) ws.send(JSON.stringify({ realtimeInput: { activityStart: {} } }));

  for (let off = 0; off < bytes.length; off += BYTES_POR_CHUNK) {
    const trozo = bytes.subarray(off, Math.min(off + BYTES_POR_CHUNK, bytes.length));
    const payload =
      campo === "audio"
        ? { realtimeInput: { audio: { data: trozo.toString("base64"), mimeType: "audio/pcm;rate=16000" } } }
        : {
            realtimeInput: {
              mediaChunks: [{ data: trozo.toString("base64"), mimeType: "audio/pcm;rate=16000" }],
            },
          };
    ws.send(JSON.stringify(payload));
    resultado.chunksEnviados += 1;
    await dormir(40);
  }

  if (actividad) ws.send(JSON.stringify({ realtimeInput: { activityEnd: {} } }));
  ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));

  const limite = Date.now() + 18000;
  while (resultado.chunksAudioOut === 0 && Date.now() < limite) await dormir(250);

  try {
    ws.close(1000, "fin");
  } catch {}
  await dormir(250);
  return resultado;
}

async function principal() {
  const apiKey = claveApi();
  const voz = await sintetizarVoz("Hola, dime en una frase corta cómo te llamas.", apiKey);

  // Comprobación del audio que vamos a mandar: NO debe ser silencio.
  let suma = 0;
  for (let i = 0; i < voz.int16.length; i += 1) suma += voz.int16[i] * voz.int16[i];
  const rms = Math.sqrt(suma / voz.int16.length) / 32768;
  console.log(
    `Audio TTS: ${(voz.int16.length / voz.rate).toFixed(2)} s @ ${voz.rate} Hz · ${voz.mime} · RMS=${rms.toFixed(4)}`
  );

  const tokenCache = { valor: null };
  const configs = [
    { nombre: "token+audio", transporte: "token", campo: "audio", actividad: false },
    { nombre: "token+audio+actividad", transporte: "token", campo: "audio", actividad: true },
    { nombre: "token+mediaChunks", transporte: "token", campo: "mediaChunks", actividad: false },
    { nombre: "claveDirecta+audio", transporte: "clave", campo: "audio", actividad: false },
  ];

  const salida = [];
  for (const cfg of configs) {
    try {
      const r = await ejecutarConfig(cfg, apiKey, voz, tokenCache);
      salida.push(r);
      console.log(
        `\n[${cfg.nombre}] setup=${r.setupComplete} chunksIn=${r.chunksEnviados} chunksOut=${r.chunksAudioOut} bytesOut=${r.bytesAudioOut} mime=${r.mimeSalida} turnComplete=${r.turnComplete}`
      );
      console.log(`  transcripcion="${r.transcripcion.slice(0, 160)}"`);
      if (r.errores.length) console.log(`  errores=${JSON.stringify(r.errores)}`);
      if (r.mensajesServidor.length)
        console.log(`  otros=${JSON.stringify(r.mensajesServidor.slice(0, 3))}`);
    } catch (e) {
      console.log(`\n[${cfg.nombre}] FALLO: ${e.message}`);
    }
  }

  const ganadora = salida.find((r) => r.chunksAudioOut > 0);
  console.log(`\n=== CONFIGURACIÓN QUE FUNCIONA: ${ganadora ? ganadora.nombre : "NINGUNA"} ===`);
}

principal().catch((e) => {
  console.error("FALLO GENERAL:", e.message);
  process.exit(1);
});
