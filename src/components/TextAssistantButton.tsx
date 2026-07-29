"use client";

import { useState } from "react";
import { Wand2, X, Check, Loader2 } from "lucide-react";

interface TextAssistantButtonProps {
  value: string;
  onAccept: (newText: string) => void;
  mode?: "CORREGIR";
  label?: string;
  className?: string;
}

export default function TextAssistantButton({
  value,
  onAccept,
  mode = "CORREGIR",
  label = "Corregir texto",
  className = "",
}: TextAssistantButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [corrected, setCorrected] = useState("");
  const [error, setError] = useState("");

  const canCorrect = value.trim().length >= 8;

  const handleCorrect = async () => {
    setOpen(true);
    setLoading(true);
    setError("");
    setCorrected("");

    try {
      const res = await fetch("/api/text-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value, mode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al corregir el texto.");
        setLoading(false);
        return;
      }

      if (data.corrected?.startsWith("ERROR:")) {
        setError(data.corrected);
        setLoading(false);
        return;
      }

      setCorrected(data.corrected || "");
    } catch {
      setError("Error de conexión. Comprueba tu internet.");
    }
    setLoading(false);
  };

  const handleAccept = () => {
    if (corrected) onAccept(corrected);
    setOpen(false);
    setCorrected("");
    setError("");
  };

  const handleCancel = () => {
    setOpen(false);
    setCorrected("");
    setError("");
  };

  return (
    <>
      <button
        type="button"
        onClick={handleCorrect}
        disabled={!canCorrect}
        className={`inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors print:hidden ${className}`}
        title={canCorrect ? "Corregir ortografía y gramática con IA" : "Escribe al menos 8 caracteres"}
      >
        <Wand2 className="h-3 w-3" />
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg mx-4 p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Corregir texto</h3>
              <button onClick={handleCancel} className="p-1 rounded hover:bg-slate-100"><X className="h-4 w-4 text-slate-500" /></button>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <span className="ml-2 text-sm text-slate-500">Corrigiendo...</span>
              </div>
            )}

            {error && !loading && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                {error}
              </div>
            )}

            {corrected && !loading && (
              <>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Texto original</p>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 whitespace-pre-wrap">{value}</div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Texto corregido</p>
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-slate-900 whitespace-pre-wrap">{corrected}</div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400">Revisa el resultado antes de aceptar. La IA puede cometer errores. No se modifican importes ni datos fiscales.</p>
              </>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={handleCancel} className="px-3 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                Cancelar
              </button>
              {corrected && !loading && (
                <button type="button" onClick={handleAccept} className="px-3 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 inline-flex items-center gap-1">
                  <Check className="h-3 w-3" /> Aceptar corrección
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
