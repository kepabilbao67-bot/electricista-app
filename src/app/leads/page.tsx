"use client";

import { useEffect, useState } from "react";
import { Plus, UserPlus, RefreshCw } from "lucide-react";
import { showToast } from "@/components/Toast";

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  interest: string | null;
  message: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

const STATUSES = ["nuevo", "contactado", "cualificado", "convertido", "descartado"];

const STATUS_COLORS: Record<string, string> = {
  nuevo: "bg-blue-50 text-blue-700 border-blue-100",
  contactado: "bg-amber-50 text-amber-700 border-amber-100",
  cualificado: "bg-purple-50 text-purple-700 border-purple-100",
  convertido: "bg-emerald-50 text-emerald-700 border-emerald-100",
  descartado: "bg-slate-100 text-slate-500 border-slate-200",
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    source: "",
    interest: "",
    message: "",
  });

  const fetchLeads = () => {
    fetch("/api/leads")
      .then((res) => res.json())
      .then((data) => {
        setLeads(data);
        setLoading(false);
      })
      .catch(() => {
        showToast("error", "Error al cargar leads");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const fillTestData = () => {
    setForm({
      name: "Cliente prueba",
      email: "cliente.prueba@ejemplo.com",
      phone: "600000000",
      source: "Web",
      interest: "Instalación eléctrica",
      message: "Solicita presupuesto para una instalación eléctrica.",
    });
    if (!showForm) setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        showToast("success", "Lead creado correctamente");
        setForm({ name: "", email: "", phone: "", source: "", interest: "", message: "" });
        setShowForm(false);
        fetchLeads();
      } else {
        const data = await res.json();
        showToast("error", data.error || "Error al crear lead");
      }
    } catch {
      showToast("error", "Error de conexion");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        showToast("success", "Estado actualizado");
        fetchLeads();
      } else {
        const data = await res.json();
        showToast("error", data.error || "Error al actualizar estado");
      }
    } catch {
      showToast("error", "Error de conexion");
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-800 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">Leads</h1>
          <p className="page-subtitle">{leads.length} leads registrados</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fillTestData}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-all"
          >
            <RefreshCw className="h-4 w-4" />
            Rellenar datos de prueba
          </button>
          <button
            onClick={() => {
              setForm({ name: "", email: "", phone: "", source: "", interest: "", message: "" });
              setShowForm(true);
            }}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" />
            Nuevo lead
          </button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="mb-6 card-static animate-scale-in">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Nuevo lead</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field"
                placeholder="Nombre del contacto"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input-field"
                placeholder="email@ejemplo.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Telefono</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="input-field"
                placeholder="600 000 000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Origen</label>
              <input
                type="text"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                className="input-field"
                placeholder="Web, WhatsApp, Referido..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Interes</label>
              <input
                type="text"
                value={form.interest}
                onChange={(e) => setForm({ ...form, interest: e.target.value })}
                className="input-field"
                placeholder="Instalacion electrica, revision..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Mensaje</label>
              <textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                rows={2}
                className="input-field"
                placeholder="Detalle de la solicitud..."
              />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" disabled={submitting} className="btn-primary">
                <UserPlus className="h-4 w-4" />
                {submitting ? "Guardando..." : "Guardar lead"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Leads list */}
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-header">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hidden sm:table-cell">Contacto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hidden md:table-cell">Origen</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hidden lg:table-cell">Interes</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hidden md:table-cell">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="table-row">
                  <td className="px-4 py-3.5">
                    <span className="font-semibold text-slate-900">{lead.name}</span>
                  </td>
                  <td className="px-4 py-3.5 hidden sm:table-cell">
                    <div className="space-y-0.5">
                      {lead.email && <p className="text-xs text-slate-600">{lead.email}</p>}
                      {lead.phone && <p className="text-xs text-slate-500">{lead.phone}</p>}
                      {!lead.email && !lead.phone && <span className="text-xs text-slate-300">-</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <span className="text-xs text-slate-600">{lead.source || "-"}</span>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <span className="text-xs text-slate-600">{lead.interest || "-"}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <select
                      value={lead.status}
                      onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                      className={`text-xs font-medium rounded-full px-2.5 py-1 border cursor-pointer ${STATUS_COLORS[lead.status] || "bg-slate-100 text-slate-600 border-slate-200"}`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <span className="text-xs text-slate-500">{formatDate(lead.created_at)}</span>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <div className="empty-state">
                      <UserPlus className="empty-state-icon" />
                      <p className="empty-state-title">Sin leads</p>
                      <p className="empty-state-text">Agrega tu primer lead para empezar a captar clientes</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
