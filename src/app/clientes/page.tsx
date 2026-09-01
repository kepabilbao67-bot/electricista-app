"use client";

import { useEffect, useState, useMemo, FormEvent } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  Building2,
  Filter,
  ArrowRight,
  TrendingUp,
  UserCheck,
  Clock,
  Sparkles,
  ChevronRight,
  UserPlus,
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
} from "@/lib/crm";

interface Client {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  status?: string;
  source?: string;
  notes?: string;
  created_at?: string;
}

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [formData, setFormData] = useState({
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

  const loadClients = async () => {
    try {
      const res = await fetch("/api/clients");
      if (res.ok) {
        const data = await res.json();
        setClients(Array.isArray(data) ? data : []);
      }
    } catch {
      showToast("error", "Error al cargar la lista de clientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        showToast("success", "Cliente comercial añadido correctamente");
        setShowCreateModal(false);
        setFormData({
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
        loadClients();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast("error", err.error || "No se pudo crear el cliente");
      }
    } catch {
      showToast("error", "Error de conexión al crear cliente");
    }
  };

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const q = search.toLowerCase();
      const matchSearch =
        search === "" ||
        c.name.toLowerCase().includes(q) ||
        (c.company && c.company.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(search)) ||
        (c.email && c.email.toLowerCase().includes(q));

      const matchStage =
        selectedStage === "all" || (c.status || "nuevo") === selectedStage;

      return matchSearch && matchStage;
    });
  }, [clients, search, selectedStage]);

  // KPI Metrics
  const totalCount = clients.length;
  const inFollowUpCount = clients.filter((c) =>
    ["contactado", "reunion", "seguimiento", "interesado"].includes(c.status || "nuevo")
  ).length;
  const proposalCount = clients.filter((c) =>
    ["propuesta", "negociacion", "doc_pendiente"].includes(c.status || "nuevo")
  ).length;
  const wonCount = clients.filter((c) => c.status === "cliente").length;
  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Breadcrumbs items={[{ label: "Clientes y Contactos" }]} />
          <h1 className="text-2xl sm:text-3xl font-black text-slate-100 mt-1 tracking-tight flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0284c7] via-[#0369a1] to-[#0b1b30] border border-sky-400/30 text-white shadow-md">
              <Users className="h-5 w-5 text-[#f5d48a]" />
            </div>
            <span>Clientes & Contactos Barymont</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Directorio de prospectos, clientes de cartera y contactos de Pedro con seguimiento comercial.
          </p>
        </div>

        <Button
          variant="primary"
          icon={Plus}
          onClick={() => setShowCreateModal(true)}
          className="shrink-0"
        >
          Nuevo Cliente
        </Button>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 bg-[#0a1424]/90 border border-slate-700/80 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Total Contactos</p>
            <p className="text-2xl font-black text-slate-100 font-mono mt-0.5">{totalCount}</p>
          </div>
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Users className="h-4 w-4" />
          </div>
        </div>

        <div className="card p-4 bg-[#0a1424]/90 border border-slate-700/80 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">En Cita / Seguimiento</p>
            <p className="text-2xl font-black text-amber-400 font-mono mt-0.5">{inFollowUpCount}</p>
          </div>
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="h-4 w-4" />
          </div>
        </div>

        <div className="card p-4 bg-[#0a1424]/90 border border-slate-700/80 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Propuestas / Negoc.</p>
            <p className="text-2xl font-black text-sky-400 font-mono mt-0.5">{proposalCount}</p>
          </div>
          <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <TrendingUp className="h-4 w-4" />
          </div>
        </div>

        <div className="card p-4 bg-[#0a1424]/90 border border-[#d9b35f]/30 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-[#f5d48a] font-bold uppercase tracking-wider">Clientes Ganados</p>
            <p className="text-2xl font-black text-[#f5d48a] font-mono mt-0.5">{wonCount}</p>
          </div>
          <div className="p-2 rounded-xl bg-[#d9b35f]/15 text-[#f5d48a] border border-[#d9b35f]/30">
            <UserCheck className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-5 bg-[#0a1424]/90 border border-slate-700/80 space-y-4 shadow-lg">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar cliente, empresa, teléfono o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10 text-xs w-full"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <Filter className="h-4 w-4 text-slate-400 shrink-0" />
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="input-field text-xs w-full sm:w-48"
            >
              <option value="all">Todos los estados</option>
              {CRM_STAGES.slice(0, 11).map((st) => (
                <option key={st} value={st}>
                  {CRM_STAGE_LABELS[st]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Filter Stage Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setSelectedStage("all")}
            className={`px-3 py-1.5 rounded-xl font-bold shrink-0 transition-all ${
              selectedStage === "all"
                ? "bg-[#d9b35f] text-slate-950 shadow-sm"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700/60"
            }`}
          >
            Todos ({clients.length})
          </button>
          {CRM_STAGES.slice(0, 11).map((st) => {
            const count = clients.filter((c) => (c.status || "nuevo") === st).length;
            if (count === 0 && selectedStage !== st) return null;
            const isActive = selectedStage === st;
            return (
              <button
                key={st}
                onClick={() => setSelectedStage(st)}
                className={`px-3 py-1.5 rounded-xl font-bold shrink-0 transition-all ${
                  isActive
                    ? "bg-[#d9b35f] text-slate-950 shadow-sm"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700/60"
                }`}
              >
                {CRM_STAGE_LABELS[st]} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Clients Grid */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0284c7] border-t-transparent" />
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="card p-12 text-center text-slate-400 space-y-3">
          <Users className="h-10 w-10 mx-auto text-slate-500" />
          <p className="text-sm font-bold text-slate-200">No se encontraron clientes</p>
          <p className="text-xs text-slate-500">
            {search || selectedStage !== "all"
              ? "Prueba a cambiar los filtros o el término de búsqueda."
              : "Comienza registrando tu primer cliente o prospecto."}
          </p>
          <Button variant="secondary" size="sm" onClick={() => setShowCreateModal(true)}>
            + Crear nuevo cliente
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => {
            const stKey = (client.status || "nuevo") as CrmStage;
            const badge = CRM_STAGE_BADGES[stKey] || CRM_STAGE_BADGES.nuevo;

            return (
              <div
                key={client.id}
                className="card p-5 bg-[#0a1424]/90 border border-slate-700/80 hover:border-sky-500/40 transition-all flex flex-col justify-between space-y-4 group shadow-md"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0284c7] to-[#0a1b30] text-sm font-black text-white border border-sky-400/30 shrink-0">
                        {client.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <Link
                          href={`/clientes/${client.id}`}
                          className="font-bold text-sm text-slate-100 group-hover:text-sky-300 transition-colors line-clamp-1"
                        >
                          {client.name}
                        </Link>
                        {client.company && (
                          <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <Building2 className="h-3 w-3 text-slate-500" />
                            {client.company}
                          </p>
                        )}
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border shrink-0 ${badge.bg} ${badge.text} ${badge.border}`}
                    >
                      {CRM_STAGE_LABELS[stKey] || stKey}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-400 pt-1 border-t border-slate-800/80">
                    {client.phone && (
                      <p className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-slate-500" />
                        <span className="text-slate-300 font-mono">{client.phone}</span>
                      </p>
                    )}
                    {client.email && (
                      <p className="flex items-center gap-2 truncate">
                        <Mail className="h-3.5 w-3.5 text-slate-500" />
                        <span className="text-slate-300 truncate">{client.email}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {client.phone && (
                      <WhatsAppButton
                        phone={client.phone}
                        message={`Hola ${client.name}, te contacto desde Barymont.`}
                        className="h-8 px-2.5 text-xs"
                      />
                    )}
                    {client.phone && (
                      <a
                        href={`tel:${client.phone}`}
                        className="btn-secondary h-8 px-2.5 flex items-center gap-1 text-xs font-bold text-sky-400 border-sky-500/30"
                        title="Llamar"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>

                  <Link
                    href={`/clientes/${client.id}`}
                    className="btn-ghost h-8 px-3 text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1"
                  >
                    Ver Ficha <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Client Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="card w-full max-w-lg p-6 bg-[#0c182c] border border-slate-700 shadow-2xl space-y-4 animate-scale-in max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-[#f5d48a]" />
              Nuevo Cliente Comercial (Barymont)
            </h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300">Nombre completo / Persona de contacto *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Laura Gómez Sánchez"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field text-xs w-full mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300">Empresa / Negocio:</label>
                  <input
                    type="text"
                    placeholder="Ej: Inversiones Sur SL"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="input-field text-xs w-full mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300">Teléfono:</label>
                  <input
                    type="tel"
                    placeholder="612345678"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input-field text-xs w-full mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300">Email:</label>
                  <input
                    type="email"
                    placeholder="cliente@ejemplo.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input-field text-xs w-full mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300">Origen del prospecto:</label>
                  <input
                    type="text"
                    placeholder="Ej: Recomendación, Web, Llamada"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="input-field text-xs w-full mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300">Estado inicial:</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="input-field text-xs w-full mt-1"
                  >
                    {CRM_STAGES.slice(0, 11).map((st) => (
                      <option key={st} value={st}>
                        {CRM_STAGE_LABELS[st]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300">Ciudad / Población:</label>
                  <input
                    type="text"
                    placeholder="Ej: Madrid, Sevilla..."
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="input-field text-xs w-full mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">Notas / Diagnóstico Financiero Preliminar:</label>
                <textarea
                  rows={3}
                  placeholder="Interés en jubilación, protección familiar, ahorro..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input-field text-xs w-full mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </Button>
                <Button variant="primary" size="sm" type="submit">
                  Guardar Cliente
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
