export interface PhoneValidationResult {
  valid: boolean;
  international?: string;
  error?: string;
}

export function normalizePhoneForWhatsApp(input: string, defaultCountryCode = "34"): PhoneValidationResult {
  const raw = input.trim();
  if (!raw) return { valid: false, error: "El cliente no tiene teléfono" };
  const hadInternationalPrefix = raw.startsWith("+") || raw.startsWith("00");
  let digits = raw.replace(/\D/g, "");
  if (raw.startsWith("00")) digits = digits.slice(2);
  if (!hadInternationalPrefix && digits.length === 9 && /^[6789]/.test(digits)) {
    digits = `${defaultCountryCode}${digits}`;
  } else if (!hadInternationalPrefix && !digits.startsWith(defaultCountryCode)) {
    return { valid: false, error: "Añade el prefijo internacional, por ejemplo +34" };
  }
  if (!/^[1-9]\d{7,14}$/.test(digits)) {
    return { valid: false, error: "El teléfono no tiene un formato internacional válido" };
  }
  return { valid: true, international: digits };
}

export function buildWhatsAppUrl(phone: string, message = ""): PhoneValidationResult & { url?: string } {
  const result = normalizePhoneForWhatsApp(phone);
  if (!result.valid || !result.international) return result;
  const suffix = message ? `?text=${encodeURIComponent(message)}` : "";
  return { ...result, url: `https://wa.me/${result.international}${suffix}` };
}
