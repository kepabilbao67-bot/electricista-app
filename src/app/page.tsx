"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Users,
  BriefcaseBusiness,
  CheckCircle2,
  Calendar,
  Phone,
  ArrowRight,
  Sparkles,
  Plus,
  Clock,
  AlertTriangle,
  Building2,
  DollarSign,
  ChevronRight,
  ShieldCheck,
  Target,
  PieChart,
} from "lucide-react";
import WhatsAppButton from "@/components/WhatsAppButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { showToast } from "@/components/Toast";
import {
  CRM_STAGE_LABELS,
  CRM_STAGE_BADGES,
  CrmStage,
} from "@/lib/crm";

interface CommercialMetrics {
  totalClients: number;
  openOpportunities: number;
  pipelineValue: number;
  weightedPipelineValue: number;
  pendingTasks: number;
  todayTasks: number;
  overdueFollowUps: number;
  hotOpportunities: number;
  pendingDocs: number;
  upcomingMeetings: number;
  closedWonCount: number;
}

interface Opportunity {
  id: string;
  title: string;
  stage: CrmStage;
  estimated_value: number;
  probability?: number;
  client_id?: string;
  client_name?: string;
  client_company?: string;
  next_action?: string | null;
  next_action_at?: string | null;
}

interface CrmTask {
  id: string;
  title: string;
  due_at: string | null;
  priority: string;
  status: string;
  client_id?: string;
  client_name?: string;
  client_phone?: string;
}

const PIPELINE_STAGES: { key: CrmStage; label: string; barColor: string }[] = [
  { key: "nuevo", label: "Lead / Nuevo", barColor: "bg-slate-500" },
  { key: "contactado", label: "Contacto Inicial", barColor: "bg-sky-500" },
  { key: "reunion", label: "Reunión / Diagnóstico", barColor: "bg-purple-500" },
  { key: "seguimiento", label: "En Seguimiento", barColor: "bg-amber-500" },
  { key: "propuesta", label: "Propuesta Enviada", barColor: "bg-blue-500" },
  { key: "cliente", label: "Cierre Ganado", barColor: "bg-emerald-500" },
];

export default function HomePage() {
  const [metrics, setMetrics] = useState<CommercialMetrics | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [metRes, oppRes, tasksRes] = await Promise.all([
        fetch("/api/comercial").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/opportunities").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/crm-tasks").then((r) => (r.ok ? r.json() : [])),
      ]);

      if (metRes) setMetrics(metRes);
      setOpportunities(Array.isArray(oppRes) ? oppRes : []);
      setTasks(Array.isArray(tasksRes) ? tasksRes : []);
    } catch {
      showToast("error", "Error al sincronizar datos del centro comercial");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCompleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/crm-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (res.ok) {
        showToast("success", "Tarea completada");
        loadData();
      }
    } catch {
      showToast("error", "Error al actualizar tarea");
    }
  };

  const pendingTasks = tasks.filter((t) => t.status === "pending").slice(0, 5);
  const hotOpportunities = opportunities
    .filter((o) => (o.probability || 0) >= 60 && !["ganada", "cliente", "perdida", "no_interesado"].includes(o.stage))
    .slice(0, 5);

  const pipelineValue = metrics?.pipelineValue || opportunities.reduce((a, b) => a + Number(b.estimated_value || 0), 0);
  const weightedValue = metrics?.weightedPipelineValue || (pipelineValue * 0.45);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Header Banner - Barymont Identity */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-700/80 bg-gradient-to-br from-[#06101c] via-[#0a1829] to-[#0d223a] p-6 sm:p-8 shadow-[0_20px_50px_rgba(2,6,23,0.5)]">
        <div className="absolute right-0 top-0 -mt-12 -mr-12 h-64 w-64 rounded-full bg-gradient-to-br from-[#0284c7]/20 to-[#d9b35f]/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-[#d9b35f]/15 text-[#f5d48a] border border-[#d9b35f]/30">
                <Sparkles className="h-3.5 w-3.5" /> BARYMONT · CENTRO COMERCIAL
              </span>
              <span className="hidden sm:inline-block text-xs text-slate-400">
                “Planifica. Protege. Haz crecer.”
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
              Buenos días, <span className="bg-gradient-to-r from-slate-100 via-[#f5d48a] to-[#d9b35f] bg-clip-text text-transparent">Pedro</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
              Supervisión de actividad comercial, planificación de cartera y seguimiento de clientes en tiempo real.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link href="/crm" className="btn-primary">
              <TrendingUp className="h-4 w-4" /> Pipeline CRM
            </Link>
            <Link href="/clientes" className="btn-secondary">
              <Users className="h-4 w-4" /> Directorio Clientes
            </Link>
            <Link href="/asistente" className="btn-accent">
              <Sparkles className="h-4 w-4" /> Copilot IA
            </Link>
          </div>
        </div>
      </div>

      {/* Hero Metric & Main KPI Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Hero Card: Pipeline Activo (Protagonista Champagne) */}
        <div className="lg:col-span-5 rounded-3xl border border-[#d9b35f]/30 bg-gradient-to-br from-[#0b1728] via-[#0d1d33] to-[#091524] p-6 sm:p-7 shadow-[0_20px_45px_rgba(217,179,95,0.08)] flex flex-col justify-between space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
            <DollarSign className="h-32 w-32 text-[#f5d48a]" />
          </div>

          <div className="space-y-3 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-[#f5d48a]">
                Valor del Pipeline Activo
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#f5d48a]/20 text-[#f5d48a] border border-[#f5d48a]/30">
                {metrics?.openOpportunities || opportunities.length} operaciones
              </span>
            </div>

            <div>
              <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#f5d48a] font-mono">
                {pipelineValue.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
              </div>
              <p className="text-xs text-slate-300 mt-1 flex items-center gap-1.5">
                <span className="text-slate-400">Ponderado estimado:</span>
                <span className="font-bold text-sky-400 font-mono">
                  {weightedValue.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                </span>
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-700/80 flex items-center justify-between relative z-10">
            <span className="text-xs text-slate-400 font-medium">
              {metrics?.hotOpportunities || hotOpportunities.length} soluciones de alta probabilidad (&gt;60%)
            </span>
            <Link
              href="/crm"
              className="text-xs font-bold text-[#f5d48a] hover:text-white flex items-center gap-1 transition-colors"
            >
              Ver Kanban <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* 4 Supporting KPI Cards */}
        <div className="lg:col-span-7 grid grid-cols-2 gap-4">
          {/* Card 1: Clientes */}
          <div className="card p-5 bg-[#0a1424]/90 border border-slate-700/80 flex flex-col justify-between hover:border-sky-500/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Clientes & Contactos
              </span>
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-black text-slate-100 font-mono">
                {metrics?.totalClients || 0}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {metrics?.closedWonCount || 0} clientes cerrados
              </p>
            </div>
          </div>

          {/* Card 2: Oportunidades Calientes */}
          <div className="card p-5 bg-[#0a1424]/90 border border-slate-700/80 flex flex-col justify-between hover:border-[#d9b35f]/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Oportunidades Calientes
              </span>
              <div className="p-2 rounded-xl bg-[#d9b35f]/15 text-[#f5d48a] border border-[#d9b35f]/30">
                <Target className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-black text-[#f5d48a] font-mono">
                {metrics?.hotOpportunities || hotOpportunities.length}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Probabilidad ≥ 60%
              </p>
            </div>
          </div>

          {/* Card 3: Tareas de Hoy */}
          <div className="card p-5 bg-[#0a1424]/90 border border-slate-700/80 flex flex-col justify-between hover:border-amber-500/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Tareas & Llamadas
              </span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-black text-amber-400 font-mono">
                {metrics?.pendingTasks || pendingTasks.length}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {metrics?.todayTasks || 0} programadas para hoy
              </p>
            </div>
          </div>

          {/* Card 4: Reuniones / Previsión */}
          <div className="card p-5 bg-[#0a1424]/90 border border-slate-700/80 flex flex-col justify-between hover:border-emerald-500/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Reuniones de Cita
              </span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Calendar className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-black text-emerald-400 font-mono">
                {metrics?.upcomingMeetings || 0}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {metrics?.pendingDocs || 0} con doc. pendiente
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace Sections: Left (Hoy y Tareas) & Right (Oportunidades Calientes y Pipeline) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Tareas y Seguimiento de Hoy */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Actividad Comercial y Tareas de Hoy
            </h2>
            <Link href="/crm" className="text-xs font-semibold text-slate-400 hover:text-slate-200">
              Ver todas ({tasks.length})
            </Link>
          </div>

          {pendingTasks.length === 0 ? (
            <div className="card p-8 text-center text-xs text-slate-400 space-y-2">
              <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-400" />
              <p className="font-bold text-slate-200">Sin tareas pendientes para hoy</p>
              <p className="text-slate-500">Todas las llamadas y citas están al día.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingTasks.map((t) => (
                <div
                  key={t.id}
                  className="card p-4 bg-[#0a1424]/90 border border-slate-700/80 hover:border-slate-600 transition-all space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleCompleteTask(t.id)}
                        className="mt-0.5 h-4 w-4 rounded border border-slate-600 flex items-center justify-center text-transparent hover:border-emerald-400 hover:text-emerald-400 transition-colors shrink-0"
                        title="Marcar como completada"
                      >
                        ✓
                      </button>
                      <div>
                        <p className="text-xs font-bold text-slate-100">{t.title}</p>
                        {t.client_name && (
                          <p className="text-[11px] text-sky-400 mt-0.5 font-medium flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-slate-500" />
                            {t.client_name}
                          </p>
                        )}
                      </div>
                    </div>

                    {t.priority === "high" && (
                      <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0">
                        Alta
                      </span>
                    )}
                  </div>

                  {t.client_phone && (
                    <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
                      <WhatsAppButton
                        phone={t.client_phone}
                        message={`Hola ${t.client_name || ""},`}
                        className="h-7 px-2.5 text-[11px]"
                      />
                      <a
                        href={`tel:${t.client_phone}`}
                        className="btn-secondary h-7 px-2.5 flex items-center gap-1 text-[11px] text-sky-400 border-sky-500/30"
                      >
                        <Phone className="h-3 w-3" /> Llamar
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Oportunidades Prioritarias y Desglose */}
        <div className="lg:col-span-6 space-y-6">
          {/* Oportunidades Calientes */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Target className="h-4 w-4 text-[#f5d48a]" />
                Oportunidades Prioritarias
              </h2>
              <Link href="/crm" className="text-xs font-semibold text-[#f5d48a] hover:text-white">
                Ver Kanban
              </Link>
            </div>

            {hotOpportunities.length === 0 ? (
              <div className="card p-8 text-center text-xs text-slate-400 space-y-2">
                <BriefcaseBusiness className="h-8 w-8 mx-auto text-slate-500" />
                <p>Sin oportunidades de alta probabilidad en curso</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {hotOpportunities.map((opp) => (
                  <div
                    key={opp.id}
                    className="card p-4 bg-[#0a1424]/90 border border-slate-700/80 hover:border-[#d9b35f]/40 transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-slate-100">{opp.title}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {opp.client_name ? `Cliente: ${opp.client_name}` : "Prospecto"}
                          {opp.client_company ? ` · ${opp.client_company}` : ""}
                        </p>
                      </div>
                      <span className="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-[#d9b35f]/20 text-[#f5d48a] border border-[#d9b35f]/40 shrink-0">
                        {opp.probability || 60}%
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="font-mono font-black text-[#f5d48a]">
                        {Number(opp.estimated_value || 0).toLocaleString("es-ES")} €
                      </span>
                      {opp.next_action && (
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="h-3 w-3 text-amber-400" />
                          {opp.next_action}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Desglose del Pipeline por Etapas */}
          <div className="card p-5 bg-[#0a1424]/90 border border-slate-700/80 space-y-3.5">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <PieChart className="h-4 w-4 text-sky-400" />
              Distribución del Pipeline por Etapas
            </h3>

            <div className="space-y-2">
              {PIPELINE_STAGES.map((st) => {
                const count = opportunities.filter((o) => o.stage === st.key).length;
                const totalStageValue = opportunities
                  .filter((o) => o.stage === st.key)
                  .reduce((acc, o) => acc + Number(o.estimated_value || 0), 0);
                const percent = pipelineValue > 0 ? Math.round((totalStageValue / pipelineValue) * 100) : 0;

                return (
                  <div key={st.key} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-slate-300">{st.label} ({count})</span>
                      <span className="font-mono font-bold text-slate-200">
                        {totalStageValue.toLocaleString("es-ES")} €
                        <span className="text-slate-500 font-normal ml-1">({percent}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${st.barColor}`}
                        style={{ width: `${Math.min(100, Math.max(percent > 0 ? 5 : 0, percent))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
