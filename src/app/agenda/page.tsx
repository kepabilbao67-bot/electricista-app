"use client";

import { useEffect, useState } from "react";
import { Plus, Calendar, Clock, MapPin, Edit2, Trash2 } from "lucide-react";

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

const statusLabels: Record<string, { label: string; color: string }> = {
  scheduled: { label: "Programada", color: "bg-blue-50 text-blue-700 border border-blue-100" },
  completed: { label: "Completada", color: "bg-emerald-50 text-emerald-700 border border-emerald-100" },
  cancelled: { label: "Cancelada", color: "bg-red-50 text-red-700 border border-red-100" },
};

export default function AgendaPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  const [loading, setLoading] = useState(true);
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

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

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
      await fetch(`/api/visits/${id}`, { method: "DELETE" });
      fetchVisits();
    }
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
                <option value="scheduled">Programada</option>
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

      <div className="space-y-3">
        {visits.map((visit) => {
          const status = statusLabels[visit.status] || statusLabels.scheduled;
          return (
            <div
              key={visit.id}
              className="card p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <h3 className="font-semibold text-slate-900">{visit.title}</h3>
                    <span className={`badge ${status.color}`}>
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
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        {visit.address}
                      </span>
                    )}
                  </div>
                  {visit.description && (
                    <p className="text-xs text-slate-400 mt-2">{visit.description}</p>
                  )}
                </div>
                <div className="flex gap-1 ml-4">
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
    </div>
  );
}
