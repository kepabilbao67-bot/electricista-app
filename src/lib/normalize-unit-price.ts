/** Editable decimal price: comma or dot, at most two decimals, no rounding. */
export function normalizeUnitPriceInput(value: string): string | null {
  if (value === "") return "";
  if (!/^\d*(?:[.,]\d{0,2})?$/.test(value)) return null;
  const normalized = value.replace(",", ".");
  if (!Number.isFinite(Number(normalized))) return null;
  return normalized.startsWith(".") ? "0" + normalized : normalized;
}
