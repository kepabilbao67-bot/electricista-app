/**
 * Filtro de datos sensibles para el asistente de texto.
 * Detecta y protege: NIF/CIF/NIE, IBAN, emails, teléfonos, importes, fechas, horas, URLs.
 * No es perfecto pero reduce el riesgo de que la IA modifique datos protegidos.
 */

// Patterns for sensitive tokens
const PATTERNS = {
  nif: /\b\d{8}[A-Z]\b/gi,
  nie: /\b[XYZ]\d{7}[A-Z]\b/gi,
  cif: /\b[ABCDEFGHJNPQRSUVW]\d{7}[A-J0-9]\b/gi,
  iban: /\b[A-Z]{2}\d{2}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/gi,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/gi,
  phone: /\b(\+?\d{1,3}[\s.-]?)?\d{3}[\s.-]?\d{3}[\s.-]?\d{3}\b/g,
  amount: /\b\d+([.,]\d{1,2})?\s*€\b/g,
  date: /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g,
  time: /\b\d{1,2}:\d{2}(:\d{2})?\b/g,
  url: /https?:\/\/[^\s]+/gi,
  number_standalone: /\b\d+([.,]\d+)?\b/g,
};

export interface SensitiveTokens {
  nif: string[];
  email: string[];
  phone: string[];
  amount: string[];
  date: string[];
  time: string[];
  iban: string[];
  url: string[];
  numbers: string[];
}

/**
 * Extracts all sensitive tokens from text.
 */
export function extractSensitiveTokens(text: string): SensitiveTokens {
  return {
    nif: [...(text.match(PATTERNS.nif) || []), ...(text.match(PATTERNS.nie) || []), ...(text.match(PATTERNS.cif) || [])],
    email: text.match(PATTERNS.email) || [],
    phone: text.match(PATTERNS.phone) || [],
    amount: text.match(PATTERNS.amount) || [],
    date: text.match(PATTERNS.date) || [],
    time: text.match(PATTERNS.time) || [],
    iban: text.match(PATTERNS.iban) || [],
    url: text.match(PATTERNS.url) || [],
    numbers: text.match(PATTERNS.number_standalone) || [],
  };
}

/**
 * Returns true if the text contains ANY sensitive data
 * that should not be sent to an external AI service.
 * Blocks: NIF/CIF/NIE, IBAN, email, phone, amounts, dates, times, URLs.
 */
export function containsHighRiskData(text: string): boolean {
  const tokens = extractSensitiveTokens(text);
  return (
    tokens.nif.length > 0 ||
    tokens.iban.length > 0 ||
    tokens.email.length > 0 ||
    tokens.phone.length > 0 ||
    tokens.amount.length > 0 ||
    tokens.date.length > 0 ||
    tokens.time.length > 0 ||
    tokens.url.length > 0
  );
}

/**
 * Compares protected tokens between original and corrected text.
 * Returns true if all protected tokens are preserved unchanged.
 */
export function protectedTokensPreserved(original: string, corrected: string): boolean {
  const origTokens = extractSensitiveTokens(original);
  const corrTokens = extractSensitiveTokens(corrected);

  // Check amounts are preserved exactly
  for (const amt of origTokens.amount) {
    if (!corrected.includes(amt)) return false;
  }

  // Check dates are preserved
  for (const d of origTokens.date) {
    if (!corrected.includes(d)) return false;
  }

  // Check times are preserved
  for (const t of origTokens.time) {
    if (!corrected.includes(t)) return false;
  }

  // Check phones are preserved (normalize spaces)
  for (const p of origTokens.phone) {
    const normalized = p.replace(/[\s.-]/g, "");
    const corrNormalized = corrected.replace(/[\s.-]/g, "");
    if (!corrNormalized.includes(normalized)) return false;
  }

  // Check standalone numbers (amounts without €) are preserved
  // Only check numbers > 2 digits to avoid false positives
  for (const n of origTokens.numbers) {
    if (n.length > 2 && !corrected.includes(n)) return false;
  }

  return true;
}

/**
 * Strips basic HTML tags from text to prevent injection.
 */
export function stripTags(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}

// Aliases for compatibility
export const hasSensitiveText = containsHighRiskData;
export const stripHtml = stripTags;

export function extractProtectedTokens(text: string): string[] {
  const tokens = extractSensitiveTokens(text);
  return [
    ...tokens.nif, ...tokens.email, ...tokens.phone,
    ...tokens.amount, ...tokens.date, ...tokens.time,
    ...tokens.iban, ...tokens.url,
  ];
}

export function protectedTokensChanged(original: string, corrected: string): boolean {
  return !protectedTokensPreserved(original, corrected);
}
