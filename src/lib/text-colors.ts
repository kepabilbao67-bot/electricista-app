export const TEXT_COLORS = [
  { value: "default", label: "Normal", className: "text-slate-900" },
  { value: "red", label: "Rojo", className: "text-red-700" },
  { value: "blue", label: "Azul", className: "text-blue-700" },
  { value: "green", label: "Verde", className: "text-green-700" },
  { value: "orange", label: "Naranja", className: "text-orange-700" },
  { value: "purple", label: "Morado", className: "text-purple-700" },
] as const;

export function getTextColorClass(color?: string | null): string {
  const found = TEXT_COLORS.find((c) => c.value === color);
  return found ? found.className : "text-slate-900";
}
