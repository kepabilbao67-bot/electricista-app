/**
 * ASISTENTE 360 — Budget Draft Builder
 *
 * Transforma un ParsedIntent de tipo create_budget en un objeto
 * compatible con el body que acepta POST /api/budgets.
 *
 * NO persiste nada. Solo genera el payload de vista previa.
 * La persistencia ocurre SOLAMENTE después de confirmación humana.
 */

import type { ParsedIntent, CreateBudgetFields } from "./intent-schema";

// --- Tipos compatibles con POST /api/budgets ---

export interface BudgetDraftItem {
  description: string;
  quantity: number;
  unit_price: number;
}

export interface BudgetDraftPayload {
  client_id: string | null;
  client_name_hint: string | null;
  date: string;
  valid_until: string | null;
  status: "draft";
  tax_rate: number;
  items: BudgetDraftItem[];
  notes: string | null;
}

export interface BudgetDraftResult {
  success: boolean;
  payload: BudgetDraftPayload | null;
  /** Cálculos para la vista previa (NO se persisten) */
  preview: {
    subtotal: number;
    taxAmount: number;
    total: number;
    lineCount: number;
  } | null;
  errors: string[];
  warnings: string[];
}

// --- Validación ---

function validateLines(lines: CreateBudgetFields["lines"]): string[] {
  const errors: string[] = [];
  if (!lines || lines.length === 0) {
    errors.push("Se necesita al menos una línea con descripción, cantidad y precio.");
    return errors;
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.description || line.description.trim().length === 0) {
      errors.push(`Línea ${i + 1}: falta descripción.`);
    }
    if (typeof line.quantity !== "number" || line.quantity <= 0) {
      errors.push(`Línea ${i + 1}: cantidad debe ser positiva.`);
    }
    if (typeof line.unitPrice !== "number" || line.unitPrice < 0) {
      errors.push(`Línea ${i + 1}: precio unitario no puede ser negativo.`);
    }
    if (typeof line.unitPrice === "number" && line.unitPrice > 1_000_000) {
      errors.push(`Línea ${i + 1}: precio unitario excesivamente alto (>1.000.000). Verificar.`);
    }
  }
  return errors;
}

// --- Builder ---

/**
 * Genera un borrador de presupuesto a partir de un intent parseado.
 *
 * @param intent - El ParsedIntent con type === "create_budget"
 * @returns BudgetDraftResult con payload o errores
 */
export function buildBudgetDraft(intent: ParsedIntent): BudgetDraftResult {
  const warnings: string[] = [];

  if (intent.type !== "create_budget") {
    return {
      success: false,
      payload: null,
      preview: null,
      errors: [`Intent type "${intent.type}" no es create_budget.`],
      warnings: [],
    };
  }

  const fields = intent.fields as Partial<CreateBudgetFields>;
  const lines = fields.lines ?? [];
  const taxRate = fields.taxRate ?? 21;

  // Validar
  const errors = validateLines(lines);

  if (taxRate < 0 || taxRate > 100) {
    errors.push(`Tasa de IVA inválida: ${taxRate}%. Debe estar entre 0 y 100.`);
  }

  if (errors.length > 0) {
    return { success: false, payload: null, preview: null, errors, warnings };
  }

  // Generar warnings
  if (!fields.clientName && !fields.clientId) {
    warnings.push("No se identificó cliente. Se creará sin cliente asignado.");
  }

  if (intent.confidence < 0.7) {
    warnings.push("Baja confianza en la interpretación. Revisar datos antes de confirmar.");
  }

  // Calcular totales para preview (redondeo a 2 decimales para consistencia monetaria)
  const subtotal = Math.round(lines.reduce((acc, l) => acc + l.quantity * l.unitPrice, 0) * 100) / 100;
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  // Construir payload compatible con POST /api/budgets
  const today = new Date().toISOString().split("T")[0];
  const payload: BudgetDraftPayload = {
    client_id: fields.clientId || null,
    client_name_hint: fields.clientName || null,
    date: today,
    valid_until: fields.validUntil || null,
    status: "draft",
    tax_rate: taxRate,
    items: lines.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unit_price: l.unitPrice,
    })),
    notes: fields.notes || null,
  };

  return {
    success: true,
    payload,
    preview: { subtotal, taxAmount, total, lineCount: lines.length },
    errors: [],
    warnings,
  };
}
