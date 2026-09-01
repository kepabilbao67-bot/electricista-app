"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Phone,
  Mail,
  FileText,
  ClipboardList,
  Building2,
  BriefcaseBusiness,
  CheckCircle2,
  History,
  Plus,
  Edit2,
  Clock,
  FileCheck,
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

interface ClientDetail {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  source?: string;
  status?: string;
  probability?: number;
  nif?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  province?: string;
  notes?: string;
  client_type?: string;
  created_at?: string;
  updated_at?: string;
}

interface Opportunity {
  id: string;
  title: string;
  stage: CrmStage;
  estimated_value: number;
  probability?: number;
  source?: string;
  next_action?: string | null;
  next_action_at?: string | null;
  notes?: string | null;
}

interface CrmTask {
  id: string;
  title: string;
  due_at: string | null;
  priority: string;
  status: string;
  notes?: string | null;
}

interface CrmActivity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  occurred_at: string;
}

interface Invoice {
  id: string;
  number: string;
  date: string;
  total: number;
  status: string;
}

interface Budget {
  id: string;
  number: string;
  date: string;
  total: number;
  status: string;
}

export default function ClienteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params?.id as string;

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<"actividad" | "oportunidades" | "tareas" | "documentos">("actividad");
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityForm, setActivityForm] = useState({
    type: "llamada",
    title: "",
    description: "",
  });

  const [showOppModal, setShowOppModal] = useState(false);
  const [oppForm, setOppForm] = useState({
    title: "",
    estimated_value: "",
    stage: "nuevo" as CrmStage,
    probability: 20,
    next_action: "",
    next_action_at: "",
    notes: "",
  });

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: "",
    due_at: "",
    priority: "normal",
    notes: "",
  });

  const [showEditClientModal, setShowEditClientModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    company: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    source: "",
    status: "nuevo",
    notes: "",
  });

  const loadData = useCallback(async () => {
    if (!clientId) return;
    try {
      const [
        clientRes,
        oppRes,
        tasksRes,
        actRes,
        invRes,
        budRes,
      ] = await Promise.all([
        fetch(`/api/clients/${clientId}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/opportunities?client_id=${clientId}`).then((r) => (r.ok ? r.json() : [])),
        fetch(`/api/crm-tasks?client_id=${clientId}`).then((r) => (r.ok ? r.json() : [])),
        fetch(`/api/crm-activities?client_id=${clientId}`).then((r) => (r.ok ? r.json() : [])),
        fetch(`/api/invoices?client_id=${clientId}`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(`/api/budgets?client_id=${clientId}`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      ]);

      if (clientRes) {
        setClient(clientRes);
        setEditForm({
          name: clientRes.name || "",
          company: clientRes.company || "",
          phone: clientRes.phone || "",
          email: clientRes.email || "",
          address: clientRes.address || "",
          city: clientRes.city || "",
          source: clientRes.source || "",
          status: clientRes.status || "nuevo",
          notes: clientRes.notes || "",
        });
      }
      setOpportunities(Array.isArray(oppRes) ? oppRes : []);
      setTasks(Array.isArray(tasksRes) ? tasksRes : []);
      setActivities(Array.isArray(actRes) ? actRes : []);
      setInvoices(Array.isArray(invRes) ? invRes : []);
      setBudgets(Array.isArray(budRes) ? budRes : []);
    } catch {
      showToast("error", "Error al cargar datos del cliente");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusChange = async (newStatus: string) => {
    if (!client) return;
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...client, status: newStatus }),
      });
      if (res.ok) {
        setClient({ ...client, status: newStatus });
        await fetch("/api/crm-activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: clientId,
            type: "nota",
            title: "Estado comercial actualizado",
            description: `Nuevo estado: ${CRM_STAGE_LABELS[newStatus as CrmStage] || newStatus}`,
          }),
        });
        showToast("success", "Estado comercial actualizado");
        loadData();
      }
    } catch {
      showToast("error", "No se pudo actualizar el estado");
    }
  };

  const handleSaveActivity = async (e: FormEvent) => {
    e.preventDefault();
    if (!activityForm.title.trim()) return;
    try {
      const res = await fetch("/api/crm-activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          type: activityForm.type,
          title: activityForm.title.trim(),
          description: activityForm.description.trim() || null,
        }),
      });
      if (res.ok) {
        showToast("success", "Actividad registrada");
        setShowActivityModal(false);
        setActivityForm({ type: "llamada", title: "", description: "" });
        loadData();
      }
    } catch {
      showToast("error", "Error al registrar actividad");
    }
  };

  const handleSaveOpportunity = async (e: FormEvent) => {
    e.preventDefault();
    if (!oppForm.title.trim()) return;
    try {
      const res = await fetch("/api/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          title: oppForm.title.trim(),
          stage: oppForm.stage,
          estimated_value: Number(oppForm.estimated_value) || 0,
          probability: Number(oppForm.probability) || 20,
          next_action: oppForm.next_action.trim() || null,
          next_action_at: oppForm.next_action_at || null,
          notes: oppForm.notes.trim() || null,
        }),
      });
      if (res.ok) {
        showToast("success", "Oportunidad creada");
        setShowOppModal(false);
        setOppForm({
          title: "",
          estimated_value: "",
          stage: "nuevo",
          probability: 20,
          next_action: "",
          next_action_at: "",
          notes: "",
        });
        loadData();
      }
    } catch {
      showToast("error", "Error al crear oportunidad");
    }
  };

  const handleSaveTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;
    try {
      const res = await fetch("/api/crm-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          title: taskForm.title.trim(),
          due_at: taskForm.due_at || null,
          priority: taskForm.priority,
          notes: taskForm.notes.trim() || null,
        }),
      });
      if (res.ok) {
        showToast("success", "Tarea agendada");
        setShowTaskModal(false);
        setTaskForm({ title: "", due_at: "", priority: "normal", notes: "" });
        loadData();
      }
    } catch {
      showToast("error", "Error al guardar tarea");
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
        loadData();
      }
    } catch {
      showToast("error", "Error al completar tarea");
    }
  };

  const handleSaveClient = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        showToast("success", "Cliente actualizado");
        setShowEditClientModal(false);
        loadData();
      }
    } catch {
      showToast("error", "Error al actualizar cliente");
    }
  };
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="space-y-4">
        <p className="text-slate-400">Cliente no encontrado</p>
        <Link href="/clientes" className="btn-secondary">
          Volver a Clientes
        </Link>
      </div>
    );
  }

  const clientStageKey = (client.status || "nuevo") as CrmStage;
  const stageBadge = CRM_STAGE_BADGES[clientStageKey] || CRM_STAGE_BADGES.nuevo;
  const totalOppsValue = opportunities.reduce((acc, o) => acc + Number(o.estimated_value || 0), 0);
  const pendingTasksCount = tasks.filter((t) => t.status === "pending").length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <Breadcrumbs
          items={[
            { label: "Clientes", href: "/clientes" },
            { label: client.name },
          ]}
        />
        <Link
          href="/clientes"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al listado
        </Link>
      </div>

      <div className="card p-6 border border-slate-700/80 bg-slate-900/90 shadow-xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-sky-600 text-xl font-black text-white shadow-md ring-2 ring-blue-400/30 shrink-0">
              {client.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-black text-slate-100 tracking-tight">
                  {client.name}
                </h1>
                <span
                  className={`px-3 py-0.5 text-xs font-bold rounded-full border ${stageBadge.bg} ${stageBadge.text} ${stageBadge.border}`}
                >
                  {CRM_STAGE_LABELS[clientStageKey] || clientStageKey}
                </span>
                {client.company && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    <Building2 className="h-3 w-3 text-slate-400" />
                    {client.company}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Alta: {client.created_at ? new Date(client.created_at).toLocaleDateString("es-ES") : "Reciente"}
                {client.source && ` • Origen: ${client.source}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {client.phone && (
              <a
                href={`tel:${client.phone}`}
                className="btn-secondary h-10 px-3.5 flex items-center gap-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/10"
                title="Llamar directamente"
              >
                <Phone className="h-4 w-4" />
                <span>Llamar</span>
              </a>
            )}

            {client.phone && (
              <WhatsAppButton
                phone={client.phone}
                message={"Hola " + client.name}
                className="h-10 text-xs px-3.5"
              />
            )}

            {client.email && (
              <a
                href={`mailto:${client.email}`}
                className="btn-secondary h-10 px-3.5 flex items-center gap-2 text-xs font-bold text-sky-400 hover:text-sky-300 border-sky-500/30 hover:bg-sky-500/10"
                title="Enviar correo"
              >
                <Mail className="h-4 w-4" />
                <span>Email</span>
              </a>
            )}

            <Button
              variant="secondary"
              size="sm"
              icon={Edit2}
              onClick={() => setShowEditClientModal(true)}
              className="h-10 text-xs"
            >
              Editar Ficha
            </Button>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Estado Comercial:
            </span>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {CRM_STAGES.slice(0, 11).map((st) => {
                const isActive = (client.status || "nuevo") === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleStatusChange(st)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                      isActive
                        ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-400/40"
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-700"
                    }`}
                  >
                    {CRM_STAGE_LABELS[st]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-center min-w-[100px]">
              <p className="text-xs text-slate-400 font-medium">Pipeline</p>
              <p className="text-sm font-black text-sky-400">
                {totalOppsValue.toLocaleString("es-ES", { minimumFractionDigits: 0 })} €
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-center min-w-[100px]">
              <p className="text-xs text-slate-400 font-medium">Tareas Pte.</p>
              <p className="text-sm font-black text-amber-400">
                {pendingTasksCount}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card variant="default" className="p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-400" />
              Datos de Contacto
            </h3>

            <div className="space-y-3 text-xs">
              {client.company && (
                <div>
                  <span className="text-slate-400">Empresa / Negocio:</span>
                  <p className="font-semibold text-slate-200 mt-0.5">{client.company}</p>
                </div>
              )}

              {client.phone && (
                <div>
                  <span className="text-slate-400">Teléfono:</span>
                  <p className="font-semibold text-slate-200 mt-0.5">{client.phone}</p>
                </div>
              )}

              {client.email && (
                <div>
                  <span className="text-slate-400">Email:</span>
                  <p className="font-semibold text-slate-200 mt-0.5 break-all">{client.email}</p>
                </div>
              )}

              {client.address && (
                <div>
                  <span className="text-slate-400">Dirección:</span>
                  <p className="font-semibold text-slate-200 mt-0.5">
                    {client.address} {client.city ? `(${client.city})` : ""}
                  </p>
                </div>
              )}

              {client.nif && (
                <div>
                  <span className="text-slate-400">NIF / CIF:</span>
                  <p className="font-semibold text-slate-200 mt-0.5">{client.nif}</p>
                </div>
              )}

              {client.source && (
                <div>
                  <span className="text-slate-400">Origen del contacto:</span>
                  <p className="font-semibold text-slate-200 mt-0.5">{client.source}</p>
                </div>
              )}
            </div>
          </Card>

          <Card variant="default" className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-400" />
                Notas y Diagnóstico
              </h3>
            </div>
            <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
              {client.notes || "Sin notas adicionales registradas."}
            </p>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-700 pb-2">
            <button
              onClick={() => setActiveTab("actividad")}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all ${
                activeTab === "actividad"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <History className="h-3.5 w-3.5" />
              Actividad ({activities.length})
            </button>

            <button
              onClick={() => setActiveTab("oportunidades")}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all ${
                activeTab === "oportunidades"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <BriefcaseBusiness className="h-3.5 w-3.5" />
              Oportunidades ({opportunities.length})
            </button>

            <button
              onClick={() => setActiveTab("tareas")}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all ${
                activeTab === "tareas"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Tareas ({pendingTasksCount})
            </button>

            <button
              onClick={() => setActiveTab("documentos")}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all ${
                activeTab === "documentos"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <FileCheck className="h-3.5 w-3.5" />
              Documentos & Propuestas
            </button>
          </div>

          {activeTab === "actividad" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Historial Cronológico de Interacciones
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  onClick={() => setShowActivityModal(true)}
                  className="text-xs"
                >
                  Registrar Actividad
                </Button>
              </div>

              {activities.length === 0 ? (
                <div className="card p-8 text-center text-slate-400 text-xs space-y-2">
                  <History className="h-8 w-8 mx-auto text-slate-500" />
                  <p className="font-semibold">Sin actividad registrada aún</p>
                  <p className="text-[11px] text-slate-500">
                    Registra llamadas, reuniones, mensajes o notas comerciales para hacer seguimiento a este cliente.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activities.map((act) => {
                    const dateStr = new Date(act.occurred_at).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    return (
                      <div
                        key={act.id}
                        className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-1.5 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs text-slate-200 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-400" />
                            {act.title}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">{dateStr}</span>
                        </div>
                        {act.description && (
                          <p className="text-xs text-slate-400 pl-4 whitespace-pre-wrap">
                            {act.description}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "oportunidades" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Operaciones Comerciales & Soluciones
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  onClick={() => setShowOppModal(true)}
                  className="text-xs"
                >
                  Nueva Oportunidad
                </Button>
              </div>

              {opportunities.length === 0 ? (
                <div className="card p-8 text-center text-slate-400 text-xs space-y-2">
                  <BriefcaseBusiness className="h-8 w-8 mx-auto text-slate-500" />
                  <p className="font-semibold">Sin oportunidades abiertas</p>
                  <p className="text-[11px] text-slate-500">
                    Crea una oportunidad para gestionar un plan de ahorro, jubilación o seguro para este cliente.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {opportunities.map((opp) => {
                    const stBadge = CRM_STAGE_BADGES[opp.stage] || CRM_STAGE_BADGES.nuevo;
                    return (
                      <div
                        key={opp.id}
                        className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-bold text-sm text-slate-100">{opp.title}</h4>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Valor estimado:{" "}
                              <span className="font-bold text-sky-400">
                                {Number(opp.estimated_value || 0).toLocaleString("es-ES")} €
                              </span>
                              {opp.probability !== undefined && (
                                <span className="text-slate-400 ml-2">
                                  (Probabilidad: {opp.probability}%)
                                </span>
                              )}
                            </p>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${stBadge.bg} ${stBadge.text} ${stBadge.border}`}
                          >
                            {CRM_STAGE_LABELS[opp.stage] || opp.stage}
                          </span>
                        </div>

                        {opp.next_action && (
                          <div className="pt-2 border-t border-slate-800 text-xs text-slate-300 flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-amber-400" />
                            <span>
                              Próxima acción: <strong>{opp.next_action}</strong>
                              {opp.next_action_at && ` (Fecha: ${opp.next_action_at})`}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "tareas" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Tareas y Recordatorios de Seguimiento
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  onClick={() => setShowTaskModal(true)}
                  className="text-xs"
                >
                  Nueva Tarea
                </Button>
              </div>

              {tasks.length === 0 ? (
                <div className="card p-8 text-center text-slate-400 text-xs space-y-2">
                  <CheckCircle2 className="h-8 w-8 mx-auto text-slate-500" />
                  <p className="font-semibold">Sin tareas registradas</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task) => {
                    const isPending = task.status === "pending";
                    return (
                      <div
                        key={task.id}
                        className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                          isPending
                            ? "bg-slate-900/80 border-slate-800"
                            : "bg-slate-950/40 border-slate-900 opacity-60"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {isPending ? (
                            <button
                              type="button"
                              onClick={() => handleCompleteTask(task.id)}
                              className="h-5 w-5 rounded border border-slate-600 flex items-center justify-center text-transparent hover:border-emerald-400 hover:text-emerald-400 transition-colors"
                              title="Marcar como completada"
                            >
                              ✓
                            </button>
                          ) : (
                            <span className="h-5 w-5 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
                              ✓
                            </span>
                          )}
                          <div>
                            <p
                              className={`text-xs font-bold ${
                                isPending ? "text-slate-200" : "line-through text-slate-500"
                              }`}
                            >
                              {task.title}
                            </p>
                            {task.due_at && (
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Vencimiento: {new Date(task.due_at).toLocaleDateString("es-ES")}
                              </p>
                            )}
                          </div>
                        </div>

                        {task.priority === "high" && (
                          <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            Alta prioridad
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "documentos" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Presupuestos y Facturas Asociadas
                </span>
                <div className="flex gap-2">
                  <Link href="/presupuestos/nuevo" className="btn-secondary text-xs">
                    + Propuesta / Estudio
                  </Link>
                </div>
              </div>

              {budgets.length === 0 && invoices.length === 0 ? (
                <div className="card p-8 text-center text-slate-400 text-xs space-y-2">
                  <FileText className="h-8 w-8 mx-auto text-slate-500" />
                  <p className="font-semibold">Sin propuestas ni facturas emitidas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {budgets.map((b) => (
                    <Link
                      key={b.id}
                      href={`/presupuestos/${b.id}`}
                      className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-between hover:border-slate-700 block transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <ClipboardList className="h-4 w-4 text-amber-400" />
                        <div>
                          <span className="text-xs font-bold text-slate-200">Presupuesto {b.number}</span>
                          <p className="text-[10px] text-slate-400">{b.date}</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-slate-100">
                        {Number(b.total || 0).toLocaleString("es-ES")} €
                      </span>
                    </Link>
                  ))}

                  {invoices.map((inv) => (
                    <Link
                      key={inv.id}
                      href={`/facturas/${inv.id}`}
                      className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-between hover:border-slate-700 block transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-blue-400" />
                        <div>
                          <span className="text-xs font-bold text-slate-200">Factura {inv.number}</span>
                          <p className="text-[10px] text-slate-400">{inv.date}</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-slate-100">
                        {Number(inv.total || 0).toLocaleString("es-ES")} €
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {showActivityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="card w-full max-w-md p-6 bg-slate-900 border border-slate-700 shadow-2xl space-y-4 animate-scale-in">
            <h3 className="text-base font-bold text-slate-100">Registrar Actividad Comercial</h3>
            <form onSubmit={handleSaveActivity} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300">Tipo de interacción:</label>
                <select
                  value={activityForm.type}
                  onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value })}
                  className="input-base text-xs w-full mt-1"
                >
                  <option value="llamada">📞 Llamada telefónica</option>
                  <option value="reunion">📅 Reunión / Cita</option>
                  <option value="mensaje">💬 WhatsApp / Mensaje</option>
                  <option value="email">✉️ Correo electrónico</option>
                  <option value="nota">📝 Nota comercial / Diagnóstico</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">Título / Resumen:</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Llamada de presentación o primera cita"
                  value={activityForm.title}
                  onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
                  className="input-base text-xs w-full mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">Detalles de la conversación:</label>
                <textarea
                  rows={3}
                  placeholder="Acuerdos, dudas del cliente o siguientes pasos..."
                  value={activityForm.description}
                  onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                  className="input-base text-xs w-full mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setShowActivityModal(false)}>
                  Cancelar
                </Button>
                <Button variant="primary" size="sm" type="submit">
                  Guardar Actividad
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showOppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="card w-full max-w-lg p-6 bg-slate-900 border border-slate-700 shadow-2xl space-y-4 animate-scale-in">
            <h3 className="text-base font-bold text-slate-100">Nueva Oportunidad Comercial</h3>
            <form onSubmit={handleSaveOpportunity} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300">Título de la Solución / Plan:</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Plan de Ahorro PIAS / Seguro Protección Familiar"
                  value={oppForm.title}
                  onChange={(e) => setOppForm({ ...oppForm, title: e.target.value })}
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
                    value={oppForm.estimated_value}
                    onChange={(e) => setOppForm({ ...oppForm, estimated_value: e.target.value })}
                    className="input-base text-xs w-full mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300">Etapa Comercial:</label>
                  <select
                    value={oppForm.stage}
                    onChange={(e) => {
                      const st = e.target.value as CrmStage;
                      setOppForm({
                        ...oppForm,
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
                    placeholder="Ej: Enviar propuesta de ahorro"
                    value={oppForm.next_action}
                    onChange={(e) => setOppForm({ ...oppForm, next_action: e.target.value })}
                    className="input-base text-xs w-full mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300">Fecha Próxima Acción:</label>
                  <input
                    type="date"
                    value={oppForm.next_action_at}
                    onChange={(e) => setOppForm({ ...oppForm, next_action_at: e.target.value })}
                    className="input-base text-xs w-full mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setShowOppModal(false)}>
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

      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="card w-full max-w-md p-6 bg-slate-900 border border-slate-700 shadow-2xl space-y-4 animate-scale-in">
            <h3 className="text-base font-bold text-slate-100">Nueva Tarea / Recordatorio</h3>
            <form onSubmit={handleSaveTask} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300">Descripción de la Tarea:</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Llamar para confirmar recepción de póliza"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="input-base text-xs w-full mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300">Fecha de vencimiento:</label>
                  <input
                    type="date"
                    value={taskForm.due_at}
                    onChange={(e) => setTaskForm({ ...taskForm, due_at: e.target.value })}
                    className="input-base text-xs w-full mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300">Prioridad:</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className="input-base text-xs w-full mt-1"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">Alta Prioridad</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setShowTaskModal(false)}>
                  Cancelar
                </Button>
                <Button variant="primary" size="sm" type="submit">
                  Guardar Tarea
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="card w-full max-w-lg p-6 bg-slate-900 border border-slate-700 shadow-2xl space-y-4 animate-scale-in max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-100">Editar Datos del Cliente</h3>
            <form onSubmit={handleSaveClient} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300">Nombre completo / Contacto:</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="input-base text-xs w-full mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300">Empresa / Negocio:</label>
                  <input
                    type="text"
                    value={editForm.company}
                    onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                    className="input-base text-xs w-full mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300">Teléfono:</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="input-base text-xs w-full mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300">Email:</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="input-base text-xs w-full mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300">Origen del contacto:</label>
                  <input
                    type="text"
                    placeholder="Ej: Recomendación, Web, LinkedIn"
                    value={editForm.source}
                    onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
                    className="input-base text-xs w-full mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">Notas / Diagnóstico:</label>
                <textarea
                  rows={3}
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="input-base text-xs w-full mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setShowEditClientModal(false)}>
                  Cancelar
                </Button>
                <Button variant="primary" size="sm" type="submit">
                  Guardar Cambios
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
