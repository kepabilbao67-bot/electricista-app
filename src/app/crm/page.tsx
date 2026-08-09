"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BriefcaseBusiness, CalendarClock, CheckCircle2, Plus, Search } from "lucide-react";
import { CRM_STAGES, CRM_STAGE_LABELS, CrmStage } from "@/lib/crm";

interface Opportunity {
  id: string;
  client_id: string | null;
  client_name: string | null;
  title: string;
  stage: CrmStage;
  estimated_value: number;
  source: string | null;
  next_action: string | null;
  next_action_at: string | null;
  notes: string | null;
}

interface Client { id: string; name: string }
interface CrmTask {
  id: string;
  client_name: string | null;
  title: string;
  due_at: string | null;
  priority: string;
  status: string;
}

interface CommercialKpis {
  openOpportunities: number;
  openOpportunitiesValue: number;
  pendingInvoices: number;
  pendingInvoicesValue: number;
}
interface CommercialSummary {
  stages: Array<{ stage: string; count: number; total_value: number }>;
  followUps: Array<{ id: string; title: string; client_name: string | null; next_action_at: string }>;
  pendingBudgets: Array<{ id: string; number: string; client_name: string | null; total: number }>;
  activePartes: Array<{ id: string; numero: string; cliente: string; estado: string }>;
  unpaidInvoices: Array<{ id: string; number: string; client_name: string | null; total: number }>;
  kpis: CommercialKpis;
}

const emptyForm = {
  client_id: "", title: "", estimated_value: "", source: "", next_action: "", next_action_at: "", notes: "",
};

export default function CrmPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [commercial, setCommercial] = useState<CommercialSummary | null>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [taskForm, setTaskForm] = useState({ client_id: "", title: "", due_at: "", priority: "normal" });

  const load = useCallback(async () => {
    const [oppsRes, clientsRes, tasksRes, commercialRes] = await Promise.all([
      fetch("/api/opportunities"), fetch("/api/clients"), fetch("/api/crm-tasks?status=pending"), fetch("/api/comercial"),
    ]);
    if (oppsRes.ok) setOpportunities(await oppsRes.json());
    if (clientsRes.ok) setClients(await clientsRes.json());
    if (tasksRes.ok) setTasks(await tasksRes.json());
    if (commercialRes.ok) setCommercial(await commercialRes.json());
  }, []);

  useEffect(() => { load().catch(() => setError("No se pudo cargar el CRM")); }, [load]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return opportunities;
    return opportunities.filter((o) => [o.title, o.client_name, o.source, o.next_action]
      .some((value) => value?.toLowerCase().includes(needle)));
  }, [opportunities, search]);

  const totalPipeline = filtered.reduce((sum, opportunity) => sum + Number(opportunity.estimated_value || 0), 0);

  async function createOpportunity(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError("");
    const response = await fetch("/api/opportunities", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, stage: "nuevo", estimated_value: Number(form.estimated_value) || 0 }),
    });
    if (response.ok) {
      setForm(emptyForm); setShowForm(false); await load();
    } else {
      const data = await response.json().catch(() => ({}));
      setError(data.error || "No se pudo crear la oportunidad");
    }
    setSaving(false);
  }

  async function changeStage(opportunity: Opportunity, stage: CrmStage) {
    const response = await fetch(`/api/opportunities/${opportunity.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...opportunity, stage }),
    });
    if (response.ok) {
      setOpportunities((current) => current.map((item) => item.id === opportunity.id ? { ...item, stage } : item));
    } else setError("No se pudo actualizar la etapa");
  }

  async function completeTask(taskId: string) {
    const response = await fetch(`/api/crm-tasks/${taskId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "completed" }),
    });
    if (response.ok) setTasks((current) => current.filter((task) => task.id !== taskId));
  }

  async function createTask(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/crm-tasks", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(taskForm),
    });
    if (response.ok) { setTaskForm({ client_id: "", title: "", due_at: "", priority: "normal" }); await load(); }
    else setError("No se pudo crear la tarea");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2"><BriefcaseBusiness className="h-6 w-6" /> CRM comercial</h1>
          <p className="page-subtitle">Del primer contacto al cobro, sin duplicar documentos</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((value) => !value)}>
          <Plus className="h-4 w-4" /> {showForm ? "Cancelar" : "Nueva oportunidad"}
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {showForm && (
        <form onSubmit={createOpportunity} className="card grid gap-4 p-5 md:grid-cols-2">
          <div><label className="mb-1 block text-sm font-medium">Título *</label><input className="input-field" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm font-medium">Cliente</label><select className="input-field" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}><option value="">Sin asignar</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></div>
          <div><label className="mb-1 block text-sm font-medium">Valor estimado</label><input className="input-field" type="number" min="0" step="1" value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm font-medium">Origen</label><input className="input-field" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Web, referido, WhatsApp..." /></div>
          <div><label className="mb-1 block text-sm font-medium">Próxima acción</label><input className="input-field" value={form.next_action} onChange={(e) => setForm({ ...form, next_action: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm font-medium">Fecha de próxima acción</label><input className="input-field" type="datetime-local" value={form.next_action_at} onChange={(e) => setForm({ ...form, next_action_at: e.target.value })} /></div>
          <div className="md:col-span-2"><label className="mb-1 block text-sm font-medium">Notas</label><textarea className="input-field" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex gap-2 md:col-span-2"><button className="btn-primary" disabled={saving}>{saving ? "Guardando..." : "Crear oportunidad"}</button><button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button></div>
        </form>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><p className="text-xs font-semibold uppercase text-slate-500">Oportunidades</p><p className="mt-1 text-2xl font-bold">{filtered.length}</p></div>
        <div className="card p-4"><p className="text-xs font-semibold uppercase text-slate-500">Valor estimado</p><p className="mt-1 text-2xl font-bold">{totalPipeline.toFixed(2)} EUR</p></div>
        <div className="card p-4"><p className="text-xs font-semibold uppercase text-slate-500">Acciones pendientes</p><p className="mt-1 text-2xl font-bold">{tasks.length}</p></div>
      </div>

      {commercial && (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="card p-4"><h2 className="mb-3 font-semibold">Presupuestos pendientes</h2><div className="space-y-2">{commercial.pendingBudgets.slice(0, 5).map((item) => <Link key={item.id} href={`/presupuestos/${item.id}`} className="flex justify-between rounded-lg border border-slate-100 p-2 text-sm hover:bg-slate-50"><span>{item.number} · {item.client_name || "Sin cliente"}</span><strong>{Number(item.total).toFixed(2)} EUR</strong></Link>)}{commercial.pendingBudgets.length === 0 && <p className="text-sm text-slate-400">Sin presupuestos enviados pendientes</p>}</div></section>
          <section className="card p-4"><h2 className="mb-3 font-semibold">Trabajos activos</h2><div className="space-y-2">{commercial.activePartes.slice(0, 5).map((item) => <Link key={item.id} href={`/partes-trabajo/${item.id}`} className="flex justify-between rounded-lg border border-slate-100 p-2 text-sm hover:bg-slate-50"><span>{item.numero} · {item.cliente}</span><span className="capitalize text-slate-500">{item.estado}</span></Link>)}{commercial.activePartes.length === 0 && <p className="text-sm text-slate-400">Sin trabajos activos</p>}</div></section>
          <section className="card p-4"><h2 className="mb-3 font-semibold">Cobros pendientes</h2><div className="space-y-2">{commercial.unpaidInvoices.slice(0, 5).map((item) => <Link key={item.id} href={`/facturas/${item.id}`} className="flex justify-between rounded-lg border border-slate-100 p-2 text-sm hover:bg-slate-50"><span>{item.number} · {item.client_name || "Sin cliente"}</span><strong>{Number(item.total).toFixed(2)} EUR</strong></Link>)}{commercial.unpaidInvoices.length === 0 && <p className="text-sm text-slate-400">Sin cobros pendientes</p>}</div></section>
        </div>
      )}

      <div className="relative max-w-xl"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className="input-field pl-10" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente, trabajo, origen o próxima acción" /></div>

      <div className="overflow-x-auto pb-3">
        <div className="grid min-w-[1500px] grid-cols-8 gap-3">
          {CRM_STAGES.map((stage) => {
            const stageItems = filtered.filter((item) => item.stage === stage);
            return <section key={stage} className="rounded-xl bg-slate-100/80 p-3">
              <header className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold text-slate-800">{CRM_STAGE_LABELS[stage]}</h2><span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">{stageItems.length}</span></header>
              <div className="space-y-3">{stageItems.map((opportunity) => <article key={opportunity.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <p className="font-semibold text-slate-900">{opportunity.title}</p>
                {opportunity.client_id ? <Link className="mt-1 block text-xs text-blue-700 hover:underline" href={`/clientes/${opportunity.client_id}`}>{opportunity.client_name}</Link> : <p className="mt-1 text-xs text-amber-700">Sin cliente</p>}
                <p className="mt-2 text-sm font-bold">{Number(opportunity.estimated_value || 0).toFixed(2)} EUR</p>
                {opportunity.next_action && <p className="mt-2 text-xs text-slate-600"><CalendarClock className="mr-1 inline h-3.5 w-3.5" />{opportunity.next_action}</p>}
                <select className="mt-3 w-full rounded-md border border-slate-200 px-2 py-1 text-xs" value={opportunity.stage} onChange={(e) => changeStage(opportunity, e.target.value as CrmStage)}>{CRM_STAGES.map((option) => <option key={option} value={option}>{CRM_STAGE_LABELS[option]}</option>)}</select>
              </article>)}</div>
            </section>;
          })}
        </div>
      </div>

      <section className="card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5" /> Próximas acciones</h2>
        <form onSubmit={createTask} className="mb-4 grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
          <input required className="input-field" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Nueva tarea o recordatorio" />
          <select className="input-field" value={taskForm.client_id} onChange={(e) => setTaskForm({ ...taskForm, client_id: e.target.value })}><option value="">Sin cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
          <input className="input-field" type="datetime-local" value={taskForm.due_at} onChange={(e) => setTaskForm({ ...taskForm, due_at: e.target.value })} />
          <button className="btn-primary">Añadir</button>
        </form>
        <div className="space-y-2">{tasks.slice(0, 10).map((task) => <div key={task.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-3"><div><p className="text-sm font-medium">{task.title}</p><p className="text-xs text-slate-500">{task.client_name || "Sin cliente"}{task.due_at ? ` · ${new Date(task.due_at).toLocaleString("es-ES")}` : ""}</p></div><button className="btn-secondary text-xs" onClick={() => completeTask(task.id)}>Completar</button></div>)}{tasks.length === 0 && <p className="text-sm text-slate-500">No hay acciones pendientes.</p>}</div>
      </section>
    </div>
  );
}
