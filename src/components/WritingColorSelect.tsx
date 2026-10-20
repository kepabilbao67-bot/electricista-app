"use client";

import { getTextColorClass } from "@/lib/text-colors";

export type WritingColor = "default" | "blue" | "red" | "green";

const OPTIONS: { value: WritingColor; label: string; swatch: string }[] = [
  { value: "default", label: "Negro", swatch: "#111827" },
  { value: "blue", label: "Azul", swatch: "#1d4ed8" },
  { value: "red", label: "Rojo", swatch: "#b91c1c" },
  { value: "green", label: "Verde", swatch: "#15803d" },
];

/** Reusable, accessible writing-color selector for editable document fields.
 * The parent owns persistence: never interpret this component as a saved color.
 */
export default function WritingColorSelect({
  value,
  onChange,
  id,
}: {
  value: WritingColor;
  onChange: (value: WritingColor) => void;
  id?: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
      Color de escritura
      <select
        id={id}
        aria-label="Color de escritura"
        value={value}
        onChange={(event) => onChange(event.target.value as WritingColor)}
        className={`input-field w-auto ${getTextColorClass(value)}`}
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
