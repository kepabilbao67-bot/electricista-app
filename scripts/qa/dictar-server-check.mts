/**
 * ELECTRICISTA360 — QA DEL DICTADO (1/2): ENDPOINT REAL DE TRANSCRIPCIÓN
 *
 * Comprueba, contra el servidor de desarrollo REAL y con AUDIO REAL:
 *   1. genera la frase obligatoria en voz con el TTS (audio de verdad, no ruido);
 *   2. inicia sesión como el usuario local de desarrollo;
 *   3. manda el audio a POST /api/asistente/transcribe (la ruta del fallback);
 *   4. imprime el TEXTO reconocido y el código HTTP.
 *
 * Las credenciales NO están en este fichero: se leen de `.env.local`, que está
 * ignorado por git. Aquí no se imprime ninguna clave ni contraseña.
 *
 * Uso: npx tsx scripts/qa/dictar-server-check.mts
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const RAIZ = process.cwd();
const BASE = process.env.E360_QA_BASE ?? "http://127.0.0.1:3110";
const FRASE = "Quiero un presupuesto para un enchufe, dos interruptores y dos horas de mano de obra";

function claveGemini(): string | null {
  if (process.env.GEMINI_API_KEY?.trim()) return process.env.GEMINI_API_KEY.trim();
  try {
    const env = readFileSync(join(RAIZ, ".env.local"), "utf8");
    const linea = env.split(/\r?\n/).find((l) => /^\s*GEMINI_API_KEY\s*=/.test(l));
    return linea ? linea.replace(/^\s*GEMINI_API_KEY\s*=\s*/, "").trim().replace(/^["']|["']$/g, "") : null;
  } catch {
    return null;
  }
}

/** Credenciales del usuario local de desarrollo, leídas de `.env.local`. */
function credencialesLocales(): { email: string; password: string } | null {
  try {
    const env = readFileSync(join(RAIZ, ".env.local"), "utf8");
    const correo = /correo\s*:\s*(\S+)/.exec(env.split(/OBSOLETO/)[1] ?? env);
    const clave = /contrasena\s*:\s*(\S+)/.exec(env.split(/OBSOLETO/)[1] ?? env);
    if (!correo || !clave) return null;
    return { email: correo[1], password: clave[1] };
  } catch {
    return null;
  }
}

/** Escribe un WAV PCM 16 bits a partir de muestras Int16. */
function wav(int16: Int16Array, rate: number): Buffer {
  const datos = Buffer.alloc(int16.length * 2);
  for (let i = 0; i < int16.length; i += 1) datos.writeInt16LE(int16[i], i * 2);
  const cabecera = Buffer.alloc(44);
  cabecera.write("RIFF", 0);
  cabecera.writeUInt32LE(36 + datos.length, 4);
  cabecera.write("WAVE", 8);
  cabecera.write("fmt ", 12);
  cabecera.writeUInt32LE(16, 16);
  cabecera.writeUInt16LE(1, 20);
  cabecera.writeUInt16LE(1, 22);
  cabecera.writeUInt32LE(rate, 24);
  cabecera.writeUInt32LE(rate * 2, 28);
  cabecera.writeUInt16LE(2, 32);
  cabecera.writeUInt16LE(16, 34);
  cabecera.write("data", 36);
  cabecera.writeUInt32LE(datos.length, 40);
  return Buffer.concat([cabecera, datos]);
}

function remuestrear(muestras: Int16Array, origen: number, destino: number): Int16Array {
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

async function sintetizar(texto: string, apiKey: string): Promise<Int16Array> {
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: texto }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } } },
        },
      }),
    }
  );
  if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }>;
  };
  const datos = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
  if (!datos) throw new Error("TTS sin audio");
  const bytes = Buffer.from(datos, "base64");
  const copia = Buffer.alloc(Math.floor(bytes.length / 2) * 2);
  bytes.copy(copia, 0, 0, copia.length);
  return new Int16Array(copia.buffer, copia.byteOffset, copia.length / 2);
}

async function principal() {
  const apiKey = claveGemini();
  if (!apiKey) throw new Error("No hay GEMINI_API_KEY en el entorno ni en .env.local");

  console.log(`[1/4] Sintetizando la frase obligatoria…`);
  const pcm24 = await sintetizar(FRASE, apiKey);
  const pcm48 = remuestrear(pcm24, 24000, 48000);

  const dirQa = join(tmpdir(), "e360-qa");
  const { mkdirSync } = await import("node:fs");
  mkdirSync(dirQa, { recursive: true });

  // Audio de la frase + cola de silencio (como cuando el usuario termina de hablar).
  const conCola = new Int16Array(pcm48.length + 48000);
  conCola.set(pcm48, 0);
  const rutaFrase = join(dirQa, "frase.wav");
  writeFileSync(rutaFrase, wav(conCola, 48000));

  const rutaSilencio = join(dirQa, "silencio.wav");
  writeFileSync(rutaSilencio, wav(new Int16Array(48000 * 3), 48000));

  let suma = 0;
  for (let i = 0; i < pcm48.length; i += 1) suma += pcm48[i] * pcm48[i];
  const rms = Math.sqrt(suma / pcm48.length) / 32768;
  console.log(
    `      frase: ${(pcm48.length / 48000).toFixed(2)} s @48 kHz · RMS=${rms.toFixed(4)} · ${rutaFrase}`
  );
  console.log(`      silencio: 3 s · ${rutaSilencio}`);

  const cred = credencialesLocales();
  if (!cred) throw new Error("No se han podido leer las credenciales locales de .env.local");

  console.log(`[2/4] Login en ${BASE}…`);
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cred),
  });
  if (!login.ok) throw new Error(`Login HTTP ${login.status}`);
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
  console.log(`      sesión OK`);

  console.log(`[3/4] POST /api/asistente/transcribe con la VOZ real…`);
  // Se sube el WAV COMPLETO (con cabecera): es lo que aceptan los dos proveedores
  // y lo que enviará el navegador tras grabar.
  const wavBytes = wav(conCola, 48000);
  const form = new FormData();
  form.append(
    "audio",
    new File([new Uint8Array(wavBytes)], "dictado.wav", { type: "audio/wav" })
  );
  const res = await fetch(`${BASE}/api/asistente/transcribe`, {
    method: "POST",
    headers: { cookie },
    body: form,
  });
  const cuerpo = (await res.json().catch(() => ({}))) as { text?: string; error?: string; provider?: string };
  console.log(`      HTTP ${res.status} · provider=${cuerpo.provider ?? "-"}`);
  console.log(`[4/4] TEXTO: ${cuerpo.text ?? `(sin texto: ${cuerpo.error})`}`);

  const normal = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ");
  const esperado = normal(FRASE).replace(/\s+/g, " ").trim();
  const obtenido = normal(cuerpo.text ?? "").replace(/\s+/g, " ").trim();
  const encontrado = obtenido.includes(esperado);
  console.log(`\nFRASE_COMPLETA: ${encontrado ? "PASS" : "FAIL"}`);
  console.log(`ultimas_palabras ("mano de obra"): ${obtenido.includes("mano de obra") ? "PASS" : "FAIL"}`);
  process.exit(encontrado ? 0 : 1);
}

principal().catch((e) => {
  console.error("FALLO:", e.message);
  process.exit(1);
});
