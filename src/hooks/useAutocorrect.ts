import { autocorrectSpanishOnBoundary, autocorrectSpanishText } from "@/lib/autocorrect-es";

/**
 * Returns onChange and onBlur handlers that apply soft Spanish autocorrection.
 * - onChange: corrects completed words (before last boundary)
 * - onBlur: corrects the full text
 *
 * Usage:
 *   const ac = useAutocorrectHandlers(value, setValue);
 *   <input value={value} onChange={ac.onChange} onBlur={ac.onBlur} />
 */
export function createAutocorrectHandlers(
  setValue: (val: string) => void
) {
  return {
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const raw = e.target.value;
      const corrected = autocorrectSpanishOnBoundary(raw);
      setValue(corrected);
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const raw = e.target.value;
      const corrected = autocorrectSpanishText(raw);
      if (corrected !== raw) {
        setValue(corrected);
      }
    },
  };
}
