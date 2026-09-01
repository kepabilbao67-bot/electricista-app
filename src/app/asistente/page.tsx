"use client";

import { useState, useRef, useEffect } from "react";
import {
  Bot,
  Send,
  Sparkles,
  Phone,
  Calendar,
  AlertTriangle,
  Clock,
  BriefcaseBusiness,
  Users,
  CheckCircle2,
  FileText,
  DollarSign,
  TrendingUp,
  UserCheck,
  Building2,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { showToast } from "@/components/Toast";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  source?: string;
  timestamp: string;
}

const QUICK_CHIPS = [
  "¿A quién tengo que llamar hoy?",
  "¿Qué oportunidades están más calientes?",
  "¿Qué clientes llevan más tiempo sin seguimiento?",
  "¿Qué reuniones tengo esta semana?",
  "¿Qué clientes tienen documentación pendiente?",
  "Resumen comercial de cartera",
];

export default function AsistenteCopilotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      role: "assistant",
      content:
        "**¡Hola, Pedro!** Soy tu **Barymont Copilot**.\n\nEstoy conectado a tu cartera de clientes, oportunidades y agenda en tiempo real. Puedo ayudarte a priorizar tus llamadas de hoy, detectar oportunidades calientes o recordarte expedientes con documentación pendiente.\n\n*“Planifica. Protege. Haz crecer.”*\n\n¿Qué necesitas revisar hoy?",
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
          timestamp: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        showToast("error", "Error al consultar al Copilot");
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
          <Breadcrumbs items={[{ label: "Barymont Copilot" }]} />
          <h1 className="text-2xl sm:text-3xl font-black text-slate-100 mt-1 tracking-tight flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0284c7] via-[#0369a1] to-[#0b1b30] border border-sky-400/30 text-white shadow-md">
              <Sparkles className="h-5 w-5 text-[#f5d48a]" />
            </div>
            <span>Barymont Copilot</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Copiloto inteligente para Pedro con acceso a datos en vivo de cartera comercial y planificación patrimonial.
          </p>
        </div>

        <button
          onClick={() =>
            setMessages([
              {
                id: "welcome-reset",
                role: "assistant",
                content:
                  "**¡Hola de nuevo, Pedro!** ¿Qué aspecto de tu cartera o agenda deseas consultar?",
                timestamp: "Ahora",
              },
            ])
          }
          className="btn-secondary text-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Nueva Conversación
        </button>
      </div>

      {/* Suggested Chips Carousel */}
      <div className="card p-4 bg-[#0a1424]/90 border border-slate-700/80 space-y-2">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-[#f5d48a]" /> Consultas directas sugeridas:
        </p>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {QUICK_CHIPS.map((chip, idx) => (
            <button
              key={idx}
              disabled={loading}
              onClick={() => handleSendMessage(chip)}
              className="px-3 py-1.5 rounded-xl font-medium bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/70 transition-all shrink-0 active:scale-95 disabled:opacity-50"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Window Container */}
      <div className="card p-6 bg-[#0a1424]/90 border border-slate-700/80 shadow-2xl flex flex-col h-[550px]">
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
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#0284c7] to-[#0a1b30] border border-sky-400/30 text-white shrink-0 mt-0.5 shadow-sm">
                    <Bot className="h-4 w-4 text-[#f5d48a]" />
                  </div>
                )}

                <div
                  className={`max-w-2xl rounded-2xl p-4 shadow-md space-y-2 ${
                    isUser
                      ? "bg-gradient-to-r from-[#0284c7] to-[#0369a1] text-white"
                      : "bg-[#0d1d33] border border-slate-700/90 text-slate-200"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.content}</div>
                  <div
                    className={`text-[10px] text-right ${
                      isUser ? "text-sky-200" : "text-slate-500"
                    }`}
                  >
                    {m.timestamp}
                  </div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-3 text-xs justify-start">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#0284c7] to-[#0a1b30] border border-sky-400/30 text-white shrink-0 shadow-sm">
                <Bot className="h-4 w-4 text-[#f5d48a]" />
              </div>
              <div className="bg-[#0d1d33] border border-slate-700/90 text-slate-400 p-3.5 rounded-2xl flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-sky-400 animate-ping" />
                <span>Consultando base de datos de cartera y oportunidades...</span>
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
            placeholder="Pregunta a Barymont Copilot sobre clientes, llamadas, citas o el método Barymont..."
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
