"use client";
import { useEffect, useState, type InputHTMLAttributes } from "react";
import { normalizeUnitPriceInput } from "@/lib/normalize-unit-price";
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "step"> & {
  value: number | string;
  onValueChange: (value: number, normalized: string) => void;
};
/** Keep editable text while calculations and API payloads use numbers. */
export function DecimalInput({ value, onValueChange, onBlur, ...props }: Props) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft((current) => {
      const normalized = normalizeUnitPriceInput(current);
      const incoming = value === "" ? 0 : Number(value);
      return normalized !== null && Number(normalized) === incoming ? current : String(value);
    });
  }, [value]);
  return (
    <input {...props} type="text" inputMode="decimal"
      pattern="[0-9]+([.,][0-9]{0,2})?" value={draft}
      onChange={(event) => {
        const raw = event.target.value;
        const normalized = normalizeUnitPriceInput(raw);
        if (normalized === null) return;
        const numeric = Number(normalized);
        const belowMin = props.min !== undefined && numeric < Number(props.min);
        const aboveMax = props.max !== undefined && numeric > Number(props.max);
        event.currentTarget.setCustomValidity(raw !== "" && (belowMin || aboveMax)
          ? "El importe debe estar entre " + (props.min ?? 0) + " y " + (props.max ?? "el máximo permitido")
          : "");
        setDraft(raw.startsWith(".") || raw.startsWith(",") ? "0" + raw : raw);
        onValueChange(numeric, normalized);
      }}
      onBlur={(event) => {
        if (draft !== "") {
          const normalized = normalizeUnitPriceInput(draft);
          if (normalized !== null) setDraft(Number(normalized).toFixed(2).replace(".", draft.includes(",") ? "," : "."));
        }
        onBlur?.(event);
      }}
    />
  );
}
