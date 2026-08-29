/**
 * ELECTRICISTA360 — Configuración de la vertical "electricista"
 *
 * Implementa VerticalConfig con los catálogos, módulos y branding
 * específicos del sector eléctrico.
 *
 * Este es el default cuando APP_VERTICAL no está definida.
 */

import type { VerticalConfig, CatalogProvider, CatalogItem, ModuleId } from "../../core/types";

// --- Catalog Provider ---

/**
 * Proveedor de catálogo para electricistas.
 * Expone los items del catálogo existente en DB (catalog_items).
 * En esta fase, devuelve items estáticos como seed; en producción
 * se leen de la DB.
 */
const electricistaCatalog: CatalogProvider = {
  getItems(): CatalogItem[] {
    // Seed items representativos (el catálogo real está en DB)
    return [
      { id: "cat-cable", name: "Cable eléctrico", unit: "metro", unitPrice: 0, costPrice: 0, category: "Material eléctrico" },
      { id: "cat-tubo", name: "Tubo corrugado", unit: "metro", unitPrice: 0, costPrice: 0, category: "Material eléctrico" },
      { id: "cat-mecanismo", name: "Mecanismo (base + tecla)", unit: "unidad", unitPrice: 0, costPrice: 0, category: "Mecanismos" },
      { id: "cat-cuadro", name: "Cuadro eléctrico", unit: "unidad", unitPrice: 0, costPrice: 0, category: "Cuadros" },
      { id: "cat-diferencial", name: "Diferencial", unit: "unidad", unitPrice: 0, costPrice: 0, category: "Protecciones" },
      { id: "cat-magnetotermico", name: "Magnetotérmico", unit: "unidad", unitPrice: 0, costPrice: 0, category: "Protecciones" },
    ];
  },

  getCategories(): string[] {
    return ["Material eléctrico", "Mecanismos", "Cuadros", "Protecciones", "Iluminación", "Varios"];
  },

  getUnits(): { value: string; label: string }[] {
    return [
      { value: "unidad", label: "Unidad" },
      { value: "metro", label: "Metro" },
      { value: "rollo", label: "Rollo" },
      { value: "caja", label: "Caja" },
      { value: "hora", label: "Hora" },
      { value: "punto", label: "Punto de luz" },
      { value: "servicio", label: "Servicio" },
    ];
  },
};

// --- Modules ---

const ELECTRICISTA_MODULES: ModuleId[] = [
  "dashboard",
  "assistant",
  "clients",
  "crm",
  "leads",
  "invoices",
  "budgets",
  "work_orders",
  "expenses",
  "communications",
  "schedule",
  "catalog",
  "normativa",
  "help",
  "export",
  "settings",
];

// --- Config ---

export const electricistaConfig: VerticalConfig = {
  id: "electricista",
  brand: {
    tradeName: process.env.NEXT_PUBLIC_COMPANY_TRADE_NAME || process.env.COMPANY_TRADE_NAME || "Electricista 360",
    shortName: process.env.NEXT_PUBLIC_APP_SHORT_NAME || process.env.APP_SHORT_NAME || "Electricista 360",
    description: "Gestión profesional para servicios e instalaciones eléctricas",
    themeColor: "#1e293b",
    iconKey: "zap",
    initials: "360",
  },
  modules: ELECTRICISTA_MODULES,
  catalog: electricistaCatalog,
};
