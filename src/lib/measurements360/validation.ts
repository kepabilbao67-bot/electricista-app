export type MeasurementCalcMode =
  | "perimeter"
  | "area"
  | "volume"
  | "circle"
  | "cylinder"
  | "sum"
  | "cable";

export interface CalculatorInput {
  a: string;
  b: string;
  c: string;
  reserve: string;
}

function parseNonNegative(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function validateCalculatorInput(
  mode: MeasurementCalcMode,
  input: CalculatorInput,
): { ok: boolean; message: string } {
  const a = parseNonNegative(input.a);
  const b = parseNonNegative(input.b);
  const c = parseNonNegative(input.c);
  const reserve = parseNonNegative(input.reserve);

  if (a == null) return { ok: false, message: "Introduce una Medida A válida." };

  if (mode === "circle") {
    return a > 0
      ? { ok: true, message: "" }
      : { ok: false, message: "El radio debe ser mayor que cero." };
  }

  if (mode === "cable") {
    if (a <= 0) return { ok: false, message: "La longitud base debe ser mayor que cero." };
    if (reserve == null) return { ok: false, message: "Introduce una reserva válida." };
    return { ok: true, message: "" };
  }

  if (mode === "sum") {
    const values = [a, b, c].filter((value): value is number => value != null);
    return values.some((value) => value > 0)
      ? { ok: true, message: "" }
      : { ok: false, message: "Introduce al menos una longitud mayor que cero." };
  }

  if (b == null || b <= 0) {
    return {
      ok: false,
      message: mode === "cylinder" ? "La altura debe ser mayor que cero." : "La Medida B debe ser mayor que cero.",
    };
  }

  if (a <= 0) {
    return {
      ok: false,
      message: mode === "cylinder" ? "El radio debe ser mayor que cero." : "La Medida A debe ser mayor que cero.",
    };
  }

  if (mode === "volume") {
    return c != null && c > 0
      ? { ok: true, message: "" }
      : { ok: false, message: "La Medida C debe ser mayor que cero." };
  }

  return { ok: true, message: "" };
}
