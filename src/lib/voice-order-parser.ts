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

/** Unidades y decenas sueltas: "cinco", "veinte", "treinta". */
const UNIDADES_HASTA_VEINTINUEVE =
  "\\d+(?:[.,]\\d+)?|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|" +
  "dieciseis|diecis[eé]is|diecisiete|dieciocho|diecinueve|veinte|veintiuno|veintiun|veintiuna|veintidos|veintid[oó]s|" +
  "veintitres|veintitr[eé]s|veinticuatro|veinticinco|veintiseis|veintis[eé]is|veintisiete|veintiocho|veintinueve";

/** Decenas que pueden formar un compuesto con "y": "treinta y cinco". */
const DECENAS_COMPUESTAS = "treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa";

/** Unidades que pueden cerrar un compuesto con "y". */
const UNIDADES_COMPUESTAS = "un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve";

/**
 * Cantidades que puede reconocer el parser, como fragmento de regex.
 *
 * Se declara UNA sola vez y se reutiliza en la segmentación (`splitItemSegments`)
 * y en el parseo de cada partida (`parseItem`). Antes cada punto tenía su propia
 * lista y estaban desalineadas: la segmentación reconocía "dieciseis", "treinta"
 * o "cien" como cantidad (y por tanto cortaba ahí), pero `parseItem` no los
 * reconocía como cantidad inicial, así que la partida se descartaba en silencio.
 *
 * El compuesto ("treinta y cinco") va PRIMERO para que gane sobre "treinta" a
 * secas: si no, la cantidad salía 30 y el "y cinco" se colaba como artículo.
 */
const NUMBER_PATTERN =
  `(?:${DECENAS_COMPUESTAS})\\s+y\\s+(?:${UNIDADES_COMPUESTAS})|` +
  `${UNIDADES_HASTA_VEINTINUEVE}|cien`;

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
  dieciseis: 16,
  dieciséis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintiun: 21,
  veintiuna: 21,
  veintidos: 22,
  veintidós: 22,
  veintitres: 23,
  veintitrés: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintiséis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
  cien: 100,
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
  const normalized = raw.toLocaleLowerCase("es").trim();
  if (NUMBER_WORDS[normalized] !== undefined) return NUMBER_WORDS[normalized];

  // Compuestos con "y": "treinta y cinco" -> 35. La decena aporta las decenas y
  // la unidad las unidades; no se admiten compuestos del tipo "ciento cinco".
  const compuesto = normalized.match(/^([a-záéíóú]+)\s+y\s+([a-záéíóú]+)$/);
  if (compuesto) {
    const decena = NUMBER_WORDS[compuesto[1]];
    const unidad = NUMBER_WORDS[compuesto[2]];
    if (decena !== undefined && unidad !== undefined && decena >= 20 && unidad <= 9) {
      return decena + unidad;
    }
    return null;
  }

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
 * (`DECENAS_COMPUESTAS` se declara arriba, junto a `NUMBER_PATTERN`.)
 */

export function splitItemSegments(text: string): string[] {
  const quantity = `(?:${NUMBER_PATTERN})`;
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

/**
 * Patrón de una partida que EMPIEZA por cantidad:
 *   cantidad  [unidad]  [de]  producto
 */
const ITEM_PATTERN = new RegExp(
  `^(${NUMBER_PATTERN})\\s+(?:(cajas?|metros?|m|unidades?|uds?|rollos?|paquetes?|bobinas?)\\b\\s*)?(?:de\\s+)?(.+)$`,
  "i"
);

/**
 * Palabras que introducen una cantidad SIN ser un relleno, y que por tanto
 * impiden tratarla como cantidad de partida. No es una lista de rellenos: es lo
 * contrario, una guarda para no convertir en artículo algo que no lo es.
 *
 * Es el caso de "Necesito material para una obra": sin esta guarda, el "una" de
 * "para una obra" se leía como cantidad 1 y el parser devolvía una partida
 * inventada en lugar de rechazar el texto.
 */
const PALABRAS_QUE_INTRODUCEN = /^(?:y|e|o|u|más|mas|para|por|de|del|a|al|en|con|sin|sobre|entre)$/i;

/**
 * Cantidad suelta precedida de texto ("Me faltan 10", "Necesito material para").
 * El lookbehind descarta las palabras introductorias de arriba.
 */
const ITEM_PATTERN_CON_RELLENO = new RegExp(
  `^(.+?)\\s+(?<!\\b(?:y|e|o|u|más|mas|para|por|de|del|a|al|en|con|sin|sobre|entre)\\s)(?=(?:${NUMBER_PATTERN})\\b)`,
  "i"
);

/**
 * Extrae la partida de un segmento.
 *
 * El camino normal exige que la cantidad esté al INICIO (`^`). Si no lo está,
 * se prueba un respaldo que la busca precedida de texto, porque el relleno es
 * ilimitado y la lista cerrada de `splitItemSegments` no lo cubre todo:
 *
 *   "Me faltan 10 enchufes y 20 metros de cable" -> ["20 m Cable"]  (perdía 10 enchufes)
 *   "Me faltan 10 enchufes"                      -> excepción "No se han podido identificar..."
 *
 * El respaldo SOLO se usa cuando el anclaje en `^` ha fallado, así que las frases
 * que ya funcionaban conservan exactamente el mismo camino.
 */
function parseItem(segment: string): VoiceOrderItem | null {
  let match = segment.match(ITEM_PATTERN);

  if (!match) {
    const prefijo = segment.match(ITEM_PATTERN_CON_RELLENO);
    if (prefijo && !PALABRAS_QUE_INTRODUCEN.test(prefijo[1].trim())) {
      match = segment.slice(prefijo[1].length).trim().match(ITEM_PATTERN);
    }
  }

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
