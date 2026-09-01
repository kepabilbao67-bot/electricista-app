/**
 * AUTÓNOMO360 - Configuración de la vertical "barymont"
 *
 * Módulo especializado para planificación financiera, asesoramiento patrimonial,
 * gestión de clientes, oportunidades y seguimiento comercial para Barymont / Pedro.
 *
 * Concepto de marca: "Planifica. Protege. Haz crecer."
 */

import type {
  VerticalConfig,
  CatalogProvider,
  CatalogItem,
  ModuleId,
  KnowledgeProvider,
} from "../../core/types";

// --- Catalog Provider Barymont ---

const barymontCatalog: CatalogProvider = {
  getItems(): CatalogItem[] {
    return [
      {
        id: "cat-bm-plan-integral",
        name: "Planificación Financiera Integral",
        description: "Estudio personalizado de balance patrimonial, objetivos vitales y optimización financiera",
        unit: "servicio",
        unitPrice: 0,
        costPrice: 0,
        category: "Planificación Financiera",
      },
      {
        id: "cat-bm-ahorro-sistematico",
        name: "Plan de Ahorro Sistemático / PIAS",
        description: "Estrategia de acumulación y ahorro periódico con ventajas fiscales y liquidez estructurada",
        unit: "plan",
        unitPrice: 0,
        costPrice: 0,
        category: "Ahorro e Inversión",
      },
      {
        id: "cat-bm-jubilacion",
        name: "Plan de Jubilación y Previsión Futura",
        description: "Diagnóstico de pensión estimada y vehículo de capitalización para complementar la jubilación",
        unit: "plan",
        unitPrice: 0,
        costPrice: 0,
        category: "Jubilación",
      },
      {
        id: "cat-bm-vida-proteccion",
        name: "Seguro de Vida y Protección Familiar",
        description: "Cobertura de respaldo familiar por fallecimiento e incapacidad absoluta permanente",
        unit: "poliza",
        unitPrice: 0,
        costPrice: 0,
        category: "Protección y Seguros",
      },
      {
        id: "cat-bm-salud-integral",
        name: "Seguro de Salud y Cuadro Médico",
        description: "Protección médica integral y acceso directo a especialistas sin copagos ni listas de espera",
        unit: "poliza",
        unitPrice: 0,
        costPrice: 0,
        category: "Protección y Seguros",
      },
      {
        id: "cat-bm-baja-autonomo",
        name: "Seguro de Incapacidad Temporal y Bajas",
        description: "Indemnización diaria para profesionales autónomos ante enfermedad o accidente",
        unit: "poliza",
        unitPrice: 0,
        costPrice: 0,
        category: "Protección y Seguros",
      },
      {
        id: "cat-bm-gestion-patrimonial",
        name: "Asesoramiento de Inversión y Gestión Patrimonial",
        description: "Estrategia de diversificación en fondos de inversión según perfil de riesgo y horizonte temporal",
        unit: "servicio",
        unitPrice: 0,
        costPrice: 0,
        category: "Ahorro e Inversión",
      },
      {
        id: "cat-bm-ahorro-estudios",
        name: "Plan de Futuro y Estudios para Hijos",
        description: "Fondo de ahorro garantizado y capitalización para la formación universitaria de menores",
        unit: "plan",
        unitPrice: 0,
        costPrice: 0,
        category: "Ahorro e Inversión",
      },
      {
        id: "cat-bm-revision-anual",
        name: "Revisión Anual de Cartera Financiera",
        description: "Auditoría periódica de rentabilidad, objetivos alcanzados y ajuste a cambios normativos/fiscales",
        unit: "servicio",
        unitPrice: 0,
        costPrice: 0,
        category: "Planificación Financiera",
      },
      {
        id: "cat-bm-consultoria-pymes",
        name: "Consultoría de Previsión Colectiva para Empresas",
        description: "Planes de retribución flexible, previsión social empresarial y retención de talento",
        unit: "servicio",
        unitPrice: 0,
        costPrice: 0,
        category: "Empresas y Pymes",
      },
    ];
  },

  getCategories(): string[] {
    return [
      "Planificación Financiera",
      "Ahorro e Inversión",
      "Jubilación",
      "Protección y Seguros",
      "Empresas y Pymes",
      "Varios",
    ];
  },

  getUnits(): { value: string; label: string }[] {
    return [
      { value: "servicio", label: "Servicio" },
      { value: "plan", label: "Plan" },
      { value: "poliza", label: "Póliza" },
      { value: "mes", label: "Mes" },
      { value: "anual", label: "Anual" },
      { value: "hora", label: "Hora" },
      { value: "unidad", label: "Unidad" },
    ];
  },
};

// --- Knowledge Provider Barymont ---

const barymontKnowledge: KnowledgeProvider = {
  getTopics(): string[] {
    return [
      "Planificación Financiera",
      "Educación Financiera",
      "Seguimiento Comercial",
      "Protección Familiar",
      "Ahorro Sistemático",
      "Jubilación y Pensiones",
      "Gestión de Oportunidades",
    ];
  },

  answer(query: string): string | null {
    const q = query.toLowerCase();
    if (q.includes("metodo") || q.includes("planificacion financiera") || q.includes("que es barymont")) {
      return (
        "**Planificación Financiera Barymont — “Planifica. Protege. Haz crecer.”**\n\n" +
        "El método Barymont se fundamenta en la **educación financiera** y en un análisis personalizado en 4 etapas:\n" +
        "1. **Diagnóstico Patrimonial:** Evaluación de ingresos, gastos, endeudamiento y capacidad de ahorro.\n" +
        "2. **Protección Familiar:** Cobertura de contingencias vitales (fallecimiento, invalidez, salud y bajas).\n" +
        "3. **Ahorro e Inversión Sistemática:** Estrategias a medio y largo plazo con interés compuesto y ventajas fiscales.\n" +
        "4. **Previsión de Jubilación y Libertad Financiera:** Creación de un patrimonio sólido que garantice la calidad de vida futura."
      );
    }
    return null;
  },

  getSuggestionChips(): string[] {
    return [
      "¿A quién tengo que llamar hoy?",
      "¿Qué clientes llevan más tiempo sin seguimiento?",
      "¿Qué oportunidades están más calientes?",
      "¿Qué reuniones tengo esta semana?",
      "¿Qué clientes tienen documentación pendiente?",
      "Resumen comercial de cartera",
    ];
  },
};

// --- Módulos Activos Barymont ---

const BARYMONT_MODULES: ModuleId[] = [
  "dashboard",
  "clients",
  "crm",
  "leads",
  "schedule",
  "communications",
  "assistant",
  "budgets",
  "invoices",
  "expenses",
  "catalog",
  "help",
  "export",
  "settings",
];

// --- Configuración Principal Barymont ---

export const barymontConfig: VerticalConfig = {
  id: "barymont",
  brand: {
    tradeName:
      process.env.NEXT_PUBLIC_COMPANY_TRADE_NAME ||
      process.env.COMPANY_TRADE_NAME ||
      "Barymont",
    shortName:
      process.env.NEXT_PUBLIC_APP_SHORT_NAME ||
      process.env.APP_SHORT_NAME ||
      "Barymont",
    description: "Planificación financiera, gestión de clientes y seguimiento comercial",
    themeColor: "#0284c7",
    iconKey: "trending-up",
    initials: "BM",
  },
  modules: BARYMONT_MODULES,
  catalog: barymontCatalog,
  knowledge: barymontKnowledge,
};
