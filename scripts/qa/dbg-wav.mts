import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const bytes = readFileSync(join(tmpdir(), "e360-qa", "frase.wav"));
console.log("len", bytes.length, "cabecera:", bytes.toString("ascii", 0, 4), bytes.toString("ascii", 8, 12));
console.log("chunk0:", bytes.toString("ascii", 12, 16), "size", bytes.readUInt32LE(16));
console.log("rate", bytes.readUInt32LE(24));
console.log("chunk1:", bytes.toString("ascii", 36, 40), "size", bytes.readUInt32LE(40));

// Réplica exacta del parser de la ruta
function pcmDeWav(bytes: Buffer) {
  if (bytes.length < 44) return null;
  if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE") return null;
  let rate = 0;
  let desplazamiento = 12;
  while (desplazamiento + 8 <= bytes.length) {
    const id = bytes.toString("ascii", desplazamiento, desplazamiento + 4);
    const tamano = bytes.readUInt32LE(desplazamiento + 4);
    const inicio = desplazamiento + 8;
    if (id === "fmt " && inicio + 16 <= bytes.length) rate = bytes.readUInt32LE(inicio + 4);
    if (id === "data") {
      const fin = Math.min(inicio + tamano, bytes.length);
      if (fin <= inicio || rate <= 0) return null;
      return { pcm: bytes.subarray(inicio, fin), rate };
    }
    desplazamiento = inicio + tamano + (tamano % 2);
  }
  return null;
}
const r = pcmDeWav(bytes);
console.log("pcmDeWav:", r ? `OK ${r.pcm.length} bytes @${r.rate}` : "NULL");
