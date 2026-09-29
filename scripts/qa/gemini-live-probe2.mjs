/**
 * ELECTRICISTA360 — SONDA P0-1 (2ª vuelta): cierre de turno.
 *
 * La 1ª sonda demostró que Gemini RECIBE el audio (llega `voiceActivity
 * ACTIVITY_START`), pero no responde. La hipótesis del propio código del
 * proyecto es que hace falta una COLA DE SILENCIO real antes de
 * `audioStreamEnd`. Aquí se compara:
 *
 *   E1: voz + 1,2 s de SILENCIO + audioStreamEnd
 *   E2: voz + 1,2 s de SILENCIO (sin audioStreamEnd, sólo VAD)
 *   E3: voz + audioStreamEnd inmediato (control, ya falló en la 1ª sonda)
 *
 * Además se transcribe el audio del TTS con un modelo de transcripción para
 * descartar que el problema sea que el audio no es inteligible.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..", "..");
const MODELO_LIVE = process.env.GEMINI_LIVE_MODEL?.trim() || "gemini-3.8-live";
const MODELO_TTS = process.env.GEMINI_TTS_MODEL?.trim() || "gemini-3.8-flash-tts";
const MODELO_STT = process.env.GEMINI_STT_MODEL?.trim() || "gemini-3.5-transcribe";
const BASE_WS = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService";
const BYTES_POR_CHUNK = 1280;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function claveApi() {
  if (process.env.GEMINI_API_KEY?.trim()) return process.env.GEMINI_API_KEY.trim();
  const env = readFileSync(join(RAIZ, ".env.local"), "utf8");
  const linea = env.split(/\r?\n/).find((l) => /^\s*GEMINI_API_KEY\s*=/.test(l));
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
  const bytes = Buffer.from(parte.inlineData.data, "base64");
  const n = Math.floor(bytes.length / 2);
  const copia = Buffer.alloc(n * 2);
  bytes.copy(copia, 0, 0, n * 2);
  const int16 = new Int16Array(copia.buffer, copia.byteOffset, n);
  return { int16, rate: Number(/rate=(\d+)/.exec(mime)?.[1] ?? 24000), mime };
}

async function transcribir(int16, rate, apiKey) {
  const b = Buffer.alloc(int16.length * 2);
  for (let i = 0; i < int16.length; i += 1) b.writeInt16LE(int16[i], i * 2);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELO_STT}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: "Transcribe literalmente este audio." },
              { inlineData: { mimeType: `audio/pcm;rate=${rate}`, data: b.toString("base64") } },
            ],
          },
        ],
      }),
    }
  );
  const json = await res.json().catch(() => ({}));
  return { status: res.status, texto: JSON.stringify(json).slice(0, 400) };
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

async function enviar(ws, bytes, contador) {
  for (let off = 0; off < bytes.length; off += BYTES_POR_CHUNK) {
    const trozo = bytes.subarray(off, Math.min(off + BYTES_POR_CHUNK, bytes.length));
    ws.send(
      JSON.stringify({
        realtimeInput: { audio: { data: trozo.toString("base64"), mimeType: "audio/pcm;rate=16000" } },
      })
    );
    contador.n += 1;
    await dormir(40);
  }
}

async function ejecutar(nombre, estrategia, apiKey, voz) {
  const r = {
    nombre,
    estrategia,
    chunksOut: 0,
    bytesOut: 0,
    mime: null,
    transcripcionIn: "",
    transcripcionOut: "",
    turnComplete: false,
    eventos: [],
    errores: [],
  };

  const token = await mintearToken(apiKey);
  const ws = new WebSocket(`${BASE_WS}.BidiGenerateContentConstrained?access_token=${encodeURIComponent(token)}`);
  ws.binaryType = "arraybuffer";

  let resolver, rechazar;
  const listo = new Promise((res, rej) => {
    resolver = res;
    rechazar = rej;
    setTimeout(() => rej(new Error("SETUP_TIMEOUT")), 15000);
  });

  ws.onopen = () =>
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
  ws.onerror = () => rechazar?.(new Error("WS_ERROR"));
  ws.onclose = (e) => rechazar?.(new Error(`CLOSE_${e.code}`));
  ws.onmessage = (ev) => {
    const t = typeof ev.data === "string" ? ev.data : Buffer.from(ev.data).toString("utf8");
    let msg;
    try {
      msg = JSON.parse(t);
    } catch {
      return;
    }
    if (msg.setupComplete) return resolver?.();
    if (msg.voiceActivity) r.eventos.push(`voiceActivity:${msg.voiceActivity.type}`);
    if (msg.error) r.errores.push(JSON.stringify(msg.error).slice(0, 200));
    const sc = msg.serverContent;
    if (!sc) return;
    if (sc.interrupted) r.eventos.push("interrupted");
    if (sc.inputTranscription?.text) r.transcripcionIn += sc.inputTranscription.text;
    if (sc.outputTranscription?.text) r.transcripcionOut += sc.outputTranscription.text;
    for (const p of sc.modelTurn?.parts ?? []) {
      if (!p.inlineData?.data) continue;
      r.mime ??= p.inlineData.mimeType ?? null;
      r.chunksOut += 1;
      r.bytesOut += Buffer.from(p.inlineData.data, "base64").length;
    }
    if (sc.turnComplete) r.turnComplete = true;
  };

  await listo;
  const contador = { n: 0 };
  await enviar(ws, int16leBuffer(remuestrear(voz.int16, voz.rate, 16000)), contador);

  if (estrategia === "silencio+end") {
    await enviar(ws, Buffer.alloc(16000 * 2 * 1.2), contador);
    ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
  } else if (estrategia === "solo-silencio") {
    await enviar(ws, Buffer.alloc(16000 * 2 * 1.2), contador);
  } else {
    ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
  }

  const limite = Date.now() + 25000;
  while (r.chunksOut === 0 && !r.turnComplete && Date.now() < limite) await dormir(250);
  try {
    ws.close(1000, "fin");
  } catch {}
  await dormir(250);
  return r;
}

async function principal() {
  const apiKey = claveApi();
  const texto = "Hola, dime en una frase corta cómo te llamas.";
  const voz = await sintetizarVoz(texto, apiKey);
  console.log(`TTS: ${(voz.int16.length / voz.rate).toFixed(2)} s @ ${voz.rate} · ${voz.mime}`);
  const stt = await transcribir(voz.int16, voz.rate, apiKey);
  console.log(`STT (${stt.status}): ${stt.texto.slice(0, 220)}`);

  for (const [nombre, estrategia] of [
    ["E1 silencio+audioStreamEnd", "silencio+end"],
    ["E2 solo silencio (VAD)", "solo-silencio"],
  ]) {
    const r = await ejecutar(nombre, estrategia, apiKey, voz);
    console.log(
      `\n[${r.nombre}] chunksOut=${r.chunksOut} bytes=${r.bytesOut} mime=${r.mime} turnComplete=${r.turnComplete}`
    );
    console.log(`  in="${r.transcripcionIn.slice(0, 120)}" out="${r.transcripcionOut.slice(0, 120)}"`);
    console.log(`  eventos=${JSON.stringify(r.eventos.slice(0, 8))} errores=${JSON.stringify(r.errores)}`);
  }
}

principal().catch((e) => {
  console.error("FALLO:", e.message);
  process.exit(1);
});
