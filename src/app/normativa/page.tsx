"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Zap, Bot, User, Sparkles } from "lucide-react";
import { EXTRA_SUGGESTION_CHIPS } from "@/lib/ai-knowledge";
import { localAnswer, type CatalogItem } from "@/lib/ai-engine";
import { answerAboutApp, isDangerousElectricalQuery, DANGEROUS_QUERY_RESPONSE } from "@/lib/assistant";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTION_CHIPS = [
  "Cómo usar la app",
  "Secciones de cable",
  "Circuitos minimos",
  "Proteccion para horno",
  "Electrificacion elevada",
  "Caida de tension",
  "Precios de materiales",
  "Margen de beneficio",
];

const WELCOME: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Hola! Soy el asistente de Autonomo360. Puedo ayudarte con:\n\n- **Usar la app**: cómo crear presupuestos, facturas, partes de trabajo, gestionar clientes...\n- **Normativa REBT**: cable, protecciones, circuitos, baños, piscinas, garajes, locales, obras...\n- **Precios**: tu catálogo, márgenes, cómo calcular presupuestos\n- **Negocio**: IRPF, cuota autónomo, morosos, ayudas, boletines, carnet instalador\n- **Seguridad**: EPIs, primeros auxilios, arco eléctrico\n- **Técnico**: averías, domótica KNX, fotovoltaica, cargadores de coche, herramientas\n\nPregúntame lo que necesites o usa las sugerencias rápidas.",
};

export default function NormativaPage() {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((data) => setCatalog(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const handleSend = async (text?: string) => {
    const query = text || input.trim();
    if (!query || sending) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
    };

    // Historial que se envia al backend (sin el mensaje de bienvenida).
    const history = messages
      .filter((m) => m.id !== "welcome")
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    let answer: string;
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, history }),
      });
      if (!res.ok) throw new Error("bad response");
      const data = await res.json();
      answer =
        typeof data?.answer === "string" && data.answer.trim()
          ? data.answer
          : localAnswer(query, catalog);
    } catch {
      // Sin conexión o error: responder con motor local mejorado.
      if (isDangerousElectricalQuery(query)) {
        answer = DANGEROUS_QUERY_RESPONSE;
      } else {
        const appAns = answerAboutApp(query);
        answer = appAns || localAnswer(query, catalog);
      }
    }

    const assistantMsg: Message = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: answer,
    };
    setMessages((prev) => [...prev, assistantMsg]);
    setSending(false);
    inputRef.current?.focus();
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
          <Zap className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-1.5">
            Asistente Autonomo360 <Sparkles className="h-4 w-4 text-amber-500" />
          </h1>
          <p className="text-xs text-slate-500">Normativa, negocio, seguridad, técnica y precios</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`flex items-start gap-2 max-w-[85%] ${
                msg.role === "user" ? "flex-row-reverse" : "flex-row"
              }`}
            >
              <div
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
                  msg.role === "user" ? "bg-indigo-600" : "bg-slate-200"
                }`}
              >
                {msg.role === "user" ? (
                  <User className="h-3.5 w-3.5 text-white" />
                ) : (
                  <Bot className="h-3.5 w-3.5 text-slate-600" />
                )}
              </div>
              <div
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "bg-white border border-slate-200 text-slate-700 shadow-sm"
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          </div>
        ))}

        {/* Indicador de escritura */}
        {sending && (
          <div className="flex justify-start">
            <div className="flex items-start gap-2 max-w-[85%]">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-200">
                <Bot className="h-3.5 w-3.5 text-slate-600" />
              </div>
              <div className="rounded-2xl px-4 py-3 bg-white border border-slate-200 shadow-sm">
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce"></span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips */}
      <div className="flex flex-wrap gap-2 pb-3 flex-shrink-0 max-h-20 overflow-y-auto">
        {[...SUGGESTION_CHIPS, ...EXTRA_SUGGESTION_CHIPS].map((chip) => (
          <button
            key={chip}
            onClick={() => handleSend(chip)}
            disabled={sending}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 flex gap-2 border-t border-slate-200 pt-3">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Pregunta sobre la app, normativa, precios..."
          className="input-field flex-1"
          disabled={sending}
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || sending}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">Enviar</span>
        </button>
      </div>
    </div>
  );
}
