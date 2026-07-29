"use client";

import { autocorrectSpanishOnBoundary, autocorrectSpanishText } from "@/lib/autocorrect-es";

interface AutocorrectInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
}

interface AutocorrectTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Input with soft Spanish autocorrection.
 * Corrects completed words on boundary characters and full text on blur.
 */
export function AutocorrectInput({ value, onChange, ...props }: AutocorrectInputProps) {
  return (
    <input
      {...props}
      value={value}
      onChange={(e) => onChange(autocorrectSpanishOnBoundary(e.target.value))}
      onBlur={(e) => {
        const corrected = autocorrectSpanishText(e.target.value);
        if (corrected !== e.target.value) onChange(corrected);
        props.onBlur?.(e);
      }}
    />
  );
}

/**
 * Textarea with soft Spanish autocorrection.
 */
export function AutocorrectTextarea({ value, onChange, ...props }: AutocorrectTextareaProps) {
  return (
    <textarea
      {...props}
      value={value}
      onChange={(e) => onChange(autocorrectSpanishOnBoundary(e.target.value))}
      onBlur={(e) => {
        const corrected = autocorrectSpanishText(e.target.value);
        if (corrected !== e.target.value) onChange(corrected);
        props.onBlur?.(e);
      }}
    />
  );
}
