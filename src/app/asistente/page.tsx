"use client";

import { useState } from "react";
import { Bot, Send, Check, AlertTriangle, User, FileText, Euro, Loader2, Mic, MicOff } from "lucide-react";
import { showToast } from "@/components/Toast";

interface BudgetLine {
  description: string;
  quantity: number;
  unit_price: number;
}

interface DraftPreview {
  clientNameHint: string | null;
  clientId: string | null;
  clientMatches: { id: string; name: string }[];
  items: BudgetLine[];
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  warnings: string[];
  missingFields: string[];
}

type FlowState = "idle" | "analyzing" | "preview" | "selecting_client" | "confirming" | "created" | "error";

export default function AsistentePage() {
  const [input, setInput] = useState("");
  const [state, setState] = useState<FlowState>("idle");
  const [preview, setPreview] = useState<DraftPreview | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [createdBudget, setCreatedBudget] = useState<{ id: string; number: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [listening, setListening] = useState(false);

  // Web Speech API (opcional)
  const speechSupported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  function startListening() {
    if (!speechSupported) return;
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: typeof window.SpeechRecognition; webkitSpeechRecognition?: typeof window.SpeechRecognition }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = "es-ES";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: { results: { item: (i: number) => { item: (j: number) => { transcript: string } } }; readonly length: number } & SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => (prev ? prev + " " + transcript : transcript));
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
    setListening(true);
  }

  async function analyze() {
    if (!input.trim()) return;
    setState("analyzing");
    setErrorMsg("");
    setPreview(null);
    setCreatedBudget(null);
    setSelectedClientId(null);

    try {
      const res = await fetch("/api/asistente/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: input.trim() }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setState("error");
        setErrorMsg(data.error || "No se pudo interpretar la orden.");
        return;
      }

      setPreview(data.preview);

      if (data.preview.clientMatches.length > 1) {
        setState("selecting_client");
      } else if (data.preview.clientMatches.length === 1) {
        setSelectedClientId(data.preview.clientMatches[0].id);
        setState("preview");
      } else {
        setState("preview");
      }
    } catch {
      setState("error");
      setErrorMsg("Error de conexión con el servidor.");
    }
  }

  function selectClient(clientId: string) {
    setSelectedClientId(clientId);
    setState("preview");
  }

  async function confirm() {
    if (!preview) return;
    setState("confirming");

    try {
      const res = await fetch("/api/asistente/confirm-budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClientId,
          items: preview.items,
          tax_rate: preview.taxRate,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setState("error");
        setErrorMsg(data.error || "Error al crear el presupuesto.");
        return;
      }

      setCreatedBudget({ id: data.id, number: data.number });
      setState("created");
      showToast("success", `Presupuesto ${data.number} creado correctamente.`);
    } catch {
      setState("error");
      setErrorMsg("Error de conexión al confirmar.");
    }
  }

  function reset() {
    setInput("");
    setState("idle");
    setPreview(null);
    setSelectedClientId(null);
    setCreatedBudget(null);
    setErrorMsg("");
  }

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-blue-700 shadow-lg">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="page-title">Asistente 360</h1>
            <p className="page-subtitle">Describe lo que necesitas y lo prepararé como borrador.</p>
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="card p-5 mb-6">
        <label htmlFor="assistant-input" className="text-sm font-medium text-slate-600 mb-2 block">
          Describe tu orden (ejemplo: &ldquo;Presupuesto para Juan García, 6 horas a 35 euros de mano de obra&rdquo;)
        </label>
        <div className="flex gap-2">
          <textarea
            id="assistant-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); analyze(); } }}
            placeholder="Escribe o dicta tu orden aquí..."
            className="flex-1 rounded-lg border border-slate-200 px-4 py-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
            rows={3}
            disabled={state === "analyzing" || state === "confirming"}
          />
          <div className="flex flex-col gap-2">
            {speechSupported && (
              <button
                type="button"
                onClick={startListening}
                disabled={listening || state === "analyzing"}
                className={`rounded-lg p-3 transition-colors ${listening ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                title={listening ? "Escuchando..." : "Dictar por voz"}
              >
                {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
            )}
            <button
              type="button"
              onClick={analyze}
              disabled={!input.trim() || state === "analyzing" || state === "confirming"}
              className="rounded-lg bg-blue-700 px-4 py-3 text-white font-medium text-sm hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {state === "analyzing" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Client selection */}
      {state === "selecting_client" && preview && (
        <div className="card p-5 mb-6 border-amber-200 bg-amber-50">
          <div className="flex items-center gap-2 mb-3">
            <User className="h-5 w-5 text-amber-600" />
            <h2 className="text-sm font-semibold text-amber-800">Varios clientes coinciden con &ldquo;{preview.clientNameHint}&rdquo;</h2>
          </div>
          <p className="text-xs text-amber-700 mb-3">Selecciona el cliente correcto:</p>
          <div className="space-y-2">
            {preview.clientMatches.map((client) => (
              <button
                key={client.id}
                onClick={() => selectClient(client.id)}
                className="w-full text-left rounded-lg border border-amber-200 bg-white px-4 py-2.5 text-sm hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                {client.name}
              </button>
            ))}
            <button
              onClick={() => { setSelectedClientId(null); setState("preview"); }}
              className="w-full text-left rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-500 hover:border-slate-400 transition-colors"
            >
              Continuar sin asignar cliente
            </button>
          </div>
        </div>
      )}

      {/* Preview */}
      {(state === "preview" || state === "confirming") && preview && (
        <div className="card p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-700" />
              <h2 className="text-lg font-semibold text-slate-900">Vista previa del presupuesto</h2>
            </div>
            <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-800">
              BORRADOR — REQUIERE CONFIRMACIÓN
            </span>
          </div>

          {/* Cliente */}
          <div className="mb-4 p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-xs font-medium text-slate-500 uppercase">Cliente</span>
            <p className="text-sm font-medium text-slate-800 mt-0.5">
              {preview.clientMatches.length === 1
                ? preview.clientMatches[0].name
                : selectedClientId
                  ? preview.clientMatches.find((c) => c.id === selectedClientId)?.name
                  : preview.clientNameHint || "Sin asignar"}
            </p>
          </div>

          {/* Líneas */}
          <div className="mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500 uppercase">
                  <th className="pb-2">Concepto</th>
                  <th className="pb-2 text-right">Cant.</th>
                  <th className="pb-2 text-right">Precio</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {preview.items.map((item, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2 text-slate-800">{item.description}</td>
                    <td className="py-2 text-right text-slate-600">{item.quantity}</td>
                    <td className="py-2 text-right text-slate-600">{item.unit_price.toFixed(2)} €</td>
                    <td className="py-2 text-right font-medium text-slate-800">{(item.quantity * item.unit_price).toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totales */}
          <div className="flex flex-col items-end gap-1 mb-4">
            <div className="flex gap-8 text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium text-slate-800">{preview.subtotal.toFixed(2)} €</span>
            </div>
            <div className="flex gap-8 text-sm">
              <span className="text-slate-500">IVA ({preview.taxRate}%)</span>
              <span className="font-medium text-slate-800">{preview.taxAmount.toFixed(2)} €</span>
            </div>
            <div className="flex gap-8 text-base border-t border-slate-200 pt-2 mt-1">
              <span className="font-semibold text-slate-700">Total</span>
              <span className="font-bold text-blue-800">{preview.total.toFixed(2)} €</span>
            </div>
          </div>

          {/* Warnings */}
          {preview.warnings.length > 0 && (
            <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-100">
              {preview.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Missing fields */}
          {preview.missingFields.length > 0 && (
            <div className="mb-4 p-3 rounded-lg bg-slate-50 border border-slate-100">
              <p className="text-xs text-slate-500">Datos no detectados: {preview.missingFields.join(", ")}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={confirm}
              disabled={state === "confirming"}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {state === "confirming" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Confirmar y crear presupuesto
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={state === "confirming"}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Success */}
      {state === "created" && createdBudget && (
        <div className="card p-5 mb-6 border-emerald-200 bg-emerald-50">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
              <Check className="h-5 w-5 text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold text-emerald-800">Presupuesto creado</h2>
          </div>
          <p className="text-sm text-emerald-700 mb-4">
            Se ha creado el presupuesto <strong>{createdBudget.number}</strong> en estado borrador.
          </p>
          <div className="flex gap-3">
            <a
              href={`/presupuestos/${createdBudget.id}`}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
            >
              <FileText className="h-4 w-4" />
              Ver presupuesto
            </a>
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              Nueva orden
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {state === "error" && (
        <div className="card p-5 mb-6 border-red-200 bg-red-50">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h2 className="text-sm font-semibold text-red-800">No se pudo completar</h2>
          </div>
          <p className="text-sm text-red-700 mb-3">{errorMsg}</p>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
          >
            Intentar de nuevo
          </button>
        </div>
      )}

      {/* Info */}
      {state === "idle" && (
        <div className="card-static p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Órdenes que puedo entender</h3>
          <ul className="space-y-1.5 text-xs text-slate-500">
            <li className="flex items-center gap-2"><Euro className="h-3.5 w-3.5 text-blue-500" />Crear presupuestos: &ldquo;Presupuesto para [cliente], [cantidad] horas a [precio] euros de [concepto]&rdquo;</li>
            <li className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-emerald-500" />Más intenciones próximamente: facturas, visitas, gastos...</li>
          </ul>
          <p className="text-[10px] text-slate-400 mt-3">Toda acción económica requiere tu confirmación explícita antes de ejecutarse.</p>
        </div>
      )}
    </div>
  );
}
