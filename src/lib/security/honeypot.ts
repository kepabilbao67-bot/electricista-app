export interface HoneypotValidationResult {
  isSpam: boolean;
  reason?: string;
}

export function validateHoneypot(
  honeypotValue?: string | null,
  submittedAtTimestamp?: number | null,
  minSubmissionTimeMs = 800
): HoneypotValidationResult {
  // 1. Campo trampa (Honeypot): si contiene texto, es un bot automatizado
  if (honeypotValue && honeypotValue.trim().length > 0) {
    return { isSpam: true, reason: "Honeypot field triggered" };
  }

  // 2. Control temporal: si se envía en menos tiempo del humanamente posible
  if (submittedAtTimestamp) {
    const elapsed = Date.now() - submittedAtTimestamp;
    if (elapsed < minSubmissionTimeMs) {
      return { isSpam: true, reason: "Form submitted unnaturally fast" };
    }
  }

  return { isSpam: false };
}
