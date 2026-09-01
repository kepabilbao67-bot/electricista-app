/**
 * AUTÓNOMO360 — Configuración de la vertical "barymont" (Pedro Barymont 360)
 *
 * Especialización para planificación financiera, previsión social,
 * seguros y asesoramiento patrimonial integral.
 *
 * Mantiene aislamiento completo de otras verticales.
 */

import type { VerticalConfig, CatalogProvider, CatalogItem, ModuleId } from "../../core/types";

// --- Catalog Provider Barymont ---

const barymontCatalog: CatalogProvider = {
  getItems(): CatalogItem[] {
    return [
      {
        id: "cat-bar-estudio-financiero",
        name: "Estudio de Planificación Financiera Integral",
        description: "Análisis patrimonial, flujo de caja, objetivos de ahorro y jubilación",
        unit: "servicio",
        unitPrice: 0,
        costPrice: 0,
        category: "Planificación Financiera",
      },
      {
        id: "cat-bar-auditoria-seguros",
        name: "Auditoría y Optimización de Pólizas de Seguros",
        description: "Revisión de coberturas familiares, empresariales y optimización de primas",
        unit: "servicio",
        unitPrice: 0,
        costPrice: 0,
        category: "Seguros y Protección",
      },
      {
        id: "cat-bar-plan-ahorro",
        name: "Asesoramiento Plan de Ahorro e Inversión Sistemático",
        description: "Estructuración de fondos indexados, PIAS, unit linked según perfil de riesgo",
        unit: "servicio",
        unitPrice: 0,
        costPrice: 0,
        category: "Ahorro e Inversión",
      },
      {
        id: "cat-bar-plan-pensiones",
        name: "Estrategia de Previsión y Complemento de Jubilación",
        description: "Plan de pensiones individual / empleo y desgravación fiscal",
        unit: "servicio",
        unitPrice: 0,
        costPrice: 0,
        category: "Previsión y Jubilación",
      },
      {
        id: "cat-bar-hipoteca-asesoria",
        name: "Asesoramiento e Intermediación Hipotecaria",
        description: "Estudio de viabilidad, negociación de tipo fijo/mixto y cancelación",
        unit: "servicio",
        unitPrice: 0,
        costPrice: 0,
        category: "Financiación e Hipotecas",
      },
      {
        id: "cat-bar-proteccion-socios",
        name: "Seguro de Protección de Socios y Hombres Clave",
        description: "Cobertura societaria para continuidad del negocio y contingencias",
        unit: "servicio",
        unitPrice: 0,
        costPrice: 0,
        category: "Empresas y Autónomos",
      },
      {
        id: "cat-bar-salud-vida",
        name: "Póliza de Salud, Vida y Accidentes para Autónomos",
        description: "Garantía de ingresos por baja laboral y cobertura médica privada",
        unit: "servicio",
        unitPrice: 0,
        costPrice: 0,
        category: "Seguros y Protección",
      },
      {
        id: "cat-bar-sesion-seguimiento",
        name: "Sesión Periódica de Revisión Patrimonial",
        description: "Rebalanceo de cartera y actualización de objetivos vitales",
        unit: "sesion",
        unitPrice: 0,
        costPrice: 0,
        category: "Consultoría y Seguimiento",
      },
    ];
  },

  getCategories(): string[] {
    return [
      "Planificación Financiera",
      "Seguros y Protección",
      "Ahorro e Inversión",
      "Previsión y Jubilación",
      "Financiación e Hipotecas",
      "Empresas y Autónomos",
      "Consultoría y Seguimiento",
    ];
  },

  getUnits(): { value: string; label: string }[] {
    return [
      { value: "servicio", label: "Servicio (srv)" },
      { value: "sesion", label: "Sesión" },
      { value: "mes", label: "Mes" },
      { value: "año", label: "Año" },
      { value: "hora", label: "Hora (h)" },
    ];
  },
};

// --- Módulos Activos Barymont ---

const BARYMONT_MODULES: ModuleId[] = [
  "dashboard",
  "assistant",
  "clients",
  "crm",
  "leads",
  "communications",
  "chats",
  "schedule",
  "invoices",
  "budgets",
  "expenses",
  "catalog",
  "help",
  "export",
  "settings",
];

// --- Configuración Principal ---

export const barymontConfig: VerticalConfig = {
  id: "barymont",
  brand: {
    tradeName: process.env.NEXT_PUBLIC_COMPANY_TRADE_NAME || process.env.COMPANY_TRADE_NAME || "Pedro Barymont 360",
    shortName: process.env.NEXT_PUBLIC_APP_SHORT_NAME || process.env.APP_SHORT_NAME || "Barymont360",
    description: "Planificación financiera integral, protección aseguradora y gestión patrimonial",
    themeColor: "#047857",
    iconKey: "briefcase",
    initials: "PB",
  },
  modules: BARYMONT_MODULES,
  catalog: barymontCatalog,
};
