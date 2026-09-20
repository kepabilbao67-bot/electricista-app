"use client";

import { useState } from "react";
import { Check, Mic, Pencil, RotateCcw, Save, Trash2 } from "lucide-react";
import VoiceDictation from "@/components/VoiceDictation";
import type { VoiceOrderDraft, VoiceOrderItem } from "@/lib/voice-order-parser";

export default function VoiceOrdersPage() {
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<VoiceOrderDraft | null>(null);
  const [observations, setObservations] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState("");

  async function interpret(transcript = text) {
    const normalized = transcript.trim();
    if (!normalized) {
      setError("Di o escribe un pedido antes de interpretarlo.");
      return;
    }

    setText(normalized);
    setLoading(true);
    setError("");
    setSavedId("");
    try {
      const response = await fetch("/api/pedidos-voz/interpretar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: normalized }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudo interpretar el pedido");
      setDraft(body);
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo interpretar el pedido");
    } finally {
      setLoading(false);
    }
  }

  function updateItem(index: number, patch: Partial<VoiceOrderItem>) {
    setDraft((current) => current ? {
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    } : current);
  }

  function removeItem(index: number) {
    setDraft((current) => current ? {
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index),
    } : current);
  }

  async function confirmOrder() {
    if (!draft || draft.items.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/pedidos-voz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, observations }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudo guardar el pedido");
      setSavedId(body.id);
      setDraft(null);
      setText("");
      setObservations("");
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el pedido");
    } finally {
      setLoading(false);
    }
  }

  function cancelOrder() {
    setDraft(null);
    setText("");
    setObservations("");
    setEditing(false);
    setError("");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-10">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-400">Electricista 360</p>
        <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">Pedido por voz</h1>
        <p className="mt-2 text-sm text-slate-300">Dicta materiales, revisa el resultado y confirma para guardarlo.</p>
      </header>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 shadow-xl sm:p-6">
        <label htmlFor="voice-order-text" className="text-sm font-semibold text-slate-100">¿Qué necesitas?</label>
        <textarea
          id="voice-order-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={4}
          disabled={loading || Boolean(draft)}
          placeholder="Ej.: Necesito 3 cajas de guantes talla L, 20 metros de cable de 2,5 y dos diferenciales de 40 amperios para mañana."
          className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-base text-white outline-none placeholder:text-slate-500 focus:border-blue-500 disabled:opacity-70"
        />

        {!draft && (
          <div className="mt-4 flex flex-wrap gap-3">
            <VoiceDictation
              onTranscriptComplete={(transcript) => void interpret(transcript)}
              disabled={loading}
              className="min-h-12 px-5 py-3 text-base"
            />
            <button
              type="button"
              onClick={() => void interpret()}
              disabled={loading || !text.trim()}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Mic className="h-5 w-5" />
              {loading ? "Interpretando…" : "Interpretar pedido"}
            </button>
          </div>
        )}
      </section>

      {error && <p role="alert" className="rounded-xl border border-rose-800 bg-rose-950/60 p-3 text-sm text-rose-200">{error}</p>}
      {savedId && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-700 bg-emerald-950/50 p-4 text-emerald-100">
          <Check className="h-5 w-5 shrink-0" />
          <div><p className="font-semibold">Pedido guardado</p><p className="text-xs text-emerald-300">Referencia {savedId}</p></div>
        </div>
      )}

      {draft && (
        <section className="space-y-4 rounded-2xl border border-blue-700/70 bg-slate-900 p-4 shadow-xl sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Pendiente de confirmar</p>
              <h2 className="mt-1 text-xl font-bold text-white">Revisa el pedido</h2>
            </div>
            {!editing && <span className="rounded-full bg-amber-400/15 px-3 py-1 text-xs text-amber-200">Aún no guardado</span>}
          </div>

          <div className="space-y-3">
            {draft.items.map((item, index) => (
              <article key={index} className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                {editing ? (
                  <div className="grid grid-cols-[5rem_6rem_1fr_auto] gap-2 max-sm:grid-cols-2">
                    <input aria-label={`Cantidad ${index + 1}`} type="number" min="0.01" step="any" value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-white" />
                    <input aria-label={`Unidad ${index + 1}`} value={item.unit} onChange={(event) => updateItem(index, { unit: event.target.value })} className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-white" />
                    <input aria-label={`Producto ${index + 1}`} value={item.product} onChange={(event) => updateItem(index, { product: event.target.value })} className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-white max-sm:col-span-2" />
                    <button type="button" onClick={() => removeItem(index)} aria-label={`Eliminar producto ${index + 1}`} className="rounded-lg p-2 text-rose-300 hover:bg-rose-950 max-sm:col-start-2 max-sm:row-start-1 max-sm:justify-self-end"><Trash2 className="h-5 w-5" /></button>
                    <input aria-label={`Observaciones ${index + 1}`} value={item.observations} onChange={(event) => updateItem(index, { observations: event.target.value })} placeholder="Observaciones" className="col-span-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-white" />
                  </div>
                ) : (
                  <div className="flex items-baseline gap-3">
                    <span className="min-w-20 font-bold text-blue-300">{item.quantity} {item.unit}</span>
                    <div><p className="font-semibold text-white">{item.product}</p>{item.observations && <p className="text-sm text-slate-400">{item.observations}</p>}</div>
                  </div>
                )}
              </article>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-slate-300">Fecha necesaria
              <input type="date" value={draft.neededDate || ""} disabled={!editing} onChange={(event) => setDraft({ ...draft, neededDate: event.target.value || null, neededDateLabel: event.target.value || "Sin fecha" })} className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 p-2.5 text-white disabled:opacity-75" />
            </label>
            <label className="text-sm text-slate-300">Observaciones generales
              <input value={observations} disabled={!editing} onChange={(event) => setObservations(event.target.value)} placeholder="Opcional" className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 p-2.5 text-white disabled:opacity-75" />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button type="button" onClick={() => void confirmOrder()} disabled={loading || editing || draft.items.length === 0} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"><Save className="h-5 w-5" />{loading ? "Guardando…" : "Confirmar"}</button>
            <button type="button" onClick={() => setEditing((value) => !value)} disabled={loading} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-blue-500 px-4 py-3 font-semibold text-blue-200 hover:bg-blue-950"><Pencil className="h-5 w-5" />{editing ? "Terminar cambios" : "Modificar"}</button>
            <button type="button" onClick={cancelOrder} disabled={loading} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-600 px-4 py-3 font-semibold text-slate-200 hover:bg-slate-800"><RotateCcw className="h-5 w-5" />Cancelar</button>
          </div>
        </section>
      )}
    </div>
  );
}
