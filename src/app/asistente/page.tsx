"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Check,
  RefreshCw,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  Mic,
  X,
} from "lucide-react";
import VoiceDictation from "@/components/VoiceDictation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import type { Voice360Draft, Voice360PendingAction } from "@/lib/assistant/types";

interface Totals {
  subtotal: number;
  tax_amount: number;
  total: number;
  incomplete: string[];
}

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  result?: unknown;
}

const SUGGESTIONS = [
  "Hazme un presupuesto de 4 enchufes a 18 euros",
  "¿Qué partes de trabajo tengo?",
  "Busca el cliente García",
  "¿Qué facturas tengo pendientes?",
];

export default function Voice360Page() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Soy Voz 360 para Electricista360. Habla o escribe. Preparo los cambios como borrador y pido confirmación antes de guardar.",
    },
  ]);
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<Voice360Draft | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [pending, setPending] = useState<Voice360PendingAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [speak, setSpeak] = useState(false);
  const [online, setOnline] = useState(true);
  const [showDraft, setShowDraft] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Online / Offline detection
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, draft]);

  // Mostrar panel de borrador automáticamente cuando hay un draft
  useEffect(() => {
    if (draft && draft.items.length > 0) setShowDraft(true);
  }, [draft]);

  function readAloud(text: string) {
    if (!speak || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      text.replace(/[*#_`]/g, "").replace(/\n+/g, ". ")
    );
    utterance.lang = "es-ES";
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }

  async function send(textValue = input) {
    const text = textValue.trim();
    console.log("[SEND_CLICK] click recibido, texto:", text);
    if (!text || loading) {
      console.log("[SEND_SKIP] ignorado porque text vacio o loading", { text, loading });
      return;
    }
    console.log("[DIAG_APIS]", {
      isSecureContext: typeof window !== "undefined" ? window.isSecureContext : false,
      cryptoRandomUUID: typeof crypto !== "undefined" ? typeof crypto.randomUUID : "no crypto",
      SpeechRecognition: typeof window !== "undefined" ? typeof (window as any).SpeechRecognition : "undefined",
      webkitSpeechRecognition: typeof window !== "undefined" ? typeof (window as any).webkitSpeechRecognition : "undefined",
      getUserMedia: typeof navigator !== "undefined" && navigator.mediaDevices ? typeof navigator.mediaDevices.getUserMedia : "undefined",
      speechSynthesis: typeof window !== "undefined" ? typeof window.speechSynthesis : "undefined",
    });

    try {
      const msgId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : "msg-" + Date.now() + "-" + Math.random().toString(36).slice(2);

      setMessages((current) => [
        ...current,
        { id: msgId, role: "user", text },
      ]);
      setInput("");
      setLoading(true);
      setError("");
      setPending(null);

      console.log("[FETCH_INIT] POST /api/asistente/voice360");
      const response = await fetch("/api/asistente/voice360", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: text, draft }),
      });
      console.log("[FETCH_RES] status:", response.status);
      const data = await response.json();
      console.log("[FETCH_DATA]", data);

      if (!response.ok)
        throw new Error(data.error || "No se pudo procesar la orden");
      setDraft(data.draft ?? null);
      setTotals(data.totals ?? null);
      setPending(data.pending_action ?? null);

      const assistantId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : "msg-" + Date.now() + "-" + Math.random().toString(36).slice(2);

      setMessages((current) => [
        ...current,
        {
          id: assistantId,
          role: "assistant",
          text: data.answer,
          result: data.result,
        },
      ]);
      readAloud(data.answer);
    } catch (cause) {
      console.error("[SEND_ERROR] error exacto:", cause);
      setError(
        cause instanceof Error ? `[DIAG] ${cause.name}: ${cause.message}` : "Error de conexión"
      );
    } finally {
      setLoading(false);
    }
  }

  async function confirmAction() {
    if (!pending || loading) return;
    const action = pending;
    setPending(null);
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/asistente/voice360", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm_token: action.token }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "No se pudo confirmar la acción");
      setDraft(null);
      setTotals(null);
      setShowDraft(false);
      setMessages((current) => [
        ...current,
        {
          id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : "msg-" + Date.now(),
          role: "assistant",
          text: data.answer,
          result: data.result,
        },
      ]);
      readAloud(data.answer);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Error al confirmar"
      );
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    window.speechSynthesis?.cancel();
    setDraft(null);
    setTotals(null);
    setPending(null);
    setInput("");
    setError("");
    setShowDraft(false);
    setMessages([
      {
        id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : "msg-welcome",
        role: "assistant",
        text: "Nueva conversación. ¿Qué necesitas?",
      },
    ]);
  }

  // Panel de borrador (overlay en móvil, columna en desktop)
  const draftPanel = (
    <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 space-y-3">
      {/* Header del borrador */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-white text-sm">📋 Borrador activo</h2>
        <div className="flex items-center gap-2">
          {draft && (
            <span className="text-xs text-slate-400">v{draft.revision}</span>
          )}
          <button
            type="button"
            onClick={() => setShowDraft(false)}
            className="lg:hidden rounded-lg border border-slate-700 p-1 text-slate-400"
            aria-label="Cerrar borrador"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!draft ? (
        <p className="text-sm text-slate-400">
          Aún no hay borrador. Las consultas no modifican datos.
        </p>
      ) : (
        <>
          {/* Cliente */}
          <div className="rounded-xl bg-slate-950 p-3 text-sm text-slate-300">
            <p>
              <strong>Cliente:</strong>{" "}
              {draft.client_name || (
                <span className="text-amber-300">Sin indicar</span>
              )}
            </p>
            {draft.client_candidates.length > 1 && (
              <p className="mt-1 text-xs text-amber-300">
                Posibles coincidencias:{" "}
                {draft.client_candidates
                  .map((c, i) => `${i + 1}. ${c.name}`)
                  .join(" · ")}
              </p>
            )}
          </div>

          {/* Líneas */}
          <div className="space-y-2">
            {draft.items.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-700 p-3 text-sm"
              >
                <p className="font-medium text-white leading-snug">
                  {item.quantity} {item.unit} · {item.description}
                </p>
                <p
                  className={
                    item.unit_price === null
                      ? "text-amber-300 text-xs mt-0.5"
                      : "text-emerald-300 text-xs mt-0.5"
                  }
                >
                  {item.unit_price === null
                    ? "Precio pendiente"
                    : `${item.unit_price.toFixed(2)} €/ud · Subtotal: ${(item.unit_price * item.quantity).toFixed(2)} €`}
                </p>
              </div>
            ))}
          </div>

          {/* Totales */}
          {totals && (
            <div className="rounded-xl bg-slate-950 p-3 text-sm text-slate-300 space-y-0.5">
              <p>Base imponible: {totals.subtotal.toFixed(2)} €</p>
              <p>
                IVA ({draft.tax_rate}%): {totals.tax_amount.toFixed(2)} €
              </p>
              {totals.incomplete.length > 0 && (
                <p className="text-amber-300 text-xs">
                  ⚠️ Precio pendiente: {totals.incomplete.join(", ")}
                </p>
              )}
              <p className="mt-1 text-xl font-black text-white">
                Total: {totals.total.toFixed(2)} €
              </p>
            </div>
          )}
        </>
      )}

      {/* Acción de confirmación */}
      {pending && (
        <div className="rounded-xl border border-amber-600 bg-amber-950/40 p-3">
          <p className="text-xs font-bold uppercase text-amber-300 mb-1">
            ⚠️ Confirmación requerida
          </p>
          <p className="text-sm text-white mb-3 whitespace-pre-line">
            {pending.label}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={loading}
              onClick={() => void confirmAction()}
              className="inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-sm font-bold text-white disabled:opacity-50 active:scale-95 transition-transform"
            >
              <Check className="h-4 w-4" />
              Confirmar
            </button>
            <button
              onClick={() => setPending(null)}
              className="min-h-[48px] rounded-xl border border-slate-600 px-3 text-sm text-slate-200 active:scale-95 transition-transform"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-3 pb-24">
      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div>
          <Breadcrumbs items={[{ label: "Asistente Voz 360" }]} />
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-black text-white sm:text-3xl">
            <Sparkles className="text-emerald-400" />
            Voz 360
          </h1>
          <p className="mt-0.5 text-xs text-slate-400">
            Electricista360 · Nada se guarda sin tu confirmación
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Estado online/offline */}
          <span
            className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
              online
                ? "bg-emerald-900/50 text-emerald-300"
                : "bg-rose-900/50 text-rose-300"
            }`}
          >
            {online ? (
              <Wifi className="h-3 w-3" />
            ) : (
              <WifiOff className="h-3 w-3" />
            )}
            <span className="hidden sm:inline">
              {online ? "Online" : "Sin conexión"}
            </span>
          </span>

          {/* TTS toggle */}
          <button
            type="button"
            onClick={() => setSpeak((v) => !v)}
            className="rounded-xl border border-slate-700 p-2.5 text-slate-300 hover:border-slate-500 transition-colors"
            aria-label="Respuesta por voz"
          >
            {speak ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
          </button>

          {/* Nueva conversación */}
          <button
            type="button"
            onClick={reset}
            className="rounded-xl border border-slate-700 p-2.5 text-slate-300 hover:border-slate-500 transition-colors"
            aria-label="Nueva conversación"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          {/* Mostrar borrador en móvil */}
          {draft && (
            <button
              type="button"
              onClick={() => setShowDraft((v) => !v)}
              className="lg:hidden rounded-xl border border-emerald-700 bg-emerald-900/40 px-3 py-2 text-xs font-medium text-emerald-300"
            >
              Borrador
            </button>
          )}
        </div>
      </header>

      {/* Sugerencias rápidas */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            disabled={loading}
            onClick={() => void send(s)}
            className="shrink-0 rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 hover:border-emerald-600 hover:text-emerald-300 transition-colors disabled:opacity-40"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Layout principal */}
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        {/* Panel de chat */}
        <section className="flex min-h-[32rem] flex-col rounded-2xl border border-slate-700 bg-slate-900/90 p-3 sm:p-5">
          {/* Mensajes */}
          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-2 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "assistant" && (
                  <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-700">
                    <Bot className="h-4 w-4" />
                  </span>
                )}
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                    message.role === "user"
                      ? "bg-emerald-700 text-white"
                      : "border border-slate-700 bg-slate-800 text-slate-200"
                  }`}
                >
                  {message.text}
                  {Array.isArray(message.result) && (
                    <div className="mt-2 space-y-1 border-t border-slate-600 pt-2 text-xs">
                      {(message.result as Record<string, unknown>[]).map(
                        (row, i) => (
                          <div key={i}>
                            {Object.entries(row)
                              .filter(([, v]) => v !== null)
                              .map(([k, v]) => `${k}: ${String(v)}`)
                              .join(" · ")}
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2 justify-start">
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-700">
                  <Bot className="h-4 w-4" />
                </span>
                <div className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-2 w-2 rounded-full bg-emerald-400 animate-bounce"
                        style={{ animationDelay: `${i * 120}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Error */}
          {error && (
            <p
              role="alert"
              className="mt-3 rounded-xl bg-rose-950 p-3 text-sm text-rose-200"
            >
              ⚠️ {error}
            </p>
          )}

          {/* Formulario */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="mt-4 border-t border-slate-700 pt-3"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              disabled={loading}
              rows={2}
              placeholder="Habla o escribe tu orden…"
              className="w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-base text-white outline-none focus:border-emerald-500 resize-none"
            />
            <div className="mt-2 flex gap-2">
              {/* Botón de voz — grande para móvil */}
              <VoiceDictation
                onTranscriptComplete={(transcript) => {
                  setInput(transcript);
                  // Auto-enviar en móvil si hay transcripción
                  void send(transcript);
                }}
                disabled={loading}
                className="min-h-[52px] px-5 text-sm flex-shrink-0"
              />
              <button
                disabled={loading || !input.trim()}
                className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 font-bold text-white disabled:opacity-50 active:scale-95 transition-transform"
              >
                <Send className="h-4 w-4" />
                Enviar
              </button>
            </div>
          </form>
        </section>

        {/* Panel de borrador — visible en desktop siempre, en móvil sólo cuando showDraft */}
        <div className={`${showDraft ? "block" : "hidden"} lg:block`}>
          {draftPanel}
        </div>
      </div>

      {/* Nota de estado offline */}
      {!online && (
        <div className="rounded-xl border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">
          <WifiOff className="inline h-4 w-4 mr-1" />
          Sin conexión. El asistente no puede procesar órdenes hasta que se restablezca la conexión.
        </div>
      )}

      {/* Indicador de proyecto */}
      <p className="text-center text-xs text-slate-600">
        Electricista360 · Voz 360 · Motor autónomo local
      </p>
    </div>
  );
}
