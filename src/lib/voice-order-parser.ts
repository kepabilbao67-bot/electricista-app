export interface VoiceOrderItem {
  product: string;
  quantity: number;
  unit: string;
  observations: string;
}

export interface VoiceOrderDraft {
  originalText: string;
  items: VoiceOrderItem[];
  neededDate: string | null;
  neededDateLabel: string;
  status: "pending_confirmation";
}

const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  veinte: 20,
};

const UNIT_ALIASES: Record<string, string> = {
  caja: "cajas",
  cajas: "cajas",
  metro: "m",
  metros: "m",
  m: "m",
  unidad: "uds",
  unidades: "uds",
  ud: "uds",
  uds: "uds",
  rollo: "rollos",
  rollos: "rollos",
  paquete: "paquetes",
  paquetes: "paquetes",
  bobina: "bobinas",
  bobinas: "bobinas",
};

function localIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function extractNeededDate(text: string, now: Date): { text: string; date: string | null; label: string } {
  const lower = text.toLocaleLowerCase("es");
  const relativeDates: Array<[RegExp, number, string]> = [
    [/\bpasado\s+mañana\b/i, 2, "pasado mañana"],
    [/\bmañana\b/i, 1, "mañana"],
    [/\bhoy\b/i, 0, "hoy"],
  ];

  for (const [pattern, offset, label] of relativeDates) {
    if (pattern.test(lower)) {
      const date = new Date(now);
      date.setDate(date.getDate() + offset);
      return {
        text: text.replace(new RegExp(`\\s*(?:para|el|antes de)?\\s*${pattern.source}[.!]?\\s*$`, "i"), "").trim(),
        date: localIsoDate(date),
        label,
      };
    }
  }

  const isoMatch = lower.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    return {
      text: text.replace(/\s*(?:para|el)?\s*20\d{2}-\d{2}-\d{2}[.!]?\s*$/i, "").trim(),
      date: isoMatch[0],
      label: isoMatch[0],
    };
  }

  return { text: text.trim(), date: null, label: "Sin fecha" };
}

function numberValue(raw: string): number | null {
  const normalized = raw.toLocaleLowerCase("es");
  if (NUMBER_WORDS[normalized] !== undefined) return NUMBER_WORDS[normalized];
  const numeric = Number(normalized.replace(",", "."));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function cleanProduct(value: string): string {
  const cleaned = value
    .replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, "")
    .replace(/\bde\s+(?=guantes?|cables?|diferenciales?|magnetot[eé]rmicos?|enchufes?|tubos?|bridas?|tornillos?)/i, "")
    .replace(/\bcables?\s+de\s+(\d+(?:[.,]\d+)?)\b/gi, (match) => `${match.replace(/\s+de\s+/i, " ")} mm²`)
    .replace(/\b(diferenciales?|magnetot[eé]rmicos?)\s+de\s+(?=\d)/gi, "$1 ")
    .replace(/\bde\s+(\d+(?:[.,]\d+)?)\s*(?:mil[ií]metros?\s*cuadrados?|mm(?:2|²))\b/gi, "$1 mm²")
    .replace(/\b(\d+(?:[.,]\d+)?)\s+amperios?\b/gi, "$1 A")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned ? cleaned.charAt(0).toLocaleUpperCase("es") + cleaned.slice(1) : "Producto sin identificar";
}

/**
 * Divide una locución en partidas.
 *
 * El separador solo corta cuando le sigue una CANTIDAD nueva ("... y dos horas
 * ..."), de modo que "tubo de PVC y cobre" sigue siendo una sola partida.
 *
 * Se exporta porque el motor de Voz 360 lo reutiliza para los presupuestos: es
 * la misma segmentación, no una lógica paralela.
 */
/**
 * Decenas que forman NÚMEROS COMPUESTOS con "y" ("treinta y cinco", "cuarenta y
 * cinco"). El separador de partidas corta ante "\by\b" seguido de una cantidad,
 * así que sin esta guarda partía el propio número por la mitad:
 *
 *   "treinta y cinco metros de cable a dos euros"
 *      -> ["treinta", "cinco metros de cable a dos euros"]
 *
 * y la partida salía con cantidad 5 en vez de 35. No es un error de formato: el
 * importe equivocado llegaba a GUARDARSE (menos de una novena parte de lo
 * dictado). Por eso el "y" de un compuesto nunca puede ser un separador.
 */
const DECENAS_COMPUESTAS = "treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa";

export function splitItemSegments(text: string): string[] {
  const quantity =
    "(?:\\d+(?:[.,]\\d+)?|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|" +
    "dieciseis|diecis[eé]is|diecisiete|dieciocho|diecinueve|veinte|veintiuno|veintiun|veintiuna|veintidos|veintid[oó]s|" +
    "veintitres|veintitr[eé]s|veinticuatro|veinticinco|veintiseis|veintis[eé]is|veintisiete|veintiocho|veintinueve|" +
    "treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien)";
  // El lookbehind negativo retira el "y" que pertenece a una decena compuesta.
  const separator = new RegExp(
    `\\s*(?:,\\s+|;\\s*|(?<!\\b(?:${DECENAS_COMPUESTAS})\\s)\\by\\b)\\s*(?=${quantity}\\b)`,
    "gi"
  );
  return text
    .replace(/^(?:necesito|quiero|pide|pedir|añade|agrega|hace falta|me hacen falta)\s+/i, "")
    .split(separator)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseItem(segment: string): VoiceOrderItem | null {
  const match = segment.match(
    /^(\d+(?:[.,]\d+)?|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte)\s+(?:(cajas?|metros?|m|unidades?|uds?|rollos?|paquetes?|bobinas?)\b\s*)?(?:de\s+)?(.+)$/i
  );
  if (!match) return null;

  const quantity = numberValue(match[1]);
  if (!quantity) return null;

  const rawUnit = match[2]?.toLocaleLowerCase("es") || "uds";
  return {
    quantity,
    unit: UNIT_ALIASES[rawUnit] || rawUnit,
    product: cleanProduct(match[3]),
    observations: "",
  };
}

export function parseVoiceOrder(input: string, now = new Date()): VoiceOrderDraft {
  const originalText = input.trim();
  if (!originalText) throw new Error("El pedido está vacío");

  const dated = extractNeededDate(originalText, now);
  const items = splitItemSegments(dated.text)
    .map(parseItem)
    .filter((item): item is VoiceOrderItem => item !== null);

  if (items.length === 0) {
    throw new Error("No se han podido identificar productos y cantidades");
  }

  return {
    originalText,
    items,
    neededDate: dated.date,
    neededDateLabel: dated.label,
    status: "pending_confirmation",
  };
}
