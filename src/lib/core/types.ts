/**
 * AUTÓNOMO360 — Core Types
 *
 * Contratos fundamentales del núcleo común.
 * Toda vertical (electricista, tecnología, pintor, administrador...)
 * implementa estas interfaces para conectarse al sistema.
 *
 * Reglas:
 * - Este archivo NO importa nada de vertical ni de sector.
 * - Solo define interfaces y tipos.
 * - Las verticales IMPLEMENTAN estos contratos.
 * - El core CONSUME estos contratos.
 */

// --- Vertical identity ---

/**
 * Identificador de vertical. Extensible con string para verticales custom.
 */
export type Vertical = "general" | "electricista" | "tecnologia" | "barymont" | (string & {});

// --- Company ---

/**
 * Perfil de empresa del autónomo.
 * Fuente de datos para documentos, plantillas, facturas y partes.
 */
export interface CompanyProfile {
  tradeName: string;
  legalName: string;
  ownerName: string;
  nif: string;
  addressLine1: string;
  addressLine2: string;
  phone: string;
  email: string;
  logo?: string;
}

// --- Brand ---

/**
 * Configuración de marca visual de una vertical.
 * No contiene datos personales ni fiscales.
 */
export interface VerticalBrand {
  tradeName: string;
  shortName: string;
  description: string;
  themeColor: string;
  /** Clave lucide-react serializable (ej: "zap", "cpu", "paintbrush") */
  iconKey: string;
  initials: string;
}

// --- Modules ---

/**
 * Módulos disponibles en la plataforma.
 * Cada vertical activa un subconjunto.
 */
export type ModuleId =
  | "dashboard"
  | "clients"
  | "crm"
  | "leads"
  | "invoices"
  | "budgets"
  | "work_orders"
  | "jobs"
  | "expenses"
  | "schedule"
  | "catalog"
  | "communications"
  | "chats"
  | "normativa"
  | "export"
  | "assistant"
  | "measurements"
  | "signatures"
  | "email"
  | "help"
  | "settings";

// --- Catalog ---

/**
 * Item genérico del catálogo de servicios/materiales.
 */
export interface CatalogItem {
  id: string;
  name: string;
  description?: string;
  unit: string;
  unitPrice: number;
  costPrice: number;
  category: string;
}

/**
 * Proveedor de catálogo para una vertical.
 * Permite que cada oficio defina sus propios servicios/materiales.
 */
export interface CatalogProvider {
  getItems(): CatalogItem[];
  getCategories(): string[];
  getUnits(): { value: string; label: string }[];
}

// --- Knowledge ---

/**
 * Proveedor de conocimiento sectorial para el asistente/normativa.
 * Opcional: si una vertical no lo implementa, el módulo normativa se oculta.
 */
export interface KnowledgeProvider {
  /** Temas que el asistente puede responder */
  getTopics(): string[];
  /** Intenta responder una consulta. null si no tiene respuesta. */
  answer(query: string, catalog: CatalogItem[]): string | null;
  /** Chips de sugerencia para la UI */
  getSuggestionChips(): string[];
}

// --- Vertical Config ---

/**
 * Configuración completa de una vertical.
 * Es el contrato principal que cada vertical implementa.
 */
export interface VerticalConfig {
  /** Identificador único de la vertical */
  id: Vertical;
  /** Marca visual */
  brand: VerticalBrand;
  /** Módulos activos en esta vertical */
  modules: ModuleId[];
  /** Proveedor de catálogo */
  catalog: CatalogProvider;
  /** Proveedor de conocimiento (opcional) */
  knowledge?: KnowledgeProvider;
}
