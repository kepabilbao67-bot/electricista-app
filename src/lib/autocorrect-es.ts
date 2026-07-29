/**
 * Autocorrección suave en español.
 * Corrige errores frecuentes al finalizar una palabra (espacio, punto, coma, blur).
 * No envía texto a servicios externos. No usa IA. Solo diccionario local.
 */

const CORRECTIONS: Record<string, string> = {
  qe: "que",
  q: "que",
  k: "que",
  xq: "porque",
  pq: "porque",
  porq: "porque",
  aver: "a ver",
  aber: "a ver",
  ai: "hay",
  ay: "hay",
  ahi: "ahí",
  alli: "allí",
  aqui: "aquí",
  tambien: "también",
  instalacion: "instalación",
  electrico: "eléctrico",
  electrica: "eléctrica",
  electricas: "eléctricas",
  revision: "revisión",
  conexion: "conexión",
  conexiones: "conexiones",
  habitacion: "habitación",
  habitaciones: "habitaciones",
  magnetotermico: "magnetotérmico",
  automatico: "automático",
  telefono: "teléfono",
  direccion: "dirección",
  observacion: "observación",
  observaciones: "observaciones",
  averia: "avería",
  averias: "averías",
  lampara: "lámpara",
  lamparas: "lámparas",
  // --- Errores reales detectados en pruebas de usuario ---
  ola: "hola",
  escrutor: "electricista",
  escritor: "electricista",
  electricita: "electricista",
  eletricista: "electricista",
  electrecista: "electricista",
  abiytdcion: "habitación",
  abitacion: "habitación",
  abytacion: "habitación",
  abytadcion: "habitación",
  avytacion: "habitación",
  npbelo: "pueblo",
  puebelo: "pueblo",
  pubelo: "pueblo",
  puevlo: "pueblo",
  istalacion: "instalación",
  instalaccion: "instalación",
  instalasion: "instalación",
  instalazion: "instalación",
  intalacion: "instalación",
  eletrica: "eléctrica",
  eletrika: "eléctrica",
  corrientee: "corriente",
  mecanizmo: "mecanismo",
  mecanizmos: "mecanismos",
  proteccion: "protección",
  revisiones: "revisiones",
  automaticos: "automáticos",
  diferenciall: "diferencial",
  magneto: "magnetotérmico",
  magnetotermicos: "magnetotérmicos",
};

/** Patterns that should NOT be corrected */
function isProtected(word: string): boolean {
  // Emails, URLs, numbers, codes, all-caps
  if (/[@:/]/.test(word)) return true;
  if (/^\d/.test(word)) return true;
  if (/^[A-Z0-9_-]+$/.test(word)) return true;
  if (/^\d+([.,]\d+)?$/.test(word)) return true;
  return false;
}

function correctWord(word: string): string {
  if (!word || isProtected(word)) return word;

  const lower = word.toLowerCase();
  const replacement = CORRECTIONS[lower];
  if (!replacement) return word;

  // Preserve initial capital
  if (word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/**
 * Corrects complete text (all words).
 * Use on blur or when the full text needs correction.
 */
export function autocorrectSpanishText(text: string): string {
  if (!text) return text;
  return text.replace(/\S+/g, (match) => correctWord(match));
}

/**
 * Corrects only completed words (before the last boundary character).
 * The last word being typed is NOT corrected — only words followed by
 * a space, comma, period, semicolon or newline.
 */
export function autocorrectSpanishOnBoundary(text: string): string {
  if (!text) return text;

  // Split at the last boundary (space, comma, period, newline)
  const lastBoundary = Math.max(
    text.lastIndexOf(" "),
    text.lastIndexOf(","),
    text.lastIndexOf("."),
    text.lastIndexOf(";"),
    text.lastIndexOf("\n")
  );

  if (lastBoundary <= 0) return text;

  const completed = text.slice(0, lastBoundary + 1);
  const current = text.slice(lastBoundary + 1);

  const corrected = completed.replace(/\S+/g, (match) => correctWord(match));
  return corrected + current;
}
