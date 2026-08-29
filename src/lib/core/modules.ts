/**
 * AUTÓNOMO360 — Module Registry
 *
 * Define qué módulos están disponibles y sus metadatos de navegación.
 * Las verticales activan un subconjunto de estos módulos.
 */

import type { ModuleId } from "./types";

export interface ModuleDefinition {
  id: ModuleId;
  /** Ruta base del módulo */
  href: string;
  /** Label para navegación */
  label: string;
  /** Clave lucide-react del icono */
  iconKey: string;
}

/**
 * Registro completo de módulos disponibles en la plataforma.
 * El orden define el orden en la navegación.
 */
export const MODULE_REGISTRY: readonly ModuleDefinition[] = [
  { id: "dashboard", href: "/", label: "Dashboard", iconKey: "layout-dashboard" },
  { id: "assistant", href: "/asistente", label: "Asistente 360", iconKey: "bot" },
  { id: "clients", href: "/clientes", label: "Clientes", iconKey: "users" },
  { id: "crm", href: "/crm", label: "CRM", iconKey: "briefcase-business" },
  { id: "leads", href: "/leads", label: "Leads", iconKey: "user-plus" },
  { id: "invoices", href: "/facturas", label: "Facturas", iconKey: "file-text" },
  { id: "budgets", href: "/presupuestos", label: "Presupuestos", iconKey: "clipboard-list" },
  { id: "work_orders", href: "/partes-trabajo", label: "Partes de trabajo", iconKey: "clipboard-check" },
  { id: "expenses", href: "/gastos", label: "Gastos", iconKey: "receipt" },
  { id: "communications", href: "/comunicaciones", label: "Comunicaciones", iconKey: "message-square" },
  { id: "schedule", href: "/agenda", label: "Agenda", iconKey: "calendar" },
  { id: "catalog", href: "/catalogo", label: "Servicios", iconKey: "package" },
  { id: "normativa", href: "/normativa", label: "Normativa", iconKey: "book-open" },
  { id: "help", href: "/ayuda", label: "Ayuda y Sugerencias", iconKey: "help-circle" },
  { id: "export", href: "/exportar", label: "Exportar", iconKey: "download" },
  { id: "settings", href: "/configuracion", label: "Configuración", iconKey: "settings" },
] as const;

/**
 * Filtra los módulos activos para una vertical.
 * Mantiene el orden del registry.
 */
export function getActiveModules(activeIds: ModuleId[]): ModuleDefinition[] {
  const activeSet = new Set(activeIds);
  return MODULE_REGISTRY.filter((m) => activeSet.has(m.id));
}

/**
 * Verifica si un módulo está activo en la lista proporcionada.
 */
export function isModuleActive(moduleId: ModuleId, activeIds: ModuleId[]): boolean {
  return activeIds.includes(moduleId);
}
