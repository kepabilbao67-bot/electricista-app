"use client";

import { useState, useEffect } from "react";
import {
  HelpCircle,
  MessageSquarePlus,
  Send,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Lightbulb,
  AlertTriangle,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";
import VoiceDictation from "@/components/VoiceDictation";
import { showToast } from "@/components/Toast";

interface FeedbackItem {
  id: string;
  type: string;
  subject: string;
  message: string;
  email: string | null;
  status: string;
  created_at: string;
}

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const FAQS: FAQItem[] = [
  {
    category: "Facturación y TicketBAI",
    question: "¿Cómo emito una factura y genero el código TicketBAI?",
    answer:
      "Ve a la sección 'Facturas', pulsa en 'Nueva factura', selecciona el cliente y añade las líneas de trabajo y materiales. Al guardar o pulsar en 'Emitir TicketBAI', el sistema generará automáticamente el identificador, firma encadenada y código QR reglamentario.",
  },
  {
    category: "Partes de Trabajo",
    question: "¿Puedo convertir un parte de trabajo en factura automáticamente?",
    answer:
      "Sí. Dentro de cualquier parte de trabajo guardado ('/partes-trabajo'), dispones de un botón directo 'Generar Factura' que traslada automáticamente todos los conceptos, horas y materiales sin tener que reescribirlos.",
  },
  {
    category: "CRM y Leads",
    question: "¿Cómo funciona la captura y conversión de leads?",
    answer:
      "En '/leads' puedes registrar prospectos manualmente o a través del formulario web. Al cualificar un contacto, la acción 'Convertir' crea de forma atómica la ficha del cliente y abre su oportunidad en el pipeline del CRM ('/crm').",
  },
  {
    category: "Dictado por Voz y Modo Oscuro",
    question: "¿Mis notas de voz se envían a servidores de terceros?",
    answer:
      "No. El dictado por voz utiliza exclusivamente la Web Speech API nativa implementada en tu navegador. El audio se procesa en local y solo el texto resultante se inserta en tu formulario.",
  },
];

export default function AyudaPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [submissions, setSubmissions] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mountTime] = useState<number>(Date.now());

  const [form, setForm] = useState({
    type: "sugerencia",
    subject: "",
    message: "",
    email: "",
    _hp: "",
  });

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/feedback");
      if (res.ok) {
        const data = await res.json();
        setSubmissions(Array.isArray(data) ? data : []);
      }
    } catch {
      // Silencioso
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          _ts: mountTime,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast("error", data.error || "No se pudo enviar el feedback.");
        return;
      }

      showToast("success", "¡Gracias! Tu aportación ha sido registrada correctamente.");
      setForm({
        type: "sugerencia",
        subject: "",
        message: "",
        email: "",
        _hp: "",
      });
      fetchSubmissions();
    } catch {
      showToast("error", "Error de conexión al enviar el formulario.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWhatsAppHelp = () => {
    const text = encodeURIComponent(
      "Hola, me pongo en contacto desde Autónomo 360 para consultar una duda sobre la aplicación."
    );
    const url = `https://wa.me/?text=${text}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "implementado":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="h-3 w-3" /> Implementado
          </span>
        );
      case "en_revision":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="h-3 w-3" /> En revisión
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <Sparkles className="h-3 w-3" /> Recibido
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            <HelpCircle className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            Ayuda y Sugerencias
          </h1>
          <p className="page-subtitle">
            Base de conocimiento, respuestas rápidas y buzón directo de mejoras para tu plataforma.
          </p>
        </div>

        <button
          type="button"
          onClick={handleWhatsAppHelp}
          aria-label="Contactar soporte por WhatsApp"
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 dark:border-emerald-700/80 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-2.5 text-sm font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all shadow-sm cursor-pointer"
        >
          <MessageCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>Soporte WhatsApp</span>
        </button>
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Columna Izquierda: Formulario de Sugerencias */}
        <div className="lg:col-span-7 space-y-6">
          <div className="card-static">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <MessageSquarePlus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Enviar Sugerencia o Notificar Problema
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Campo Honeypot invisible */}
              <input
                type="text"
                name="_hp"
                value={form._hp}
                onChange={(e) => setForm({ ...form, _hp: e.target.value })}
                style={{ display: "none" }}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />

              {/* Tipo de Feedback */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Tipo de aportación *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "sugerencia", label: "Sugerencia", icon: Lightbulb },
                    { id: "error", label: "Reporte Bug", icon: AlertTriangle },
                    { id: "duda", label: "Duda / Uso", icon: FileText },
                  ].map((t) => {
                    const Icon = t.icon;
                    const isSelected = form.type === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setForm({ ...form, type: t.id })}
                        className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                          isSelected
                            ? "bg-blue-50 dark:bg-blue-950/80 border-blue-500 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/30 font-semibold"
                            : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                        } cursor-pointer`}
                      >
                        <Icon className={`h-3.5 w-3.5 ${isSelected ? "text-blue-600 dark:text-blue-400" : "text-slate-500"}`} />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Asunto */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Título o Asunto *
                </label>
                <input
                  type="text"
                  required
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Ej: Añadir exportación PDF personalizada..."
                  className="input-field"
                />
              </div>

              {/* Mensaje con Dictado por Voz */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Descripción detallada *
                  </label>
                  <VoiceDictation
                    onTranscriptComplete={(text) => {
                      setForm((prev) => ({
                        ...prev,
                        message: prev.message ? `${prev.message} ${text}` : text,
                      }));
                    }}
                  />
                </div>
                <textarea
                  required
                  rows={4}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Explica tu idea, la mejora que propones o los pasos para reproducir el problema..."
                  className="input-field"
                />
              </div>

              {/* Email opcional */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Email de contacto (opcional)
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="tu-correo@ejemplo.com"
                  className="input-field"
                />
              </div>

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary w-full justify-center py-3 text-sm cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                  {submitting ? "Enviando aportación..." : "Enviar a los Desarrolladores"}
                </button>
              </div>
            </form>
          </div>

          {/* Historial de Sugerencias */}
          <div className="card-static">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center justify-between">
              <span>Tus Aportaciones Recientes</span>
              <span className="text-xs text-slate-500 font-normal">({submissions.length})</span>
            </h3>

            {loading ? (
              <div className="py-6 text-center text-xs text-slate-500">Cargando sugerencias...</div>
            ) : submissions.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                Aún no has enviado sugerencias. ¡Tus aportaciones ayudan a mejorar Autónomo 360!
              </div>
            ) : (
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {submissions.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {item.subject}
                      </span>
                      {getStatusBadge(item.status)}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                      {item.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha: FAQs y Privacidad */}
        <div className="lg:col-span-5 space-y-6">
          {/* FAQs */}
          <div className="card-static">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-amber-500" />
              Preguntas Frecuentes (FAQs)
            </h2>

            <div className="space-y-3">
              {FAQS.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900/60 transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full px-4 py-3 text-left flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                    >
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {faq.question}
                      </span>
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-3.5 pt-1 text-xs text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800 leading-relaxed bg-slate-50/50 dark:bg-slate-800/30">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Garantía de Privacidad */}
          <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800/80 bg-blue-50/60 dark:bg-blue-950/40 space-y-2">
            <div className="flex items-center gap-2 text-blue-900 dark:text-blue-300 font-semibold text-xs">
              <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Garantía de Privacidad y RGPD
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Tus sugerencias se almacenan en tu propia instancia de base de datos. Ningún audio ni dato fiscal sensible es transmitido a servicios de terceros.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
