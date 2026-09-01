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
  User,
  MapPin,
  Calendar,
  Sparkles,
  DollarSign,
  AlertCircle,
  Tag,
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

  // 5 Tabs: Resumen, Actividad, Oportunidades, Tareas, Documentos
  const [activeTab, setActiveTab] = useState<"resumen" | "actividad" | "oportunidades" | "tareas" | "documentos">("resumen");

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
        showToast("success", "Ficha actualizada");
        setShowEditClientModal(false);
        loadData();
      }
    } catch {
      showToast("error", "Error al actualizar ficha");
    }
  };
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0284c7] border-t-transparent" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="card p-12 text-center text-slate-400 space-y-4 max-w-lg mx-auto mt-12">
        <AlertCircle className="h-10 w-10 mx-auto text-rose-400" />
        <h2 className="text-lg font-bold text-slate-100">Cliente no encontrado</h2>
        <p className="text-xs text-slate-400">El registro solicitado no existe o ha sido eliminado.</p>
        <Link href="/clientes" className="btn-secondary text-xs inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Volver al Directorio
        </Link>
      </div>
    );
  }

  const currentStageKey = (client.status || "nuevo") as CrmStage;
  const currentBadge = CRM_STAGE_BADGES[currentStageKey] || CRM_STAGE_BADGES.nuevo;
  const totalOppValue = opportunities.reduce((acc, o) => acc + Number(o.estimated_value || 0), 0);
  const pendingTasksCount = tasks.filter((t) => t.status === "pending").length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Breadcrumbs
          items={[
            { label: "Clientes", href: "/clientes" },
            { label: client.name },
          ]}
        />
        <Link href="/clientes" className="btn-ghost text-xs flex items-center gap-1.5 text-slate-400 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver
        </Link>
      </div>

      {/* Main Client Profile Header Card */}
      <div className="card p-6 sm:p-7 bg-gradient-to-br from-[#06101c] via-[#0a1829] to-[#0d223a] border border-slate-700/80 shadow-2xl relative overflow-hidden space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          {/* Avatar & Basic Info */}
          <div className="flex items-start sm:items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0284c7] via-[#0369a1] to-[#0b1b30] text-xl font-black text-white border border-sky-400/40 shadow-lg shrink-0">
              {client.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-100">{client.name}</h1>
                <span
                  className={`px-3 py-0.5 text-xs font-bold rounded-full border ${currentBadge.bg} ${currentBadge.text} ${currentBadge.border}`}
                >
                  {CRM_STAGE_LABELS[currentStageKey] || currentStageKey}
                </span>
              </div>
              {client.company && (
                <p className="text-xs sm:text-sm text-slate-300 flex items-center gap-1.5 mt-1">
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />
                  {client.company}
                </p>
              )}
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {client.phone && (
              <WhatsAppButton
                phone={client.phone}
                message={`Hola ${client.name}, te contacto desde Barymont.`}
                className="h-9 px-3.5 text-xs"
              />
            )}
            {client.phone && (
              <a
                href={`tel:${client.phone}`}
                className="btn-secondary h-9 px-3.5 flex items-center gap-1.5 text-xs font-bold text-sky-400 border-sky-500/30"
              >
                <Phone className="h-3.5 w-3.5" /> Llamar
              </a>
            )}
            {client.email && (
              <a
                href={`mailto:${client.email}`}
                className="btn-secondary h-9 px-3.5 flex items-center gap-1.5 text-xs font-bold text-slate-300"
              >
                <Mail className="h-3.5 w-3.5" /> Email
              </a>
            )}
            <Button
              variant="secondary"
              size="sm"
              icon={Edit2}
              onClick={() => setShowEditClientModal(true)}
              className="h-9 px-3.5 text-xs"
            >
              Editar Ficha
            </Button>
          </div>
        </div>

        {/* Quick Stage Status Ribbon & Mini KPIs */}
        <div className="pt-4 border-t border-slate-800/90 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Quick Stage Selector */}
          <div className="md:col-span-8 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-2">
              Cambiar Etapa:
            </span>
            {CRM_STAGES.slice(0, 7).map((st) => {
              const isCurrent = currentStageKey === st;
              return (
                <button
                  key={st}
                  onClick={() => handleStatusChange(st)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                    isCurrent
                      ? "bg-[#d9b35f] text-slate-950 shadow-sm ring-1 ring-[#f5d48a]"
                      : "bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800"
                  }`}
                >
                  {CRM_STAGE_LABELS[st]}
                </button>
              );
            })}
          </div>

          {/* Mini KPIs */}
          <div className="md:col-span-4 flex items-center justify-end gap-4 text-xs">
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Pipeline Oportunidades</span>
              <p className="font-mono font-black text-sm text-[#f5d48a]">
                {totalOppValue.toLocaleString("es-ES")} €
              </p>
            </div>
            <div className="text-right border-l border-slate-800 pl-4">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Tareas Pendientes</span>
              <p className="font-mono font-black text-sm text-amber-400">
                {pendingTasksCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-slate-700/80 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setActiveTab("resumen")}
          className={`px-4 py-2.5 font-bold rounded-xl transition-all ${
            activeTab === "resumen"
              ? "bg-[#d9b35f] text-slate-950 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          Resumen Comercial
        </button>

        <button
          onClick={() => setActiveTab("actividad")}
          className={`px-4 py-2.5 font-bold rounded-xl flex items-center gap-1.5 transition-all ${
            activeTab === "actividad"
              ? "bg-[#d9b35f] text-slate-950 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          Actividad & Timeline ({activities.length})
        </button>

        <button
          onClick={() => setActiveTab("oportunidades")}
          className={`px-4 py-2.5 font-bold rounded-xl flex items-center gap-1.5 transition-all ${
            activeTab === "oportunidades"
              ? "bg-[#d9b35f] text-slate-950 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          Oportunidades & Planes ({opportunities.length})
        </button>

        <button
          onClick={() => setActiveTab("tareas")}
          className={`px-4 py-2.5 font-bold rounded-xl flex items-center gap-1.5 transition-all ${
            activeTab === "tareas"
              ? "bg-[#d9b35f] text-slate-950 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          Tareas & Recordatorios ({tasks.length})
        </button>

        <button
          onClick={() => setActiveTab("documentos")}
          className={`px-4 py-2.5 font-bold rounded-xl flex items-center gap-1.5 transition-all ${
            activeTab === "documentos"
              ? "bg-[#d9b35f] text-slate-950 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          Documentos & Facturas ({invoices.length + budgets.length})
        </button>
      </div>
      {/* Tab 1: Resumen Comercial */}
      {activeTab === "resumen" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-8 space-y-6">
            <div className="card p-6 bg-[#0a1424]/90 border border-slate-700/80 space-y-4">
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Building2 className="h-4 w-4 text-sky-400" />
                Información de Contacto y Empresa
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-slate-400 font-bold">Teléfono:</span>
                  <p className="text-slate-200 font-mono text-sm">{client.phone || "No especificado"}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 font-bold">Email:</span>
                  <p className="text-slate-200 text-sm truncate">{client.email || "No especificado"}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 font-bold">Dirección:</span>
                  <p className="text-slate-200">{client.address || "No especificada"}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 font-bold">Ciudad / Población:</span>
                  <p className="text-slate-200">{client.city || "No especificada"}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 font-bold">Origen / Canal de captación:</span>
                  <p className="text-slate-200">{client.source || "Contacto directo"}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 font-bold">Fecha de Alta:</span>
                  <p className="text-slate-200">
                    {client.created_at ? new Date(client.created_at).toLocaleDateString("es-ES") : "Reciente"}
                  </p>
                </div>
              </div>
            </div>

            {/* Diagnóstico / Notas */}
            <div className="card p-6 bg-[#0a1424]/90 border border-slate-700/80 space-y-3">
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-400" />
                Notas y Diagnóstico Patrimonial
              </h2>
              {client.notes ? (
                <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed bg-[#0c182c] p-4 rounded-xl border border-slate-800">
                  {client.notes}
                </p>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  Sin notas adicionales registradas. Utiliza el botón "Editar Ficha" para añadir un balance preliminar.
                </p>
              )}
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="lg:col-span-4 space-y-6">
            {/* Quick Summary Card */}
            <div className="card p-5 bg-[#0a1424]/90 border border-[#d9b35f]/30 space-y-4">
              <h3 className="text-xs font-bold text-[#f5d48a] uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#f5d48a]" />
                Estado del Prospecto
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Estado Actual:</span>
                  <span className="font-bold text-slate-100">{CRM_STAGE_LABELS[currentStageKey]}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Soluciones asociadas:</span>
                  <span className="font-bold text-sky-400">{opportunities.length}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Total en cartera:</span>
                  <span className="font-mono font-bold text-[#f5d48a]">{totalOppValue.toLocaleString("es-ES")} €</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card p-5 bg-[#0a1424]/90 border border-slate-700/80 space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Acciones Rápidas</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setShowActivityModal(true)}
                  className="w-full btn-secondary text-xs flex items-center justify-center gap-2"
                >
                  <Plus className="h-4 w-4" /> Registrar Interacción
                </button>
                <button
                  onClick={() => setShowOppModal(true)}
                  className="w-full btn-secondary text-xs flex items-center justify-center gap-2 text-sky-400 border-sky-500/30"
                >
                  <BriefcaseBusiness className="h-4 w-4" /> Nueva Oportunidad
                </button>
                <button
                  onClick={() => setShowTaskModal(true)}
                  className="w-full btn-secondary text-xs flex items-center justify-center gap-2 text-amber-400 border-amber-500/30"
                >
                  <Clock className="h-4 w-4" /> Agendar Recordatorio
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Actividad & Timeline */}
      {activeTab === "actividad" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <History className="h-4 w-4 text-sky-400" />
              Cronología de Interacciones Comerciales
            </h2>
            <Button
              variant="secondary"
              size="sm"
              icon={Plus}
              onClick={() => setShowActivityModal(true)}
            >
              Registrar Actividad
            </Button>
          </div>

          {activities.length === 0 ? (
            <div className="card p-12 text-center text-slate-400 space-y-2">
              <History className="h-8 w-8 mx-auto text-slate-500" />
              <p className="text-xs font-bold text-slate-200">Sin interacciones registradas</p>
              <p className="text-[11px] text-slate-500">Registra una llamada, reunión o nota para iniciar el timeline.</p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-700">
              {activities.map((act) => (
                <div key={act.id} className="relative space-y-1">
                  <div className="absolute -left-6 top-1 h-4 w-4 rounded-full bg-slate-900 border-2 border-[#0284c7] flex items-center justify-center" />
                  <div className="card p-4 bg-[#0a1424]/90 border border-slate-700/80 space-y-1.5 hover:border-slate-600 transition-all">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-100 flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-800 text-sky-400">
                          {act.type}
                        </span>
                        {act.title}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {act.occurred_at ? new Date(act.occurred_at).toLocaleString("es-ES") : ""}
                      </span>
                    </div>
                    {act.description && (
                      <p className="text-xs text-slate-300 leading-relaxed pt-1">
                        {act.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Tab 3: Oportunidades */}
      {activeTab === "oportunidades" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <BriefcaseBusiness className="h-4 w-4 text-[#f5d48a]" />
              Oportunidades & Soluciones en Curso
            </h2>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setShowOppModal(true)}
            >
              Nueva Oportunidad
            </Button>
          </div>

          {opportunities.length === 0 ? (
            <div className="card p-12 text-center text-slate-400 space-y-2">
              <BriefcaseBusiness className="h-8 w-8 mx-auto text-slate-500" />
              <p className="text-xs font-bold text-slate-200">Sin oportunidades comerciales abiertas</p>
              <p className="text-[11px] text-slate-500">Crea una propuesta de PIAS, jubilación, protección o salud.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {opportunities.map((opp) => (
                <div
                  key={opp.id}
                  className="card p-5 bg-[#0a1424]/90 border border-slate-700/80 hover:border-[#d9b35f]/40 transition-all space-y-3 shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-sm text-slate-100">{opp.title}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Etapa: <strong className="text-slate-200">{CRM_STAGE_LABELS[opp.stage]}</strong>
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 text-xs font-mono font-bold rounded-full bg-[#d9b35f]/20 text-[#f5d48a] border border-[#d9b35f]/30">
                      {opp.probability || 20}%
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Valor Estimado</span>
                      <p className="font-mono font-black text-base text-[#f5d48a]">
                        {Number(opp.estimated_value || 0).toLocaleString("es-ES")} €
                      </p>
                    </div>

                    {opp.next_action && (
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Próxima acción</span>
                        <p className="text-xs text-amber-400 font-medium flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {opp.next_action}
                        </p>
                      </div>
                    )}
                  </div>

                  {opp.notes && (
                    <p className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                      {opp.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Tareas */}
      {activeTab === "tareas" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Tareas y Recordatorios Comerciales
            </h2>
            <Button
              variant="secondary"
              size="sm"
              icon={Plus}
              onClick={() => setShowTaskModal(true)}
            >
              Agendar Tarea
            </Button>
          </div>

          {tasks.length === 0 ? (
            <div className="card p-12 text-center text-slate-400 space-y-2">
              <CheckCircle2 className="h-8 w-8 mx-auto text-slate-500" />
              <p className="text-xs font-bold text-slate-200">Sin tareas pendientes</p>
              <p className="text-[11px] text-slate-500">Todo el seguimiento de este cliente está al día.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className={`card p-4 border transition-all flex items-center justify-between gap-4 ${
                    t.status === "completed"
                      ? "bg-slate-950/40 border-slate-800/60 opacity-60"
                      : "bg-[#0a1424]/90 border-slate-700/80 hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleCompleteTask(t.id)}
                      className={`h-5 w-5 rounded border flex items-center justify-center transition-colors ${
                        t.status === "completed"
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                          : "border-slate-600 hover:border-emerald-400 text-transparent hover:text-emerald-400"
                      }`}
                    >
                      ✓
                    </button>
                    <div>
                      <p
                        className={`text-xs font-bold ${
                          t.status === "completed" ? "line-through text-slate-400" : "text-slate-100"
                        }`}
                      >
                        {t.title}
                      </p>
                      {t.due_at && (
                        <p className="text-[10px] text-amber-400 mt-0.5 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Vence: {new Date(t.due_at).toLocaleDateString("es-ES")}
                        </p>
                      )}
                    </div>
                  </div>

                  {t.priority === "high" && (
                    <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      Alta prioridad
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Documentos */}
      {activeTab === "documentos" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-sky-400" />
              Documentación, Estudios y Facturación
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Presupuestos / Estudios */}
            <div className="card p-5 bg-[#0a1424]/90 border border-slate-700/80 space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#f5d48a]" />
                Estudios / Presupuestos ({budgets.length})
              </h3>
              {budgets.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">Sin presupuestos emitidos</p>
              ) : (
                <div className="space-y-2">
                  {budgets.map((b) => (
                    <Link
                      key={b.id}
                      href={`/presupuestos/${b.id}`}
                      className="p-2.5 rounded-xl border border-slate-800 bg-[#0c182c] hover:border-slate-700 flex items-center justify-between text-xs transition-colors"
                    >
                      <span className="font-bold text-slate-200">{b.number}</span>
                      <span className="font-mono font-bold text-[#f5d48a]">{Number(b.total || 0).toLocaleString("es-ES")} €</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Facturas */}
            <div className="card p-5 bg-[#0a1424]/90 border border-slate-700/80 space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-emerald-400" />
                Facturas Emitidas ({invoices.length})
              </h3>
              {invoices.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">Sin facturas emitidas</p>
              ) : (
                <div className="space-y-2">
                  {invoices.map((inv) => (
                    <Link
                      key={inv.id}
                      href={`/facturas/${inv.id}`}
                      className="p-2.5 rounded-xl border border-slate-800 bg-[#0c182c] hover:border-slate-700 flex items-center justify-between text-xs transition-colors"
                    >
                      <span className="font-bold text-slate-200">{inv.number}</span>
                      <span className="font-mono font-bold text-emerald-400">{Number(inv.total || 0).toLocaleString("es-ES")} €</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Registrar Actividad */}
      {showActivityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="card w-full max-w-md p-6 bg-[#0c182c] border border-slate-700 shadow-2xl space-y-4 animate-scale-in">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Plus className="h-5 w-5 text-sky-400" />
              Registrar Interacción con el Cliente
            </h3>
            <form onSubmit={handleSaveActivity} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300">Tipo de interacción:</label>
                <select
                  value={activityForm.type}
                  onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value })}
                  className="input-field text-xs w-full mt-1"
                >
                  <option value="llamada">📞 Llamada telefónica</option>
                  <option value="reunion">👥 Reunión / Visita</option>
                  <option value="whatsapp">💬 WhatsApp / Mensaje</option>
                  <option value="email">✉️ Correo electrónico</option>
                  <option value="nota">📝 Nota / Diagnóstico</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">Título / Resumen breve *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Llamada de revisión de cartera"
                  value={activityForm.title}
                  onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
                  className="input-field text-xs w-full mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">Detalles adicionales:</label>
                <textarea
                  rows={3}
                  placeholder="Puntos tratados, acuerdos o dudas planteadas..."
                  value={activityForm.description}
                  onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                  className="input-field text-xs w-full mt-1"
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

      {/* Modal Nueva Oportunidad */}
      {showOppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="card w-full max-w-lg p-6 bg-[#0c182c] border border-slate-700 shadow-2xl space-y-4 animate-scale-in">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <BriefcaseBusiness className="h-5 w-5 text-[#f5d48a]" />
              Nueva Oportunidad Comercial
            </h3>
            <form onSubmit={handleSaveOpportunity} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300">Plan / Solución *:</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Plan de Ahorro Sistemático PIAS"
                  value={oppForm.title}
                  onChange={(e) => setOppForm({ ...oppForm, title: e.target.value })}
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
                    value={oppForm.estimated_value}
                    onChange={(e) => setOppForm({ ...oppForm, estimated_value: e.target.value })}
                    className="input-field text-xs w-full mt-1"
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
                    placeholder="Ej: Presentar estudio"
                    value={oppForm.next_action}
                    onChange={(e) => setOppForm({ ...oppForm, next_action: e.target.value })}
                    className="input-field text-xs w-full mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300">Fecha Próxima Acción:</label>
                  <input
                    type="date"
                    value={oppForm.next_action_at}
                    onChange={(e) => setOppForm({ ...oppForm, next_action_at: e.target.value })}
                    className="input-field text-xs w-full mt-1"
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

      {/* Modal Agendar Tarea */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="card w-full max-w-md p-6 bg-[#0c182c] border border-slate-700 shadow-2xl space-y-4 animate-scale-in">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-400" />
              Agendar Tarea o Recordatorio
            </h3>
            <form onSubmit={handleSaveTask} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300">Descripción de la tarea *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Llamar para confirmar recepción de propuesta"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="input-field text-xs w-full mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300">Fecha de vencimiento:</label>
                  <input
                    type="date"
                    value={taskForm.due_at}
                    onChange={(e) => setTaskForm({ ...taskForm, due_at: e.target.value })}
                    className="input-field text-xs w-full mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300">Prioridad:</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className="input-field text-xs w-full mt-1"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
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

      {/* Modal Editar Cliente */}
      {showEditClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="card w-full max-w-lg p-6 bg-[#0c182c] border border-slate-700 shadow-2xl space-y-4 animate-scale-in max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-sky-400" />
              Editar Ficha de Cliente
            </h3>
            <form onSubmit={handleSaveClient} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300">Nombre / Contacto *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="input-field text-xs w-full mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300">Empresa:</label>
                  <input
                    type="text"
                    value={editForm.company}
                    onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                    className="input-field text-xs w-full mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300">Teléfono:</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="input-field text-xs w-full mt-1"
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
                    className="input-field text-xs w-full mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300">Origen:</label>
                  <input
                    type="text"
                    value={editForm.source}
                    onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
                    className="input-field text-xs w-full mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">Notas / Diagnóstico:</label>
                <textarea
                  rows={3}
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="input-field text-xs w-full mt-1"
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
