/**
 * ELECTRICISTA360 — Command/Intent Schema
 *
 * Contrato tipado entre la entrada del usuario (texto o voz)
 * y las acciones que Electricista360 puede preparar.
 *
 * Reglas de seguridad:
 * - Toda operación económica requiere CONFIRM_REQUIRED antes de EXECUTE.
 * - DRAFT no persiste hasta confirmación.
 * - READ es siempre seguro.
 * - Ninguna interpretación de IA ejecuta directamente acciones sensibles.
 */

export type SecurityLevel = "READ" | "DRAFT" | "CONFIRM_REQUIRED" | "EXECUTE";

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

export interface ParsedIntent {
  type: IntentType;
  security: SecurityLevel;
  confidence: number;
  fields: Record<string, unknown>;
  rawInput: string;
  missingFields: string[];
  isDraft: true;
}

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

export function getSecurityLevel(type: IntentType): SecurityLevel {
  return INTENT_SECURITY[type];
}

export function requiresConfirmation(type: IntentType): boolean {
  const level = getSecurityLevel(type);
  return level === "CONFIRM_REQUIRED" || level === "EXECUTE";
}

export const ALL_INTENT_TYPES: readonly IntentType[] = Object.keys(INTENT_SECURITY) as IntentType[];
