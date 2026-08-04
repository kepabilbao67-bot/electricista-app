/**
 * Normalizes a unit price input value for work reports.
 *
 * Rules:
 * - Empty string: allowed (field being cleared)
 * - Whitespace only: rejected (null)
 * - Values 0.01..0.99: normalized to "1" (browser arrow from empty)
 * - Integer >= 1: accepted as-is
 * - Zero, negative, decimal >= 1, NaN, Infinity, non-numeric: rejected (null)
 *
 * Returns:
 * - The normalized string value to store in state
 * - null if the value should be rejected (state not updated)
 */
export function normalizeUnitPriceInput(value: string): string | null {
  // Allow emptying the field
  if (value === "") return "";

  // Reject whitespace-only
  if (value.trim() === "") return null;

  const n = Number(value);

  // Reject non-numeric, NaN, Infinity
  if (!Number.isFinite(n)) return null;

  // Reject zero and negatives
  if (n <= 0) return null;

  // Fractional values between 0 (exclusive) and 1 (exclusive): normalize to "1"
  // This handles browser arrows producing 0.01, 0.02, ..., 0.99 from empty
  if (n < 1) return "1";

  // Reject non-integer decimals >= 1 (e.g. 1.5, 2.3)
  if (!Number.isInteger(n)) return null;

  // Valid integer >= 1
  return String(n);
}
