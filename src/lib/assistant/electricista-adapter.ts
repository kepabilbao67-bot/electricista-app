import type { Voice360DomainAdapter, Voice360ProcessResult } from "./types";
import { SOKOEL_CATALOG_ITEMS } from "@/lib/sokoel-catalog";

const ELECTRIC_SYNONYMS: Record<string, string> = {
  "magnetos": "magnetotérmicos",
  "magneto": "magnetotérmico",
  "difes": "interruptores diferenciales",
  "dife": "interruptor diferencial",
  "diferenciales": "interruptores diferenciales",
  "diferencial": "interruptor diferencial",
  "mangueras": "cables manguera",
  "manguera": "cable manguera",
  "tubos": "tubos corrugados",
  "tubo": "tubo corrugado",
  "enchufes": "bases de enchufe",
  "enchufe": "base de enchufe",
  "pias": "magnetotérmicos",
  "pia": "magnetotérmico",
  "cuadros": "cuadros de distribución eléctrica",
  "cuadro": "cuadro de distribución eléctrica",
  "focos led": "downlight led empotrable",
  "foco led": "downlight led empotrable",
};

/** Escapa un literal para poder usarlo dentro de un RegExp. */
const escaparRegex = (texto: string): string => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Palabra que casa con o SIN tilde.
 *
 * El dictado llega a menudo sin acentos ("distribucion" en vez de "distribución"),
 * así que la guarda tiene que ser tolerante o no reconocería su propia forma
 * canónica y volvería a expandir.
 */
const VOCAL_FLEXIBLE: Record<string, string> = {
  a: "[aá]", e: "[eé]", i: "[ií]", o: "[oó]", u: "[uú]",
};
const flexible = (palabra: string): string =>
  escaparRegex(palabra).replace(/[aeiou]/gi, (c) => VOCAL_FLEXIBLE[c.toLowerCase()]);

/** Palabra flexible y con plural opcional: "base" -> "bases?". */
const palabraFlexible = (palabra: string): string =>
  palabra.endsWith("s") ? flexible(palabra) : `${flexible(palabra)}(?:es|s)?`;

/** Artículos y preposiciones que puede llevar delante un sufijo. */
const NEXO = "(?:(?:de|del|la|el|los|las)\\s+)*";

/**
 * Construye el patrón de UN sinónimo, con las guardas que evitan la DOBLE EXPANSIÓN.
 *
 * EL FALLO QUE ESTO CORRIGE (visible para el cliente)
 * `normalizeInput` reescribía la clave aunque el texto YA dijera la forma
 * canónica, porque `\benchufe\b` también casa dentro de "bases de enchufe":
 *
 *   "hazme un presupuesto de seis bases de enchufe a dieciocho euros"
 *     -> "seis bases de base de enchufe ..."
 *
 * Esa descripción se guarda en `budget_items` y sale IMPRESA en el presupuesto,
 * así que el cliente leía "Bases de base de enchufe". Lo mismo ocurría con
 * "tubos corrugados" -> "tubos corrugados corrugados" o "cable manguera" ->
 * "cable cable manguera". La función no era idempotente ni en la primera pasada.
 *
 * La guarda se deduce del propio valor canónico:
 *  - si AÑADE un SUFIJO ("tubos" -> "tubos corrugados"), se comprueba DESPUÉS de
 *    la clave con un lookahead (ponerlo antes no casaría nunca, porque el
 *    lookahead se evalúa en la posición donde empieza la clave);
 *  - si AÑADE un PREFIJO ("enchufe" -> "base de enchufe"), se comprueba ANTES con
 *    un lookbehind.
 * Ambas toleran plural y falta de tildes.
 */
function construirPatronSinonimo(clave: string, canonico: string): RegExp {
  const k = clave.toLowerCase();
  const v = canonico.toLowerCase();
  const singular = k.endsWith("s") ? k.slice(0, -1) : k;

  let antes = "";
  let despues = "";

  // ¿La forma canónica empieza por la clave? -> añade SUFIJO.
  if (v.startsWith(k) && v.length > k.length) {
    const primera = v.slice(k.length).trim().split(/\s+/)[0];
    if (primera) despues = `(?!\\s+${NEXO}${palabraFlexible(primera)}\\b)`;
  }

  // ¿La forma canónica termina por la clave (o su singular)? -> añade PREFIJO.
  const prefijo = v.endsWith(k)
    ? v.slice(0, v.length - k.length).trim()
    : v.endsWith(singular)
      ? v.slice(0, v.length - singular.length).trim()
      : "";
  if (prefijo) {
    const mirarAtras = prefijo.split(/\s+/).map(palabraFlexible).join("\\s+");
    antes = `(?<!${mirarAtras}\\s+)`;
  }

  // Si la forma canónica NO es una extensión de la clave, no hay prefijo ni sufijo
  // que deducir ("foco led" -> "downlight led empotrable"). La guarda se ancla
  // entonces a su última palabra distintiva: si el texto ya dice "empotrable"
  // detrás, ya está en forma canónica y no se toca. Sin esto salía
  // "downlight led empotrable empotrable".
  if (!antes && !despues) {
    const ultima = v.split(/\s+/).pop() ?? "";
    if (ultima && ultima !== k && ultima !== singular) {
      despues = `(?!\\s+${NEXO}${palabraFlexible(ultima)}\\b)`;
    }
  }

  return new RegExp(`${antes}\\b(${escaparRegex(clave)})\\b${despues}`, "gi");
}

/** Patrones precalculados: claves largas primero para que "focos led" gane a "led". */
const PATRONES_SINONIMO: Array<{ patron: RegExp; canonico: string }> = Object.entries(ELECTRIC_SYNONYMS)
  .sort(([a], [b]) => b.length - a.length)
  .map(([clave, canonico]) => ({
    patron: construirPatronSinonimo(clave, canonico),
    canonico,
  }));

export const electricistaDomainAdapter: Voice360DomainAdapter = {
  domainName: "electricista",

  normalizeInput(input: string) {
    let salida = input;
    for (const { patron, canonico } of PATRONES_SINONIMO) {
      salida = salida.replace(patron, canonico);
    }
    return salida;
  },

  async enrichContext(tenantId: string, input: string) {
    const isSupplierIntent = /sokoel|distribuidor|pedido|albaran/i.test(input);
    return {
      vertical: "electricista",
      supplierCatalogAvailable: true,
      supplierName: "SOKOEL",
      isSupplierIntent,
      tenantId,
    };
  },

  async resolveCatalogItem(query: string, tenantId: string) {
    const q = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (!q) return null;

    const stopWords = new Set(['para', 'con', 'sin', 'del', 'los', 'las', 'unos', 'unas', 'bases', 'base', 'el', 'la', 'un', 'una', 'de']);
    const words = q.split(/\s+/).filter(w => w.length >= 3 && !stopWords.has(w));

    const matches = SOKOEL_CATALOG_ITEMS.filter((item) => {
      const nameNorm = item.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const descNorm = item.description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const refNorm = item.reference.toLowerCase();

      if (nameNorm.includes(q) || descNorm.includes(q) || refNorm.includes(q) || q.includes(refNorm)) {
        return true;
      }
      return words.some(w => nameNorm.includes(w) || descNorm.includes(w) || refNorm.includes(w));
    });

    if (matches.length === 0) return null;

    return matches.slice(0, 5).map((item) => {
      const margin = 0.30;
      const sellingPrice = Math.round((item.costPrice / (1 - margin)) * 100) / 100;
      return {
        id: item.id,
        name: item.name,
        unit_price: sellingPrice,
        unit: "unidad",
        category: item.category,
        supplier_reference: item.reference,
      };
    });
  },

  async postProcessResult(result: Voice360ProcessResult) {
    return {
      ...result,
      intent: result.intent ? "electricista:" + result.intent : "electricista:general",
    };
  },
};
