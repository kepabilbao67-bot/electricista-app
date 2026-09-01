"use client";

import { useEffect, useState, useCallback, useMemo, FormEvent } from "react";
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

// Barymont Kanban Visual Columns
const PIPELINE_COLUMNS: { key: CrmStage; label: string; bgHeader: string }[] = [
  { key: "nuevo", label: "1. Lead / Nuevo", bgHeader: "from-blue-600/20 to-blue-500/10" },
  { key: "contactado", label: "2. Contacto Inicial", bgHeader: "from-sky-600/20 to-sky-500/10" },
  { key: "reunion", label: "3. Reunión / Diagnóstico", bgHeader: "from-purple-600/20 to-purple-500/10" },
  { key: "seguimiento", label: "4. En Seguimiento", bgHeader: "from-amber-600/20 to-amber-500/10" },
  { key: "propuesta", label: "5. Propuesta Enviada", bgHeader: "from-indigo-600/20 to-indigo-500/10" },
  { key: "cliente", label: "6. Cierre Ganado", bgHeader: "from-emerald-600/20 to-emerald-500/10" },
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
  const hotOpportunities = opportunities.filter((o) => (o.probability || 0) >= 60 && !["ganada", "cliente", "perdida", "no_interesado"].includes(o.stage));
  const pendingDocsClients = clients.filter((c) => c.status === "doc_pendiente");

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Breadcrumbs items={[{ label: "CRM & Centro de Trabajo" }]} />
          <h1 className="text-2xl font-black text-slate-100 mt-1 tracking-tight flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-sky-400" />
            Centro Comercial Barymont
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Gestión comercial integral para Pedro: pipeline visual de ventas, agenda y tareas prioritarias.
          </p>
        </div>

        <div className="flex items-center gap-2">
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Pipeline Total</p>
            <p className="text-xl font-black text-sky-400 mt-0.5">
              {(metrics?.pipelineValue || 0).toLocaleString("es-ES", { minimumFractionDigits: 0 })} €
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Ponderado: {(metrics?.weightedPipelineValue || 0).toLocaleString("es-ES", { minimumFractionDigits: 0 })} €
            </p>
          </div>
          <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <DollarSign className="h-5 w-5" />
          </div>
        </div>

        <div className="card p-4 bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Oportunidades Activas</p>
            <p className="text-xl font-black text-slate-100 mt-0.5">
              {metrics?.openOpportunities || 0}
            </p>
            <p className="text-[10px] text-emerald-400 mt-0.5">
              {hotOpportunities.length} calientes (&gt;60%)
            </p>
          </div>
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Briefcase className="h-5 w-5" />
          </div>
        </div>

        <div className="card p-4 bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Tareas Pendientes</p>
            <p className="text-xl font-black text-amber-400 mt-0.5">
              {metrics?.pendingTasks || 0}
            </p>
            <p className="text-[10px] text-amber-400 mt-0.5">
              {metrics?.todayTasks || 0} para hoy
            </p>
          </div>
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="card p-4 bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Cierres Ganados</p>
            <p className="text-xl font-black text-emerald-400 mt-0.5">
              {metrics?.closedWonCount || 0}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {clients.length} contactos totales
            </p>
          </div>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Users className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Switch Views: Centro de Trabajo Diario vs Pipeline Kanban */}
      <div className="flex items-center gap-2 border-b border-slate-700 pb-2">
        <button
          onClick={() => setViewMode("workspace")}
          className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all ${
            viewMode === "workspace"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Centro de Trabajo Diario de Pedro
        </button>

        <button
          onClick={() => setViewMode("pipeline")}
          className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all ${
            viewMode === "pipeline"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          Pipeline Visual Kanban ({opportunities.length})
        </button>
      </div>
      {/* Tab 1: Centro de Trabajo Diario */}
      {viewMode === "workspace" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: Tareas y Llamadas de Hoy */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Tareas & Llamadas Pendientes ({pendingTasks.length})
                </h3>
              </div>

              {pendingTasks.length === 0 ? (
                <div className="card p-6 text-center text-xs text-slate-400">
                  <Check className="h-8 w-8 mx-auto text-emerald-400 mb-1" />
                  <p className="font-semibold">¡Todo al día!</p>
                  <p className="text-[11px] text-slate-500">No hay tareas pendientes para hoy.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingTasks.map((t) => (
                    <div
                      key={t.id}
                      className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/80 hover:border-slate-700 transition-all space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleCompleteTask(t.id)}
                            className="mt-0.5 h-4 w-4 rounded border border-slate-600 flex items-center justify-center text-transparent hover:border-emerald-400 hover:text-emerald-400 transition-colors"
                            title="Marcar como hecha"
                          >
                            ✓
                          </button>
                          <div>
                            <p className="text-xs font-bold text-slate-200">{t.title}</p>
                            {t.client_name && (
                              <p className="text-[11px] text-sky-400 mt-0.5 font-medium">
                                Cliente: {t.client_name}
                              </p>
                            )}
                          </div>
                        </div>

                        {t.priority === "high" && (
                          <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            Alta
                          </span>
                        )}
                      </div>

                      {t.client_phone && (
                        <div className="pt-2 border-t border-slate-800/60 flex items-center gap-2">
                          <WhatsAppButton
                            phone={t.client_phone}
                            message={`Hola ${t.client_name || ""},`}
                            className="h-7 px-2 text-[11px]"
                          />
                          <a
                            href={`tel:${t.client_phone}`}
                            className="btn-secondary h-7 px-2 flex items-center gap-1 text-[11px] text-sky-400 border-sky-500/30"
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

            {/* Column 2: Oportunidades Calientes */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-sky-400" />
                  Oportunidades Calientes ({hotOpportunities.length})
                </h3>
              </div>

              {hotOpportunities.length === 0 ? (
                <div className="card p-6 text-center text-xs text-slate-400">
                  <Briefcase className="h-8 w-8 mx-auto text-slate-500 mb-1" />
                  <p>Sin oportunidades de alta probabilidad (&gt;60%)</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {hotOpportunities.map((opp) => (
                    <div
                      key={opp.id}
                      className="p-3.5 rounded-xl border border-sky-500/20 bg-sky-950/20 hover:border-sky-500/40 transition-all space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-slate-100">{opp.title}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {opp.client_name ? `Cliente: ${opp.client_name}` : "Prospecto"}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                          {opp.probability || 60}%
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="font-black text-sky-400">
                          {Number(opp.estimated_value || 0).toLocaleString("es-ES")} €
                        </span>
                        {opp.client_id && (
                          <Link
                            href={`/clientes/${opp.client_id}`}
                            className="text-[11px] font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-1"
                          >
                            Ver cliente <ChevronRight className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Column 3: Alertas & Documentación Pendiente */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  Documentación Pendiente & Alertas ({pendingDocsClients.length})
                </h3>
              </div>

              {pendingDocsClients.length === 0 ? (
                <div className="card p-6 text-center text-xs text-slate-400">
                  <Check className="h-8 w-8 mx-auto text-emerald-400 mb-1" />
                  <p className="font-semibold">Sin clientes atascados en documentación</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingDocsClients.map((c) => (
                    <div
                      key={c.id}
                      className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-950/20 hover:border-amber-500/40 transition-all space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-slate-100">{c.name}</p>
                          {c.company && (
                            <p className="text-[11px] text-slate-400">{c.company}</p>
                          )}
                        </div>
                        <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Pte. Doc
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                        {c.phone ? (
                          <WhatsAppButton
                            phone={c.phone}
                            message={`Hola ${c.name}, te escribo de Barymont para ver si pudiste revisar la documentación pendiente.`}
                            className="h-7 px-2 text-[11px]"
                          />
                        ) : <div />}
                        <Link
                          href={`/clientes/${c.id}`}
                          className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                        >
                          Ficha <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Tab 2: Visual Pipeline Kanban */}
      {viewMode === "pipeline" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Pipeline de Soluciones Financieras Barymont
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 overflow-x-auto pb-4">
            {PIPELINE_COLUMNS.map((col) => {
              const colOpps = opportunities.filter((o) => o.stage === col.key);
              const colTotal = colOpps.reduce((acc, o) => acc + Number(o.estimated_value || 0), 0);

              return (
                <div
                  key={col.key}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 flex flex-col justify-between space-y-3 min-w-[220px]"
                >
                  <div className="space-y-2">
                    {/* Column Header */}
                    <div className={`p-2.5 rounded-xl bg-gradient-to-r ${col.bgHeader} border border-slate-800 space-y-0.5`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200">{col.label}</span>
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                          {colOpps.length}
                        </span>
                      </div>
                      <p className="text-[11px] font-bold text-sky-400">
                        {colTotal.toLocaleString("es-ES")} €
                      </p>
                    </div>

                    {/* Column Cards */}
                    <div className="space-y-2 max-h-[600px] overflow-y-auto pr-0.5">
                      {colOpps.length === 0 ? (
                        <div className="p-4 text-center text-[11px] text-slate-500 rounded-xl border border-dashed border-slate-800">
                          Sin operaciones
                        </div>
                      ) : (
                        colOpps.map((opp) => (
                          <div
                            key={opp.id}
                            className="p-3 rounded-xl border border-slate-800 bg-slate-900/90 hover:border-slate-700 transition-all space-y-2 shadow-sm"
                          >
                            <div>
                              <p className="text-xs font-bold text-slate-100">{opp.title}</p>
                              {opp.client_name && (
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  {opp.client_name}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-sky-400">
                                {Number(opp.estimated_value || 0).toLocaleString("es-ES")} €
                              </span>
                              {opp.probability !== undefined && (
                                <span className="text-[10px] text-slate-500">
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
                                className="input-base text-[10px] py-1 px-1.5 h-6 bg-slate-800 border-slate-700 text-slate-300 w-full"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="card w-full max-w-lg p-6 bg-slate-900 border border-slate-700 shadow-2xl space-y-4 animate-scale-in">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Plus className="h-5 w-5 text-sky-400" />
              Nueva Oportunidad Comercial Barymont
            </h3>
            <form onSubmit={handleCreateOpp} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300">Cliente Asociado:</label>
                <select
                  value={newOppForm.client_id}
                  onChange={(e) => setNewOppForm({ ...newOppForm, client_id: e.target.value })}
                  className="input-base text-xs w-full mt-1"
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
                  placeholder="Ej: Planificación Jubilación PIAS / Vida Protección"
                  value={newOppForm.title}
                  onChange={(e) => setNewOppForm({ ...newOppForm, title: e.target.value })}
                  className="input-base text-xs w-full mt-1"
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
                    className="input-base text-xs w-full mt-1"
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
                    className="input-base text-xs w-full mt-1"
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
                    className="input-base text-xs w-full mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300">Fecha Próxima Acción:</label>
                  <input
                    type="date"
                    value={newOppForm.next_action_at}
                    onChange={(e) => setNewOppForm({ ...newOppForm, next_action_at: e.target.value })}
                    className="input-base text-xs w-full mt-1"
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
                  className="input-base text-xs w-full mt-1"
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
