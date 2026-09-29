import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const env = readFileSync(".env.local", "utf8");
const key = env.split(/\r?\n/).find((l) => /^\s*GEMINI_API_KEY\s*=/.test(l))!.replace(/^\s*GEMINI_API_KEY\s*=\s*/, "").trim().replace(/^["']|["']$/g, "");

const wav = readFileSync(join(tmpdir(), "e360-qa", "frase.wav"));
const pcm48 = wav.subarray(44);

function a16(pcm: Buffer, rate: number, destino: number) {
  const n = Math.floor(pcm.length / 2);
  const salida = Buffer.alloc(Math.floor((n * destino) / rate) * 2);
  const total = salida.length / 2;
  for (let i = 0; i < total; i += 1) {
    const pos = (i * rate) / destino;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, n - 1);
    const f = pos - i0;
    const a = pcm.readInt16LE(i0 * 2);
    const b = pcm.readInt16LE(i1 * 2);
    salida.writeInt16LE(Math.round(a * (1 - f) + b * f), i * 2);
  }
  return salida;
}

for (const [etiqueta, datos, mime] of [
  ["48k pcm", pcm48, "audio/pcm;rate=48000"],
  ["16k pcm", a16(pcm48, 48000, 16000), "audio/pcm;rate=16000"],
  ["wav", wav, "audio/wav"],
] as Array<[string, Buffer, string]>) {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-transcribe:generateContent", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ parts: [{ text: "Transcribe literalmente el audio en español." }, { inlineData: { mimeType: mime, data: datos.toString("base64") } }] }] }),
  });
  const cuerpo = await res.text();
  console.log(`--- ${etiqueta}: HTTP ${res.status} · ${cuerpo.slice(0, 220).replace(/\s+/g, " ")}`);
}
