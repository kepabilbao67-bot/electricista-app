/**
 * ASISTENTE 360 — Command/Intent Schema
 *
 * Define el contrato tipado entre la entrada del usuario (texto o voz)
 * y las acciones que el sistema puede ejecutar.
 *
 * Reglas de seguridad:
 * - Toda operación económica requiere CONFIRM_REQUIRED antes de EXECUTE.
 * - DRAFT no persiste hasta confirmación.
 * - READ es siempre seguro.
 * - Ninguna interpretación de IA ejecuta directamente acciones sensibles.
 */

// --- Security Levels ---

export type SecurityLevel = "READ" | "DRAFT" | "CONFIRM_REQUIRED" | "EXECUTE";

// --- Intent Types ---

export type IntentType =
  | "create_budget"
  | "create_invoice"
  | "create_client"
  | "create_visit"
  | "create_expense"
  | "query_client"
  | "query_budget"
  | "query_invoice"
  | "send_communication"
  | "unknown";

// --- Structured Fields por Intent ---

export interface BudgetLineField {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateBudgetFields {
  clientName?: string;
  clientId?: string;
  lines: BudgetLineField[];
  taxRate?: number;
  notes?: string;
  validUntil?: string;
}

export interface CreateClientFields {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  nif?: string;
  clientType?: "particular" | "empresa";
}

export interface CreateVisitFields {
  clientName?: string;
  clientId?: string;
  title: string;
  date: string;
  time?: string;
  address?: string;
  notes?: string;
}

export interface CreateExpenseFields {
  supplierName?: string;
  date: string;
  items: { description: string; quantity: number; unitPrice: number }[];
  taxRate?: number;
  notes?: string;
}

export interface CreateInvoiceFields {
  clientName?: string;
  clientId?: string;
  lines: BudgetLineField[];
  taxRate?: number;
  notes?: string;
}

export interface QueryFields {
  searchTerm?: string;
  clientName?: string;
  status?: string;
}

export interface SendCommunicationFields {
  clientName?: string;
  clientId?: string;
  type: "whatsapp" | "email" | "sms";
  message: string;
  subject?: string;
}

// --- Intent Result ---

export interface ParsedIntent {
  /** Tipo de intención detectada */
  type: IntentType;
  /** Nivel de seguridad requerido */
  security: SecurityLevel;
  /** Confianza de la interpretación (0-1) */
  confidence: number;
  /** Campos estructurados extraídos */
  fields: Record<string, unknown>;
  /** Texto original del usuario */
  rawInput: string;
  /** Campos que no pudieron extraerse y requieren aclaración */
  missingFields: string[];
  /** Siempre true hasta confirmación humana */
  isDraft: true;
}

// --- Security mapping ---

const INTENT_SECURITY: Record<IntentType, SecurityLevel> = {
  create_budget: "CONFIRM_REQUIRED",
  create_invoice: "CONFIRM_REQUIRED",
  create_client: "CONFIRM_REQUIRED",
  create_visit: "CONFIRM_REQUIRED",
  create_expense: "CONFIRM_REQUIRED",
  query_client: "READ",
  query_budget: "READ",
  query_invoice: "READ",
  send_communication: "CONFIRM_REQUIRED",
  unknown: "READ",
};

/**
 * Obtiene el nivel de seguridad para un tipo de intent.
 */
export function getSecurityLevel(type: IntentType): SecurityLevel {
  return INTENT_SECURITY[type];
}

/**
 * Verifica si un intent requiere confirmación humana antes de ejecutarse.
 */
export function requiresConfirmation(type: IntentType): boolean {
  const level = getSecurityLevel(type);
  return level === "CONFIRM_REQUIRED" || level === "EXECUTE";
}

/**
 * Lista de todos los tipos de intent válidos.
 */
export const ALL_INTENT_TYPES: readonly IntentType[] = Object.keys(INTENT_SECURITY) as IntentType[];
