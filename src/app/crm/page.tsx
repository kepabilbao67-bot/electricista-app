"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Briefcase,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Phone,
  Calendar,
  Plus,
  ArrowRight,
  Sparkles,
  FileText,
  DollarSign,
  ChevronRight,
  Filter,
  Check,
  Building2,
  Flame,
  UserCheck,
  Send,
} from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import WhatsAppButton from "@/components/WhatsAppButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { showToast } from "@/components/Toast";
import {
  CRM_STAGES,
  CRM_STAGE_LABELS,
  CRM_STAGE_BADGES,
  CrmStage,
  STAGE_PROBABILITIES,
} from "@/lib/crm";

interface Opportunity {
  id: string;
  title: string;
  stage: CrmStage;
  estimated_value: number;
  probability?: number;
  client_id?: string;
  client_name?: string;
  client_phone?: string;
  client_company?: string;
  source?: string;
  next_action?: string | null;
  next_action_at?: string | null;
  notes?: string | null;
  created_at?: string;
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
  notes?: string | null;
}

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

// 6 Columnas Visuales del Pipeline Barymont
const PIPELINE_COLUMNS: {
  key: CrmStage;
  label: string;
  badgeBg: string;
  headerBorder: string;
}[] = [
  { key: "nuevo", label: "1. Lead / Nuevo", badgeBg: "bg-slate-700/60 text-slate-300", headerBorder: "border-slate-700" },
  { key: "contactado", label: "2. Contacto Inicial", badgeBg: "bg-sky-500/20 text-sky-300", headerBorder: "border-sky-500/30" },
  { key: "reunion", label: "3. Reunión / Diagnóstico", badgeBg: "bg-purple-500/20 text-purple-300", headerBorder: "border-purple-500/30" },
  { key: "seguimiento", label: "4. En Seguimiento", badgeBg: "bg-amber-500/20 text-amber-300", headerBorder: "border-amber-500/30" },
  { key: "propuesta", label: "5. Propuesta Enviada", badgeBg: "bg-blue-500/20 text-blue-300", headerBorder: "border-blue-500/30" },
  { key: "cliente", label: "6. Cierre Ganado", badgeBg: "bg-emerald-500/20 text-emerald-300", headerBorder: "border-emerald-500/30" },
];

export default function CRMCommercialPage() {
  const [viewMode, setViewMode] = useState<"workspace" | "pipeline">("workspace");
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string; phone?: string; company?: string; status?: string }[]>([]);
  const [metrics, setMetrics] = useState<CommercialMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // New Opp Modal
  const [showNewOppModal, setShowNewOppModal] = useState(false);
  const [newOppForm, setNewOppForm] = useState({
    client_id: "",
    title: "",
    estimated_value: "",
    stage: "nuevo" as CrmStage,
    probability: 20,
    next_action: "",
    next_action_at: "",
    notes: "",
  });

  const loadAllData = useCallback(async () => {
    try {
      const [oppRes, tasksRes, clientsRes, metRes] = await Promise.all([
        fetch("/api/opportunities").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/crm-tasks").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/clients").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/comercial").then((r) => (r.ok ? r.json() : null)),
      ]);

      setOpportunities(Array.isArray(oppRes) ? oppRes : []);
      setTasks(Array.isArray(tasksRes) ? tasksRes : []);
      setClients(Array.isArray(clientsRes) ? clientsRes : []);
      if (metRes) setMetrics(metRes);
    } catch {
      showToast("error", "Error al cargar datos comerciales");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleStageChange = async (oppId: string, newStage: CrmStage) => {
    try {
      const res = await fetch(`/api/opportunities/${oppId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: newStage,
          probability: STAGE_PROBABILITIES[newStage] || 20,
        }),
      });

      if (res.ok) {
        showToast("success", `Oportunidad movida a ${CRM_STAGE_LABELS[newStage]}`);
        loadAllData();
      }
    } catch {
      showToast("error", "No se pudo actualizar la etapa");
    }
  };

  const handleCreateOpp = async (e: FormEvent) => {
    e.preventDefault();
    if (!newOppForm.title.trim()) return;

    try {
      const res = await fetch("/api/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: newOppForm.client_id || null,
          title: newOppForm.title.trim(),
          stage: newOppForm.stage,
          estimated_value: Number(newOppForm.estimated_value) || 0,
          probability: Number(newOppForm.probability) || 20,
          next_action: newOppForm.next_action.trim() || null,
          next_action_at: newOppForm.next_action_at || null,
          notes: newOppForm.notes.trim() || null,
        }),
      });

      if (res.ok) {
        showToast("success", "Oportunidad registrada");
        setShowNewOppModal(false);
        setNewOppForm({
          client_id: "",
          title: "",
          estimated_value: "",
          stage: "nuevo",
          probability: 20,
          next_action: "",
          next_action_at: "",
          notes: "",
        });
        loadAllData();
      }
    } catch {
      showToast("error", "Error al crear oportunidad");
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/crm-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (res.ok) {
        showToast("success", "Tarea completada");
        loadAllData();
      }
    } catch {
      showToast("error", "Error al completar tarea");
    }
  };

  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const hotOpportunities = opportunities.filter(
    (o) => (o.probability || 0) >= 60 && !["ganada", "cliente", "perdida", "no_interesado"].includes(o.stage)
  );
  const pendingDocsClients = clients.filter((c) => c.status === "doc_pendiente");
  const proposalWaitingOpps = opportunities.filter((o) => ["propuesta", "negociacion"].includes(o.stage));
  const pipelineValue = metrics?.pipelineValue || opportunities.reduce((acc, o) => acc + Number(o.estimated_value || 0), 0);
  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Breadcrumbs items={[{ label: "CRM & Centro de Trabajo" }]} />
          <h1 className="text-2xl sm:text-3xl font-black text-slate-100 mt-1 tracking-tight flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0284c7] via-[#0369a1] to-[#0b1b30] border border-sky-400/30 text-white shadow-md">
              <TrendingUp className="h-5 w-5 text-[#f5d48a]" />
            </div>
            <span>Centro Comercial Barymont</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gestión comercial y patrimonial para Pedro: agenda diaria de seguimiento y pipeline visual Kanban.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setShowNewOppModal(true)}
            className="shrink-0"
          >
            Nueva Oportunidad
          </Button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Pipeline Total */}
        <div className="card p-5 bg-[#0a1424]/90 border border-[#d9b35f]/30 flex flex-col justify-between relative overflow-hidden">
          <div>
            <span className="text-[11px] font-bold text-[#f5d48a] uppercase tracking-wider">
              Pipeline Total
            </span>
            <p className="text-2xl font-black text-[#f5d48a] font-mono mt-1">
              {(metrics?.pipelineValue || 0).toLocaleString("es-ES", { minimumFractionDigits: 0 })} €
            </p>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Ponderado: <strong className="text-sky-400 font-mono">{(metrics?.weightedPipelineValue || 0).toLocaleString("es-ES", { minimumFractionDigits: 0 })} €</strong>
          </p>
        </div>

        {/* Metric 2: Oportunidades Activas */}
        <div className="card p-5 bg-[#0a1424]/90 border border-slate-700/80 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Operaciones Abiertas
            </span>
            <span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Briefcase className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-1">
            <p className="text-2xl font-black text-slate-100 font-mono">
              {metrics?.openOpportunities || 0}
            </p>
            <p className="text-[11px] text-[#f5d48a] mt-0.5 font-medium">
              {hotOpportunities.length} prioritarias / calientes
            </p>
          </div>
        </div>

        {/* Metric 3: Tareas de Hoy */}
        <div className="card p-5 bg-[#0a1424]/90 border border-slate-700/80 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Tareas & Citas
            </span>
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-1">
            <p className="text-2xl font-black text-amber-400 font-mono">
              {metrics?.pendingTasks || 0}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {metrics?.todayTasks || 0} agendadas para hoy
            </p>
          </div>
        </div>

        {/* Metric 4: Cierres Ganados */}
        <div className="card p-5 bg-[#0a1424]/90 border border-slate-700/80 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Cierres Ganados
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <UserCheck className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-1">
            <p className="text-2xl font-black text-emerald-400 font-mono">
              {metrics?.closedWonCount || 0}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {clients.length} contactos en cartera
            </p>
          </div>
        </div>
      </div>

      {/* Switch Views: Centro de Trabajo Diario vs Pipeline Kanban */}
      <div className="flex items-center gap-3 border-b border-slate-700/80 pb-3">
        <button
          onClick={() => setViewMode("workspace")}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2 transition-all ${
            viewMode === "workspace"
              ? "bg-[#d9b35f] text-slate-950 shadow-md ring-2 ring-[#f5d48a]/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-slate-800"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Centro de Trabajo Diario de Pedro
        </button>

        <button
          onClick={() => setViewMode("pipeline")}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2 transition-all ${
            viewMode === "pipeline"
              ? "bg-[#d9b35f] text-slate-950 shadow-md ring-2 ring-[#f5d48a]/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-slate-800"
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          Pipeline Visual Kanban ({opportunities.length})
        </button>
      </div>
      {/* View 1: Centro de Trabajo Diario (HOY + PRIORIDAD) */}
      {viewMode === "workspace" && (
        <div className="space-y-8">
          {/* Section 1: HOY */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-l-4 border-[#d9b35f] pl-3">
              <h2 className="text-base font-black text-slate-100 uppercase tracking-wider">
                Hoy en la Agenda de Pedro
              </h2>
              <span className="text-xs text-slate-400">
                · Llamadas pendientes, reuniones y documentación urgente
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Column: Llamadas y Citas */}
              <div className="card p-5 bg-[#0a1424]/90 border border-slate-700/80 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Phone className="h-4 w-4 text-sky-400" />
                    Llamadas y Tareas ({pendingTasks.length})
                  </h3>
                </div>

                {pendingTasks.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 space-y-1">
                    <Check className="h-7 w-7 mx-auto text-emerald-400" />
                    <p className="font-bold text-slate-300">¡Al día!</p>
                    <p className="text-[11px] text-slate-500">Sin llamadas pendientes para hoy.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {pendingTasks.map((t) => (
                      <div
                        key={t.id}
                        className="p-3.5 rounded-xl border border-slate-800 bg-[#0c192d] hover:border-slate-700 transition-all space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
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
                              message={`Hola ${t.client_name || ""}, te contacto desde Barymont.`}
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

              {/* Column: Próximas Citas */}
              <div className="card p-5 bg-[#0a1424]/90 border border-slate-700/80 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-purple-400" />
                    Citas y Diagnósticos
                  </h3>
                </div>

                <div className="p-6 text-center text-xs text-slate-400 space-y-2 border border-dashed border-slate-800 rounded-xl">
                  <Calendar className="h-7 w-7 mx-auto text-purple-400/60" />
                  <p className="font-bold text-slate-300">Agenda Comercial Sincronizada</p>
                  <p className="text-[11px] text-slate-500">
                    {metrics?.upcomingMeetings || 0} reuniones programadas en calendario.
                  </p>
                  <Link href="/agenda" className="btn-secondary text-[11px] h-7 px-3 inline-flex items-center gap-1">
                    Abrir Agenda Completa <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              {/* Column: Documentación Pendiente */}
              <div className="card p-5 bg-[#0a1424]/90 border border-slate-700/80 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    Documentación Pendiente ({pendingDocsClients.length})
                  </h3>
                </div>

                {pendingDocsClients.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 space-y-1">
                    <Check className="h-7 w-7 mx-auto text-emerald-400" />
                    <p className="font-bold text-slate-300">Sin expedientes bloqueados</p>
                    <p className="text-[11px] text-slate-500">No hay clientes con pólizas esperando firma.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {pendingDocsClients.map((c) => (
                      <div
                        key={c.id}
                        className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-950/10 hover:border-amber-500/40 transition-all space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold text-slate-100">{c.name}</p>
                            {c.company && (
                              <p className="text-[11px] text-slate-400">{c.company}</p>
                            )}
                          </div>
                          <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Pte. Firma
                          </span>
                        </div>

                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                          {c.phone ? (
                            <WhatsAppButton
                              phone={c.phone}
                              message={`Hola ${c.name}, te contacto desde Barymont para recordar la documentación pendiente.`}
                              className="h-7 px-2.5 text-[11px]"
                            />
                          ) : <div />}
                          <Link
                            href={`/clientes/${c.id}`}
                            className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                          >
                            Ver Ficha <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: PRIORIDAD COMERCIAL */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex items-center gap-2 border-l-4 border-sky-400 pl-3">
              <h2 className="text-base font-black text-slate-100 uppercase tracking-wider">
                Prioridades Comerciales de la Cartera
              </h2>
              <span className="text-xs text-slate-400">
                · Oportunidades calientes (&gt;60%) y propuestas en negociación
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Oportunidades Calientes */}
              <div className="card p-5 bg-[#0a1424]/90 border border-[#d9b35f]/30 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#f5d48a] uppercase tracking-wider flex items-center gap-2">
                    <Flame className="h-4 w-4 text-[#f5d48a]" />
                    Oportunidades Calientes ({hotOpportunities.length})
                  </h3>
                </div>

                {hotOpportunities.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 space-y-1">
                    <p>No hay operaciones marcadas con probabilidad &gt;60%.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {hotOpportunities.map((opp) => (
                      <div
                        key={opp.id}
                        className="p-3.5 rounded-xl border border-[#d9b35f]/20 bg-[#0d1c33] hover:border-[#d9b35f]/40 transition-all space-y-2"
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
                          {opp.client_id ? (
                            <Link
                              href={`/clientes/${opp.client_id}`}
                              className="text-[11px] font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1"
                            >
                              Ficha Cliente <ChevronRight className="h-3 w-3" />
                            </Link>
                          ) : (
                            <span className="text-[10px] text-slate-500">Sin cliente asociado</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Propuestas en Negociación */}
              <div className="card p-5 bg-[#0a1424]/90 border border-slate-700/80 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Send className="h-4 w-4 text-blue-400" />
                    Propuestas Enviadas & Negociación ({proposalWaitingOpps.length})
                  </h3>
                </div>

                {proposalWaitingOpps.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 space-y-1">
                    <p>No hay propuestas pendientes de respuesta en este momento.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {proposalWaitingOpps.map((opp) => (
                      <div
                        key={opp.id}
                        className="p-3.5 rounded-xl border border-blue-500/20 bg-[#0b172a] hover:border-blue-500/40 transition-all space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold text-slate-100">{opp.title}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {opp.client_name ? `Cliente: ${opp.client_name}` : "Prospecto"}
                            </p>
                          </div>
                          <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0">
                            {CRM_STAGE_LABELS[opp.stage] || opp.stage}
                          </span>
                        </div>

                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                          <span className="font-mono font-black text-sky-400">
                            {Number(opp.estimated_value || 0).toLocaleString("es-ES")} €
                          </span>
                          {opp.next_action && (
                            <span className="text-[10px] text-amber-400 flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {opp.next_action}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* View 2: Visual Pipeline Kanban (6 Etapas Sobrias) */}
      {viewMode === "pipeline" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                Pipeline de Soluciones Financieras Barymont
              </h2>
              <p className="text-xs text-slate-400">
                Flujo visual de 6 etapas comerciales desde el primer contacto hasta el cierre de póliza o plan.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-[#f5d48a] self-start sm:self-auto">
              Total Pipeline: {pipelineValue.toLocaleString("es-ES")} €
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3.5 overflow-x-auto pb-4">
            {PIPELINE_COLUMNS.map((col) => {
              const colOpps = opportunities.filter((o) => o.stage === col.key);
              const colTotal = colOpps.reduce((acc, o) => acc + Number(o.estimated_value || 0), 0);

              return (
                <div
                  key={col.key}
                  className={`rounded-2xl border ${col.headerBorder} bg-[#091322]/90 p-3.5 flex flex-col justify-between space-y-3 min-w-[230px] shadow-md`}
                >
                  <div className="space-y-3">
                    {/* Column Header */}
                    <div className="space-y-1 pb-2.5 border-b border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200">{col.label}</span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${col.badgeBg}`}>
                          {colOpps.length}
                        </span>
                      </div>
                      <p className="text-xs font-mono font-bold text-[#f5d48a]">
                        {colTotal.toLocaleString("es-ES")} €
                      </p>
                    </div>

                    {/* Column Cards */}
                    <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-0.5">
                      {colOpps.length === 0 ? (
                        <div className="p-4 text-center text-[11px] text-slate-500 rounded-xl border border-dashed border-slate-800">
                          Sin operaciones
                        </div>
                      ) : (
                        colOpps.map((opp) => (
                          <div
                            key={opp.id}
                            className="p-3.5 rounded-xl border border-slate-800 bg-[#0d1a2d] hover:border-slate-700 transition-all space-y-2 shadow-sm group"
                          >
                            <div>
                              <p className="text-xs font-bold text-slate-100 group-hover:text-sky-300 transition-colors">
                                {opp.title}
                              </p>
                              {opp.client_name && (
                                <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                                  <Users className="h-3 w-3 text-slate-500" />
                                  {opp.client_name}
                                </p>
                              )}
                              {opp.client_company && (
                                <p className="text-[10px] text-slate-500 flex items-center gap-1">
                                  <Building2 className="h-2.5 w-2.5 text-slate-600" />
                                  {opp.client_company}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80">
                              <span className="font-mono font-black text-[#f5d48a]">
                                {Number(opp.estimated_value || 0).toLocaleString("es-ES")} €
                              </span>
                              {opp.probability !== undefined && (
                                <span className="text-[10px] font-bold text-slate-400">
                                  {opp.probability}%
                                </span>
                              )}
                            </div>

                            {opp.next_action && (
                              <p className="text-[10px] text-amber-400 truncate flex items-center gap-1">
                                <Clock className="h-3 w-3 shrink-0" />
                                {opp.next_action}
                              </p>
                            )}

                            {/* Stage Selector */}
                            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1">
                              <select
                                value={opp.stage}
                                onChange={(e) => handleStageChange(opp.id, e.target.value as CrmStage)}
                                className="input-field text-[10px] py-1 px-1.5 h-7 bg-slate-900 border-slate-700 text-slate-300 w-full rounded-lg"
                              >
                                {CRM_STAGES.slice(0, 11).map((st) => (
                                  <option key={st} value={st}>
                                    {CRM_STAGE_LABELS[st]}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Nueva Oportunidad */}
      {showNewOppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="card w-full max-w-lg p-6 bg-[#0c182c] border border-slate-700 shadow-2xl space-y-4 animate-scale-in max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Plus className="h-5 w-5 text-[#f5d48a]" />
              Nueva Oportunidad Comercial (Barymont)
            </h3>
            <form onSubmit={handleCreateOpp} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300">Cliente Asociado:</label>
                <select
                  value={newOppForm.client_id}
                  onChange={(e) => setNewOppForm({ ...newOppForm, client_id: e.target.value })}
                  className="input-field text-xs w-full mt-1"
                >
                  <option value="">-- Sin cliente específico --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.company ? `(${c.company})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">Plan / Solución Financiera *:</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Plan de Ahorro PIAS / Seguro Protección Familiar"
                  value={newOppForm.title}
                  onChange={(e) => setNewOppForm({ ...newOppForm, title: e.target.value })}
                  className="input-field text-xs w-full mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300">Valor Estimado (€):</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={newOppForm.estimated_value}
                    onChange={(e) => setNewOppForm({ ...newOppForm, estimated_value: e.target.value })}
                    className="input-field text-xs w-full mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300">Etapa Comercial:</label>
                  <select
                    value={newOppForm.stage}
                    onChange={(e) => {
                      const st = e.target.value as CrmStage;
                      setNewOppForm({
                        ...newOppForm,
                        stage: st,
                        probability: STAGE_PROBABILITIES[st] || 20,
                      });
                    }}
                    className="input-field text-xs w-full mt-1"
                  >
                    {CRM_STAGES.slice(0, 11).map((st) => (
                      <option key={st} value={st}>
                        {CRM_STAGE_LABELS[st]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300">Próxima Acción:</label>
                  <input
                    type="text"
                    placeholder="Ej: Presentación de propuesta"
                    value={newOppForm.next_action}
                    onChange={(e) => setNewOppForm({ ...newOppForm, next_action: e.target.value })}
                    className="input-field text-xs w-full mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300">Fecha Próxima Acción:</label>
                  <input
                    type="date"
                    value={newOppForm.next_action_at}
                    onChange={(e) => setNewOppForm({ ...newOppForm, next_action_at: e.target.value })}
                    className="input-field text-xs w-full mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">Notas / Diagnóstico:</label>
                <textarea
                  rows={2}
                  placeholder="Detalles sobre perfil de riesgo, ahorro mensual u objetivos..."
                  value={newOppForm.notes}
                  onChange={(e) => setNewOppForm({ ...newOppForm, notes: e.target.value })}
                  className="input-field text-xs w-full mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setShowNewOppModal(false)}>
                  Cancelar
                </Button>
                <Button variant="primary" size="sm" type="submit">
                  Crear Oportunidad
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
