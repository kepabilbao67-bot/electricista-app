/**
 * AUTÓNOMO360 — Configuración de la vertical "general" (Núcleo Multi-Sector)
 *
 * Implementa VerticalConfig con catálogos, branding y módulos neutros
 * diseñados para cualquier autónomo o pequeña empresa sin acoplamientos
 * sectoriales ni referencias exclusivas a oficios específicos.
 */

import type { VerticalConfig, CatalogProvider, CatalogItem, ModuleId } from "../../core/types";

// --- Catalog Provider Neutro ---

const generalCatalog: CatalogProvider = {
  getItems(): CatalogItem[] {
    return [
      // Servicios genéricos
      {
        id: "cat-gen-hora",
        name: "Hora de trabajo",
        description: "Mano de obra y servicios profesionales por hora",
        unit: "hora",
        unitPrice: 0,
        costPrice: 0,
        category: "Servicios",
      },
      {
        id: "cat-gen-desplazamiento",
        name: "Desplazamiento",
        description: "Gastos de desplazamiento y kilometraje",
        unit: "servicio",
        unitPrice: 0,
        costPrice: 0,
        category: "Servicios",
      },
      {
        id: "cat-gen-visita",
        name: "Visita técnica",
        description: "Inspección, evaluación previa o asesoramiento in situ",
        unit: "servicio",
        unitPrice: 0,
        costPrice: 0,
        category: "Servicios",
      },
      {
        id: "cat-gen-consultoria",
        name: "Consultoría",
        description: "Servicio de consultoría y asesoramiento profesional",
        unit: "hora",
        unitPrice: 0,
        costPrice: 0,
        category: "Servicios",
      },
      {
        id: "cat-gen-mantenimiento",
        name: "Mantenimiento",
        description: "Cuota periódica de mantenimiento y revisión de servicio",
        unit: "mes",
        unitPrice: 0,
        costPrice: 0,
        category: "Servicios",
      },
      {
        id: "cat-gen-urgente",
        name: "Servicio urgente",
        description: "Atención prioritaria o fuera de horario comercial",
        unit: "servicio",
        unitPrice: 0,
        costPrice: 0,
        category: "Servicios",
      },

      // Conceptos y materiales genéricos repercutibles
      {
        id: "cat-gen-materiales",
        name: "Materiales",
        description: "Materiales y suministros empleados en el servicio",
        unit: "unidad",
        unitPrice: 0,
        costPrice: 0,
        category: "Materiales y Gastos",
      },
      {
        id: "cat-gen-consumibles",
        name: "Consumibles",
        description: "Consumibles y piezas menores repercutibles",
        unit: "unidad",
        unitPrice: 0,
        costPrice: 0,
        category: "Materiales y Gastos",
      },
      {
        id: "cat-gen-dietas",
        name: "Dietas",
        description: "Dietas y manutención asociadas al servicio",
        unit: "dia",
        unitPrice: 0,
        costPrice: 0,
        category: "Materiales y Gastos",
      },
      {
        id: "cat-gen-transporte",
        name: "Transporte",
        description: "Portes, mensajería o transporte de material",
        unit: "servicio",
        unitPrice: 0,
        costPrice: 0,
        category: "Materiales y Gastos",
      },
      {
        id: "cat-gen-otros",
        name: "Otros gastos repercutibles",
        description: "Gastos extraordinarios justificados del trabajo",
        unit: "servicio",
        unitPrice: 0,
        costPrice: 0,
        category: "Materiales y Gastos",
      },
    ];
  },

  getCategories(): string[] {
    return ["Servicios", "Materiales y Gastos", "Mantenimiento", "Consultoría", "Varios"];
  },

  getUnits(): { value: string; label: string }[] {
    return [
      { value: "unidad", label: "Unidad (ud)" },
      { value: "hora", label: "Hora (h)" },
      { value: "servicio", label: "Servicio (srv)" },
      { value: "dia", label: "Día" },
      { value: "mes", label: "Mes" },
      { value: "km", label: "Kilómetro (km)" },
      { value: "pack", label: "Pack / Paquete" },
    ];
  },
};

// --- Módulos Generales Activos ---

const GENERAL_MODULES: ModuleId[] = [
  "dashboard",
  "clients",
  "crm",
  "leads",
  "invoices",
  "budgets",
  "jobs",
  "work_orders",
  "expenses",
  "schedule",
  "catalog",
  "communications",
  "assistant",
  "help",
  "export",
  "settings",
];

// --- Configuración Principal ---

export const generalConfig: VerticalConfig = {
  id: "general",
  brand: {
    tradeName: process.env.NEXT_PUBLIC_COMPANY_TRADE_NAME || process.env.COMPANY_TRADE_NAME || "Autónomo360",
    shortName: process.env.NEXT_PUBLIC_APP_SHORT_NAME || process.env.APP_SHORT_NAME || "Autónomo360",
    description: "Gestión profesional integral para autónomos y pequeñas empresas",
    themeColor: "#2563eb",
    iconKey: "briefcase",
    initials: "A360",
  },
  modules: GENERAL_MODULES,
  catalog: generalCatalog,
};
