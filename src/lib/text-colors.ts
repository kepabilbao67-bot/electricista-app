export const TEXT_COLORS = [
  { value: "default", label: "Normal", className: "" },
  { value: "red", label: "Rojo", className: "writing-color-red" },
  { value: "blue", label: "Azul", className: "writing-color-blue" },
  { value: "green", label: "Verde", className: "writing-color-green" },
  { value: "orange", label: "Naranja", className: "writing-color-orange" },
  { value: "purple", label: "Morado", className: "writing-color-purple" },
] as const;

export function getTextColorClass(color?: string | null): string {
  const found = TEXT_COLORS.find((c) => c.value === color);
  return found ? found.className : "";
}

export function normalizeTextColor(value: unknown): string { return typeof value === "string" && TEXT_COLORS.some(c => c.value === value) ? value : "default"; }
