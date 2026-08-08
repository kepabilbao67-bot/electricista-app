/**
 * ASISTENTE 360 — Intent Parser
 *
 * Transforma texto libre (entrada de voz transcrita o teclado) en un
 * ParsedIntent estructurado.
 *
 * Este parser es DETERMINISTA y local: no llama a APIs externas.
 * Usa patrones de texto para extraer intención y datos.
 * Para interpretación avanzada con IA, se usará un adaptador externo
 * en fases posteriores.
 *
 * El resultado siempre es isDraft=true.
 */

import type {
  ParsedIntent,
  IntentType,
  CreateBudgetFields,
  CreateClientFields,
  BudgetLineField,
} from "./intent-schema";
import { getSecurityLevel } from "./intent-schema";

// --- Pattern matchers ---

interface PatternMatch {
  type: IntentType;
  pattern: RegExp;
}

const INTENT_PATTERNS: PatternMatch[] = [
  { type: "create_budget", pattern: /\b(presupuesto|presu)\b/i },
  { type: "create_invoice", pattern: /\b(factura)\b/i },
  { type: "create_client", pattern: /\b(cliente\s+nuevo|nuevo\s+cliente|crear\s+cliente|añadir\s+cliente)\b/i },
  { type: "create_visit", pattern: /\b(visita|cita|tarea)\b/i },
  { type: "create_expense", pattern: /\b(gasto|compra)\b/i },
  { type: "query_client", pattern: /\b(buscar?\s+cliente|consultar?\s+cliente|datos\s+de)\b/i },
  { type: "query_budget", pattern: /\b(buscar?\s+presupuesto|consultar?\s+presupuesto|ver\s+presupuesto)\b/i },
  { type: "query_invoice", pattern: /\b(buscar?\s+factura|consultar?\s+factura|ver\s+factura)\b/i },
  { type: "send_communication", pattern: /\b(enviar?\s+mensaje|mandar?\s+mensaje|escribir?\s+a|whatsapp)\b/i },
];

// --- Field extractors ---

/**
 * Extrae nombre de cliente del texto.
 * Busca patrones como "para Juan García", "cliente Juan García", "a nombre de X"
 */
function extractClientName(text: string): string | undefined {
  const patterns = [
    /(?:para|cliente|a nombre de)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3})/,
    /(?:de|del cliente)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3})/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return undefined;
}

/**
 * Extrae líneas de presupuesto/factura del texto.
 * Busca patrones como "6 horas a 35 euros", "420 euros de material"
 */
function extractBudgetLines(text: string): BudgetLineField[] {
  const lines: BudgetLineField[] = [];

  // Patrón: N unidades/horas a X euros [de descripción]
  const quantityPricePattern = /(\d+(?:[.,]\d+)?)\s*(?:horas?|unidades?|ud)?\s*(?:a|x)\s*(\d+(?:[.,]\d+)?)\s*(?:euros?|€|eur)/gi;
  let m: RegExpExecArray | null;
  while ((m = quantityPricePattern.exec(text)) !== null) {
    const quantity = parseFloat(m[1].replace(",", "."));
    const unitPrice = parseFloat(m[2].replace(",", "."));
    // Intentar extraer descripción cercana
    const afterMatch = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 60);
    const descMatch = afterMatch.match(/^\s*(?:de\s+)?([a-záéíóúñ\s]+)/i);
    const description = descMatch?.[1]?.trim() || "Trabajo";
    lines.push({ description, quantity, unitPrice });
  }

  // Patrón: X euros de descripción (cantidad implícita = 1)
  const totalPattern = /(\d+(?:[.,]\d+)?)\s*(?:euros?|€|eur)\s+(?:de|en)\s+([a-záéíóúñ\s]+)/gi;
  while ((m = totalPattern.exec(text)) !== null) {
    const total = parseFloat(m[1].replace(",", "."));
    const description = m[2].trim();
    // Evitar duplicados si ya se capturó en el patrón anterior
    const isDuplicate = lines.some(
      (l) => Math.abs(l.quantity * l.unitPrice - total) < 0.01
    );
    if (!isDuplicate && description.length > 1) {
      lines.push({ description, quantity: 1, unitPrice: total });
    }
  }

  return lines;
}

/**
 * Extrae tasa de IVA si se menciona explícitamente.
 */
function extractTaxRate(text: string): number | undefined {
  const m = text.match(/(\d+)\s*%?\s*(?:de\s+)?(?:iva|impuesto)/i);
  if (m) {
    const rate = parseInt(m[1], 10);
    if (rate >= 0 && rate <= 100) return rate;
  }
  return undefined;
}

// --- Main parser ---

/**
 * Parsea texto libre a un ParsedIntent.
 * Siempre devuelve un resultado (type="unknown" si no se reconoce).
 */
export function parseIntent(input: string): ParsedIntent {
  const text = input.trim();

  if (!text) {
    return {
      type: "unknown",
      security: "READ",
      confidence: 0,
      fields: {},
      rawInput: input,
      missingFields: [],
      isDraft: true,
    };
  }

  // Detectar tipo de intent
  let detectedType: IntentType = "unknown";
  let confidence = 0;

  for (const { type, pattern } of INTENT_PATTERNS) {
    if (pattern.test(text)) {
      detectedType = type;
      confidence = 0.7; // Confianza base por patrón simple
      break;
    }
  }

  // Extraer campos según el tipo
  const fields: Record<string, unknown> = {};
  const missingFields: string[] = [];

  if (detectedType === "create_budget" || detectedType === "create_invoice") {
    const clientName = extractClientName(text);
    const lines = extractBudgetLines(text);
    const taxRate = extractTaxRate(text);

    const budgetFields: CreateBudgetFields = {
      clientName,
      lines,
      taxRate,
    };
    Object.assign(fields, budgetFields);

    if (!clientName) missingFields.push("clientName");
    if (lines.length === 0) missingFields.push("lines");

    // Ajustar confianza
    if (clientName && lines.length > 0) confidence = 0.85;
    else if (clientName || lines.length > 0) confidence = 0.6;
  }

  if (detectedType === "create_client") {
    const clientName = extractClientName(text) || extractNameDirect(text);
    const clientFields: Partial<CreateClientFields> = { name: clientName || "" };
    Object.assign(fields, clientFields);
    if (!clientName) missingFields.push("name");
    else confidence = 0.8;
  }

  return {
    type: detectedType,
    security: getSecurityLevel(detectedType),
    confidence,
    fields,
    rawInput: input,
    missingFields,
    isDraft: true,
  };
}

/**
 * Intenta extraer un nombre propio directamente del texto cuando no hay prefijo.
 */
function extractNameDirect(text: string): string | undefined {
  // Buscar secuencia de palabras con mayúscula inicial
  const m = text.match(/([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+)/);
  return m?.[1]?.trim();
}
