"use client";

import { TEXT_COLORS, getTextColorClass } from "@/lib/text-colors";

interface ColorSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  label?: string;
  disabled?: boolean;
}

export default function ColorSelect({ value, onChange, className = "", label = "Color del texto", disabled = false }: ColorSelectProps) {
  return (
    <select
      disabled={disabled}
      value={value || "default"}
      onChange={(e) => onChange(e.target.value)}
      className={`input-field w-24 text-xs ${getTextColorClass(value)} ${className}`}
      title={label}
      aria-label={label}
    >
      {TEXT_COLORS.map((c) => (
        <option key={c.value} value={c.value}>{c.label}</option>
      ))}
    </select>
  );
}
