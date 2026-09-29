/**
 * SONDA: ¿QUÉ MODELO PUEDE TRANSCRIBIR EL AUDIO REAL?
 *
 * El modelo por defecto del dictado (`gemini-3.5-transcribe`) agotó su cuota
 * gratuita y responde 429 SIEMPRE. Como la cuota es POR MODELO, esta sonda lista
 * los modelos disponibles y prueba a transcribir el WAV real del dictado con unos
 * pocos candidatos, imprimiendo SOLO el código HTTP y el texto reconocido.
 *
 * No imprime ninguna clave.
 *
 * Uso: npx tsx scripts/qa/dbg-modelos-stt.mts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const env = readFileSync(".env.local", "utf8");
const key = env
  .split(/\r?\n/)
  .find((l) => /^\s*GEMINI_API_KEY\s*=/.test(l))!
  .replace(/^\s*GEMINI_API_KEY\s*=\s*/, "")
  .trim()
  .replace(/^["']|["']$/g, "");

const wav = readFileSync(join(tmpdir(), "e360-qa", "frase.wav"));

console.log("=== MODELOS DISPONIBLES (generateContent) ===");
const lista = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
  headers: { "x-goog-api-key": key },
});
console.log(`GET /models → HTTP ${lista.status}`);
const modelos: string[] = [];
if (lista.ok) {
  const json = (await lista.json()) as {
    models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
  };
  for (const m of json.models ?? []) {
    if ((m.supportedGenerationMethods ?? []).includes("generateContent")) {
      modelos.push(String(m.name ?? "").replace(/^models\//, ""));
    }
  }
  console.log(modelos.join("\n"));
} else {
  console.log((await lista.text()).slice(0, 300));
}

/** Candidatos: los que pueden transcribir audio. Se prueban pocos (gastan cuota). */
const candidatos = [
  process.env.E360_CANDIDATO ?? "gemini-3.5-transcribe",
  "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemini-flash-latest",
].filter((m) => modelos.length === 0 || modelos.includes(m) || m === process.env.E360_CANDIDATO);

console.log("\n=== PRUEBA DE TRANSCRIPCIÓN DEL AUDIO REAL ===");
for (const modelo of candidatos) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text:
                  "Transcribe literalmente el audio en español. Devuelve SOLO la transcripción, " +
                  "sin comillas, sin comentarios y sin puntuación añadida.",
              },
              { inlineData: { mimeType: "audio/wav", data: wav.toString("base64") } },
            ],
          },
        ],
      }),
    }
  );
  const texto = await res.text();
  const corto = texto.replace(/\s+/g, " ").slice(0, 200);
  console.log(`--- ${modelo}: HTTP ${res.status} · ${corto}`);
}
