"use client";

import { useEffect, useState } from "react";
import { Plus, Calendar, Clock, MapPin, Edit2, Trash2, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { showToast } from "@/components/Toast";

interface Client {
  id: string;
  name: string;
}

interface Visit {
  id: string;
  client_id: string;
  client_name: string;
  title: string;
  description: string;
  date: string;
  time: string;
  duration: number;
  status: string;
  address: string;
  notes: string;
}

const statusLabels: Record<string, { label: string; color: string; bg: string }> = {
  scheduled: { label: "Pendiente", color: "text-blue-700", bg: "bg-blue-100 border-blue-300" },
  completed: { label: "Completada", color: "text-emerald-700", bg: "bg-emerald-100 border-emerald-300" },
  cancelled: { label: "Cancelada", color: "text-red-700", bg: "bg-red-100 border-red-300" },
};

function getWeekDates(date: Date): Date[] {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  
  const week: Date[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    week.push(d);
  }
  return week;
}

const dayNames = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes"];

export default function AgendaPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [form, setForm] = useState({
    client_id: "",
    title: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    time: "09:00",
    duration: 60,
    status: "scheduled",
    address: "",
    notes: "",
  });

  const fetchVisits = () => {
    fetch("/api/visits")
      .then((r) => r.json())
      .then((data) => {
        setVisits(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchVisits();
    fetch("/api/clients").then((r) => r.json()).then(setClients);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingVisit ? `/api/visits/${editingVisit.id}` : "/api/visits";
    const method = editingVisit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      showToast("success", editingVisit ? "Visita actualizada" : "Visita creada correctamente");
      setShowForm(false);
      setEditingVisit(null);
      setForm({
        client_id: "",
        title: "",
        description: "",
        date: new Date().toISOString().split("T")[0],
        time: "09:00",
        duration: 60,
        status: "scheduled",
        address: "",
        notes: "",
      });
      fetchVisits();
    } else {
      showToast("error", "Error al guardar la visita");
    }
  };

  const handleEdit = (visit: Visit) => {
    setEditingVisit(visit);
    setForm({
      client_id: visit.client_id || "",
      title: visit.title || "",
      description: visit.description || "",
      date: visit.date || "",
      time: visit.time || "09:00",
      duration: visit.duration || 60,
      status: visit.status || "scheduled",
      address: visit.address || "",
      notes: visit.notes || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Seguro que desea eliminar esta visita?")) {
      const res = await fetch(`/api/visits/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("success", "Visita eliminada");
        fetchVisits();
      } else {
        showToast("error", "Error al eliminar la visita");
      }
    }
  };

  const handleStatusChange = async (visit: Visit, newStatus: string) => {
    const res = await fetch(`/api/visits/${visit.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...visit, client_id: visit.client_id, status: newStatus }),
    });
    if (res.ok) {
      showToast("success", `Visita marcada como ${statusLabels[newStatus]?.label || newStatus}`);
      fetchVisits();
    }
  };

  const getGoogleMapsUrl = (address: string) => {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  };

  const weekDates = getWeekDates(currentWeek);
  const today = new Date().toISOString().split("T")[0];

  const prevWeek = () => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() - 7);
    setCurrentWeek(d);
  };

  const nextWeek = () => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() + 7);
    setCurrentWeek(d);
  };

  const goToToday = () => {
    setCurrentWeek(new Date());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">Agenda</h1>
          <p className="page-subtitle">{visits.length} visitas registradas</p>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              onClick={() => setViewMode("calendar")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "calendar" ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}
            >
              Semanal
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "list" ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}
            >
              Lista
            </button>
          </div>
          <button
            onClick={() => {
              setEditingVisit(null);
              setForm({
                client_id: "",
                title: "",
                description: "",
                date: new Date().toISOString().split("T")[0],
                time: "09:00",
                duration: 60,
                status: "scheduled",
                address: "",
                notes: "",
              });
              setShowForm(true);
            }}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" />
            Nueva visita
          </button>
        </div>
      </div>

      {showForm && (
        <div className="mb-6 card">
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            {editingVisit ? "Editar visita" : "Nueva visita"}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Titulo *</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Cliente</label>
              <select
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                className="input-field"
              >
                <option value="">Sin cliente asociado</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Fecha *</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Hora</label>
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Duracion (min)</label>
              <input
                type="number"
                min="15"
                step="15"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: parseInt(e.target.value) || 60 })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Estado</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="input-field"
              >
                <option value="scheduled">Pendiente</option>
                <option value="completed">Completada</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Direccion</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="input-field"
                placeholder="Ej: Calle Lehendakari Aguirre 7, Berango"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Descripcion</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="input-field"
              />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" className="btn-primary">
                {editingVisit ? "Guardar cambios" : "Crear visita"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn-secondary"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <div className="card p-4 mb-6">
          {/* Week Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevWeek} className="rounded-lg p-2 hover:bg-slate-100 transition-colors">
              <ChevronLeft className="h-5 w-5 text-slate-600" />
            </button>
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-slate-900">
                {weekDates[0].toLocaleDateString("es-ES", { day: "numeric", month: "short" })} - {weekDates[4].toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
              </h3>
              <button onClick={goToToday} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                Hoy
              </button>
            </div>
            <button onClick={nextWeek} className="rounded-lg p-2 hover:bg-slate-100 transition-colors">
              <ChevronRight className="h-5 w-5 text-slate-600" />
            </button>
          </div>

          {/* Week Grid */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            {weekDates.map((date, idx) => {
              const dateStr = date.toISOString().split("T")[0];
              const isToday = dateStr === today;
              const dayVisits = visits.filter((v) => v.date === dateStr);
              
              return (
                <div key={idx} className={`rounded-lg border p-3 min-h-[120px] ${isToday ? "border-indigo-300 bg-indigo-50/30" : "border-slate-200 bg-white"}`}>
                  <div className={`text-xs font-semibold mb-2 ${isToday ? "text-indigo-700" : "text-slate-500"}`}>
                    {dayNames[idx]}
                    <span className={`ml-1 inline-flex items-center justify-center rounded-full w-5 h-5 text-[10px] ${isToday ? "bg-indigo-600 text-white" : "text-slate-600"}`}>
                      {date.getDate()}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {dayVisits.map((visit) => {
                      const st = statusLabels[visit.status] || statusLabels.scheduled;
                      return (
                        <div
                          key={visit.id}
                          className={`rounded-md border px-2 py-1.5 cursor-pointer transition-all hover:shadow-sm ${st.bg}`}
                          onClick={() => handleEdit(visit)}
                        >
                          <p className={`text-[11px] font-semibold truncate ${st.color}`}>{visit.title}</p>
                          {visit.time && (
                            <p className="text-[10px] text-slate-500">{visit.time}</p>
                          )}
                        </div>
                      );
                    })}
                    {dayVisits.length === 0 && (
                      <p className="text-[10px] text-slate-300 text-center pt-2">Sin visitas</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <div className="space-y-3">
          {visits.map((visit) => {
            const status = statusLabels[visit.status] || statusLabels.scheduled;
            return (
              <div key={visit.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="font-semibold text-slate-900">{visit.title}</h3>
                      <span className={`badge ${status.bg} ${status.color} border`}>
                        {status.label}
                      </span>
                    </div>
                    {visit.client_name && (
                      <p className="text-sm text-slate-600 mb-1.5">{visit.client_name}</p>
                    )}
                    <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        {visit.date}
                      </span>
                      {visit.time && (
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          {visit.time} ({visit.duration} min)
                        </span>
                      )}
                      {visit.address && (
                        <a
                          href={getGoogleMapsUrl(visit.address)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 hover:underline"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          {visit.address}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    {visit.description && (
                      <p className="text-xs text-slate-400 mt-2">{visit.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 ml-4">
                    {visit.status === "scheduled" && (
                      <button
                        onClick={() => handleStatusChange(visit, "completed")}
                        className="rounded-lg p-2 text-emerald-500 hover:bg-emerald-50 transition-colors"
                        title="Marcar completada"
                      >
                        <Calendar className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(visit)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(visit.id)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {visits.length === 0 && (
            <div className="card p-12 text-center text-slate-400">
              No hay visitas programadas
            </div>
          )}
        </div>
      )}
    </div>
  );
}
