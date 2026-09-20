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

export const electricistaDomainAdapter: Voice360DomainAdapter = {
  domainName: "electricista",

  normalizeInput(input: string) {
    const keys = Object.keys(ELECTRIC_SYNONYMS).sort((a, b) => b.length - a.length);
    const pattern = new RegExp(`\\b(${keys.join("|")})\\b`, "gi");
    return input.replace(pattern, (match) => ELECTRIC_SYNONYMS[match.toLowerCase()] ?? match);
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
