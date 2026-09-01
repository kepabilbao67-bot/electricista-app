"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Send,
  Sparkles,
  RefreshCw,
  FileText,
  Calendar,
  UserPlus,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Button } from "@/components/ui/Button";
import { showToast } from "@/components/Toast";

interface DraftPayload {
  type: "budget" | "visit" | "client";
  payload: Record<string, any>;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  source?: string;
  draft?: DraftPayload;
  timestamp: string;
}

const QUICK_CHIPS = [
  "¿A quién tengo que llamar hoy?",
  "¿Qué oportunidades están más calientes?",
  "¿Qué reuniones tengo esta semana?",
  "Facturas pendientes o vencidas",
  "Borrador de presupuesto para cambiar diferencial a Juan Pérez",
  "Agendar visita con María García para mañana a las 10:00",
];

export default function AsistenteCopilotPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      role: "assistant",
      content:
        "**¡Hola!** Soy tu **Asistente IA Autónomo360**.\n\nEstoy conectado a tus clientes, presupuestos, partes de trabajo, facturas y agenda en tiempo real. Puedo responder tus consultas de negocio y ayudarte a **preparar borradores de presupuestos, citas o clientes** para confirmarlos con un clic.\n\n¿Qué necesitas revisar hoy?",
      timestamp: "Ahora",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (queryText: string) => {
    const text = queryText.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const assistantMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          role: "assistant",
          content: data.answer || "No se obtuvo respuesta para esta consulta.",
          source: data.source,
          draft: data.draft,
          timestamp: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        showToast("error", "Error al consultar al Asistente");
      }
    } catch {
      showToast("error", "Error de conexión con el asistente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Breadcrumbs items={[{ label: "Asistente IA Autónomo360" }]} />
          <h1 className="text-2xl sm:text-3xl font-black text-slate-100 mt-1 tracking-tight flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-slate-900 border border-emerald-500/30 text-white shadow-md">
              <Sparkles className="h-5 w-5 text-emerald-300" />
            </div>
            <span>Asistente IA Autónomo360</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Asistente virtual conectado a tus datos reales de clientes, presupuestos, facturas y agenda.
          </p>
        </div>

        <button
          onClick={() =>
            setMessages([
              {
                id: "welcome-reset",
                role: "assistant",
                content:
                  "**¡Hola de nuevo!** ¿Qué aspecto de tus clientes, presupuestos o agenda deseas consultar?",
                timestamp: "Ahora",
              },
            ])
          }
          className="btn-secondary text-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Nueva Conversación
        </button>
      </div>

      {/* Suggested Chips */}
      <div className="card p-4 bg-slate-900/90 border border-slate-700/80 space-y-2">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-emerald-400" /> Consultas directas sugeridas:
        </p>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {QUICK_CHIPS.map((chip, idx) => (
            <button
              key={idx}
              disabled={loading}
              onClick={() => handleSendMessage(chip)}
              className="px-3 py-1.5 rounded-xl font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/70 transition-all shrink-0 active:scale-95 disabled:opacity-50"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Window Container */}
      <div className="card p-6 bg-slate-900/90 border border-slate-700/80 shadow-2xl flex flex-col h-[580px]">
        {/* Messages List */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {messages.map((m) => {
            const isUser = m.role === "user";
            return (
              <div
                key={m.id}
                className={`flex gap-3 text-xs leading-relaxed ${
                  isUser ? "justify-end" : "justify-start"
                }`}
              >
                {!isUser && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-slate-900 border border-emerald-500/30 text-white shrink-0 mt-0.5 shadow-sm">
                    <Bot className="h-4 w-4 text-emerald-300" />
                  </div>
                )}

                <div className="space-y-3 max-w-2xl">
                  <div
                    className={`rounded-2xl p-4 shadow-md space-y-2 ${
                      isUser
                        ? "bg-gradient-to-r from-emerald-600 to-teal-700 text-white"
                        : "bg-slate-800/90 border border-slate-700 text-slate-200"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.content}</div>
                    <div
                      className={`text-[10px] text-right ${
                        isUser ? "text-emerald-100" : "text-slate-400"
                      }`}
                    >
                      {m.timestamp}
                    </div>
                  </div>

                  {/* Interactive Action Card Draft */}
                  {m.draft && (
                    <div className="bg-slate-950/90 border border-emerald-500/40 rounded-2xl p-4 text-slate-200 space-y-3 shadow-lg">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="font-bold text-emerald-400 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                          {m.draft.type === "budget" && <FileText className="h-4 w-4" />}
                          {m.draft.type === "visit" && <Calendar className="h-4 w-4" />}
                          {m.draft.type === "client" && <UserPlus className="h-4 w-4" />}
                          Borrador Generado: {m.draft.type === "budget" ? "Presupuesto" : m.draft.type === "visit" ? "Cita en Agenda" : "Ficha de Cliente"}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                          Pendiente de Confirmación
                        </span>
                      </div>

                      {/* Content details per type */}
                      {m.draft.type === "budget" && (
                        <div className="space-y-2 text-xs">
                          <p><strong className="text-slate-300">Cliente:</strong> {m.draft.payload.client_name}</p>
                          <p><strong className="text-slate-300">Concepto:</strong> {m.draft.payload.title}</p>
                          {Array.isArray(m.draft.payload.items) && m.draft.payload.items.length > 0 && (
                            <div className="bg-slate-900 rounded-lg p-2 space-y-1">
                              <p className="text-[11px] text-slate-400 font-medium">Partidas:</p>
                              {m.draft.payload.items.map((it: any, i: number) => (
                                <div key={i} className="flex justify-between text-[11px] text-slate-300">
                                  <span>{it.quantity}x {it.description}</span>
                                  <span className="font-semibold text-emerald-300">{Number(it.unit_price * it.quantity).toFixed(2)} €</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <Button
                            variant="primary"
                            icon={ArrowRight}
                            className="w-full text-xs mt-2"
                            onClick={() => router.push(`/presupuestos/nuevo?client=${encodeURIComponent(m.draft?.payload.client_name || "")}&title=${encodeURIComponent(m.draft?.payload.title || "")}`)}
                          >
                            Ir a Formulario de Presupuesto
                          </Button>
                        </div>
                      )}

                      {m.draft.type === "visit" && (
                        <div className="space-y-2 text-xs">
                          <p><strong className="text-slate-300">Cliente:</strong> {m.draft.payload.client_name}</p>
                          <p><strong className="text-slate-300">Motivo:</strong> {m.draft.payload.title}</p>
                          <p><strong className="text-slate-300">Fecha y Hora:</strong> {m.draft.payload.date} a las {m.draft.payload.time}</p>
                          {m.draft.payload.address && <p><strong className="text-slate-300">Lugar:</strong> {m.draft.payload.address}</p>}
                          <Button
                            variant="primary"
                            icon={Calendar}
                            className="w-full text-xs mt-2"
                            onClick={() => router.push("/agenda")}
                          >
                            Ir a la Agenda
                          </Button>
                        </div>
                      )}

                      {m.draft.type === "client" && (
                        <div className="space-y-2 text-xs">
                          <p><strong className="text-slate-300">Nombre:</strong> {m.draft.payload.name}</p>
                          {m.draft.payload.phone && <p><strong className="text-slate-300">Teléfono:</strong> {m.draft.payload.phone}</p>}
                          {m.draft.payload.email && <p><strong className="text-slate-300">Email:</strong> {m.draft.payload.email}</p>}
                          {m.draft.payload.company && <p><strong className="text-slate-300">Empresa:</strong> {m.draft.payload.company}</p>}
                          <Button
                            variant="primary"
                            icon={CheckCircle2}
                            className="w-full text-xs mt-2"
                            onClick={() => router.push("/clientes")}
                          >
                            Ver Cartera de Clientes
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-3 text-xs justify-start">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-slate-900 border border-emerald-500/30 text-white shrink-0 shadow-sm">
                <Bot className="h-4 w-4 text-emerald-300" />
              </div>
              <div className="bg-slate-800/90 border border-slate-700 text-slate-400 p-3.5 rounded-2xl flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Consultando datos del negocio y ejecutando herramientas seguras...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(input);
          }}
          className="pt-4 border-t border-slate-800 flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Pregunta sobre clientes, facturas, presupuestos o solicita crear un borrador..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="input-field text-xs flex-1"
          />
          <Button
            type="submit"
            variant="primary"
            disabled={loading || !input.trim()}
            icon={Send}
            className="shrink-0 text-xs px-4"
          >
            Enviar
          </Button>
        </form>
      </div>
    </div>
  );
}
