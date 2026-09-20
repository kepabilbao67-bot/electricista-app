export interface Voice360Item {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number | null;
  total?: number | null;
  category?: string;
  supplier_reference?: string;
  is_estimate?: boolean;
}

export type Voice360LineItem = Voice360Item;

export interface Voice360ClientCandidate {
  id?: string;
  name: string;
  match_confidence?: number;
}

export interface Voice360Draft {
  revision: number;
  client_name?: string;
  client_candidates: Voice360ClientCandidate[];
  project_title?: string;
  description?: string;
  date?: string;
  time?: string;
  tax_rate: number;
  items: Voice360Item[];
  lines?: Voice360Item[];
  notes?: string[];
  raw_transcription?: string;
}

export interface Voice360Totals {
  subtotal: number;
  tax_amount: number;
  total: number;
  incomplete: string[];
}

export interface Voice360PendingAction {
  action: string;
  label: string;
  token?: string;
  confirmation_token?: string;
  payload?: Record<string, unknown>;
  required_role?: string;
  expires_at?: string;
}

export interface Voice360CatalogCandidate {
  id: string;
  name: string;
  unit_price: number;
  unit: string;
  category?: string;
  supplier_reference?: string;
}

export interface Voice360ProcessResult {
  success: boolean;
  action: "budget_draft" | "visit_draft" | "query" | "general_response" | "confirmation_required" | "order_draft" | "error";
  summary: string;
  intent?: string;
  budget?: Voice360Draft;
  draft?: Voice360Draft;
  totals?: Voice360Totals;
  answer?: string;
  result?: unknown;
  visit?: {
    client_name?: string;
    date?: string;
    time?: string;
    address?: string;
    notes?: string;
  };
  missing_data?: string[];
  pending_action?: Voice360PendingAction;
  raw_intent?: string;
  ticket?: {
    token: string;
    action: string;
    summary: string;
    expires_at: string;
  };
  error?: string;
}

export interface Voice360DomainAdapter {
  domainName: string;
  normalizeInput?(input: string): string | Promise<string>;
  enrichContext?(tenantId: string, input: string): Promise<Record<string, unknown>> | Record<string, unknown>;
  resolveCatalogItem?(query: string, tenantId: string): Promise<Voice360CatalogCandidate[] | null> | Voice360CatalogCandidate[] | null;
  extendTools?(): unknown[];
  postProcessResult?(result: Voice360ProcessResult, context?: Record<string, unknown>): Promise<Voice360ProcessResult> | Voice360ProcessResult;
}

export interface Voice360ClientConfig {
  baseUrl?: string;
  enabled?: boolean;
  timeoutMs?: number;
  authToken?: string;
}

export interface ProcessElectricistaVoiceOptions {
  tenantId?: string;
  requestId?: string;
  channel?: string;
  context?: Record<string, unknown>;
  config?: Voice360ClientConfig;
}
