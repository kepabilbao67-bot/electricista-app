export interface FaltanteItem {
  product: string;
  quantity: number;
  unit: "m" | "ud" | "rollo" | "caja";
}

const NUMBERS: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  trece: 13, catorce: 14, quince: 15, dieciseis: 16, "dieciséis": 16,
  diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20,
  veintiuno: 21, veintiun: 21, veintiuna: 21, veintidos: 22, "veintidós": 22,
  veintitres: 23, "veintitrés": 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, "veintiséis": 26, veintisiete: 27, veintiocho: 28,
  veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50,
  sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100,
};

function parseQuantity(raw: string): number | null {
  const normalized = raw.toLocaleLowerCase("es").trim();
  if (NUMBERS[normalized] !== undefined) return NUMBERS[normalized];

  const compound = normalized.match(/^([a-záéíóú]+)\s+y\s+([a-záéíóú]+)$/);
  if (compound) {
    const tens = NUMBERS[compound[1]];
    const units = NUMBERS[compound[2]];
    if (tens !== undefined && units !== undefined && tens >= 20 && units < 10) {
      return tens + units;
    }
  }

  const numeric = Number(normalized.replace(",", "."));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function singularize(value: string): string {
  const trimmed = value
    .replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, "")
    .replace(/^(?:de|del)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const key = trimmed.toLocaleLowerCase("es");
  const common: Record<string, string> = {
    cajas: "Caja",
    caja: "Caja",
    tornillos: "Tornillo",
    tornillo: "Tornillo",
    enchufes: "Enchufe",
    enchufe: "Enchufe",
    cables: "Cable",
    cable: "Cable",
    diferenciales: "Diferencial",
    diferencial: "Diferencial",
    magnetotermicos: "Magnetotérmico",
    "magnetotérmicos": "Magnetotérmico",
    magnetotermico: "Magnetotérmico",
    "magnetotérmico": "Magnetotérmico",
    tubos: "Tubo",
    tubo: "Tubo",
    bridas: "Brida",
    brida: "Brida",
    silicona: "Silicona",
  };
  if (common[key]) return common[key];
  return trimmed ? trimmed.charAt(0).toLocaleUpperCase("es") + trimmed.slice(1) : "Material";
}

function stripLead(text: string): string {
  return text
    .trim()
    .replace(/[.!?]+$/g, "")
    .replace(/^apunta\s+que\s+para\s+este\s+trabajo\s+me\s+faltan\s+/i, "")
    .replace(/^para\s+este\s+trabajo\s+me\s+faltan\s+/i, "")
    .replace(/^apunta\s+que\s+me\s+faltan\s+/i, "")
    .replace(/^me\s+faltan\s+/i, "")
    .replace(/^necesito\s+/i, "")
    .trim();
}

const QTY_PATTERN =
  "(?:\\d+(?:[.,]\\d+)?|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|dieciséis|diecisiete|dieciocho|diecinueve|veinte|veintiuno|veintiun|veintiuna|veintidos|veintidós|veintitres|veintitrés|veinticuatro|veinticinco|veintiseis|veintiséis|veintisiete|veintiocho|veintinueve|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien)";

function splitItems(text: string): string[] {
  const primary = text.split(/\s*,\s*|\s*;\s*/).map((s) => s.trim()).filter(Boolean);
  const result: string[] = [];

  for (const segment of primary) {
    const parts = segment
      .split(new RegExp(`\\s+y\\s+(?=(?:${QTY_PATTERN})\\b)`, "i"))
      .map((s) => s.trim())
      .filter(Boolean);

    for (const part of parts) {
      const trailing = part.match(new RegExp(`^((?:${QTY_PATTERN})\\b.+?)\\s+y\\s+([a-záéíóúñ][a-záéíóúñ0-9 .²/-]*)$`, "i"));
      if (trailing && !new RegExp(`^(?:${QTY_PATTERN})\\b`, "i").test(trailing[2].trim())) {
        result.push(trailing[1].trim(), trailing[2].trim());
      } else {
        result.push(part);
      }
    }
  }

  return result;
}

function parseSegment(segment: string): FaltanteItem | null {
  const trimmed = segment.trim();
  if (!trimmed) return null;

  const withMeters = trimmed.match(new RegExp(`^(${QTY_PATTERN})\\s+(?:metros?|m)\\b\\s*(?:de\\s+)?(.+)$`, "i"));
  if (withMeters) {
    const quantity = parseQuantity(withMeters[1]);
    if (!quantity) return null;
    return { product: singularize(withMeters[2]), quantity, unit: "m" };
  }

  const withUnits = trimmed.match(new RegExp(`^(${QTY_PATTERN})\\s+(?:unidades?|uds?|ud)\\b\\s*(?:de\\s+)?(.+)$`, "i"));
  if (withUnits) {
    const quantity = parseQuantity(withUnits[1]);
    if (!quantity) return null;
    return { product: singularize(withUnits[2]), quantity, unit: "ud" };
  }

  const withRoll = trimmed.match(new RegExp(`^(${QTY_PATTERN})\\s+(?:rollos?)\\b\\s*(?:de\\s+)?(.+)$`, "i"));
  if (withRoll) {
    const quantity = parseQuantity(withRoll[1]);
    if (!quantity) return null;
    return { product: singularize(withRoll[2]), quantity, unit: "rollo" };
  }

  const generic = trimmed.match(new RegExp(`^(${QTY_PATTERN})\\s+(.+)$`, "i"));
  if (generic) {
    const quantity = parseQuantity(generic[1]);
    if (!quantity) return null;
    return { product: singularize(generic[2]), quantity, unit: "ud" };
  }

  return { product: singularize(trimmed), quantity: 1, unit: "ud" };
}

export function parseFaltantes(input: string): FaltanteItem[] {
  const stripped = stripLead(input);
  const items = splitItems(stripped).map(parseSegment).filter((item): item is FaltanteItem => Boolean(item));

  if (items.length === 0) throw new Error("No se han podido identificar materiales");

  const compact = new Map<string, FaltanteItem>();
  for (const item of items) {
    const key = `${item.product.toLocaleLowerCase("es")}|${item.unit}`;
    const existing = compact.get(key);
    if (existing) existing.quantity += item.quantity;
    else compact.set(key, { ...item });
  }
  return [...compact.values()];
}

export function parseConseguidos(input: string): string[] {
  const stripped = input
    .trim()
    .replace(/[.!?]+$/g, "")
    .replace(/^ya\s+tengo\s+/i, "")
    .replace(/^ya\s+he\s+conseguido\s+/i, "")
    .replace(/^marca\s+como\s+conseguido?s?\s+/i, "")
    .trim();

  return stripped
    .split(/\s*,\s*|\s+y\s+/i)
    .map((item) => singularize(item.replace(/^(?:los|las|el|la|unos|unas)\s+/i, "")))
    .filter(Boolean);
}
