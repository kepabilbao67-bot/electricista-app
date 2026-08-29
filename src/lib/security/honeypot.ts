export interface HoneypotValidationResult {
  isSpam: boolean;
  reason?: string;
}

export function validateHoneypot(
  honeypotValue?: unknown,
  submittedAtTimestamp?: number | null,
  minSubmissionTimeMs = 800
): HoneypotValidationResult {
  // 1. Campo trampa (Honeypot): si contiene datos (string, objeto, array o número), es un bot automatizado
  if (honeypotValue !== undefined && honeypotValue !== null && honeypotValue !== "") {
    if (typeof honeypotValue === "string") {
      if (honeypotValue.trim().length > 0) {
        return { isSpam: true, reason: "Honeypot field triggered" };
      }
    } else {
      return { isSpam: true, reason: "Honeypot field triggered" };
    }
  }

  // 2. Control temporal: si se envía en menos tiempo del humanamente posible o con timestamp futuro
  if (typeof submittedAtTimestamp === "number" && !isNaN(submittedAtTimestamp)) {
    const elapsed = Date.now() - submittedAtTimestamp;
    if (elapsed < 0 || elapsed < minSubmissionTimeMs) {
      return { isSpam: true, reason: "Form submitted unnaturally fast" };
    }
  }

  return { isSpam: false };
}
