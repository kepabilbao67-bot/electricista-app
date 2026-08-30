"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  CheckCircle2,
  FileText,
  Printer,
  ChevronRight,
  ArrowRight,
  Loader2,
  RefreshCw,
  Layers,
  BarChart2,
  LayoutGrid,
  List,
  MapPin,
  Phone,
  User,
  AlertCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from "recharts";
import { showToast } from "@/components/Toast";

interface Trabajo {
  id: string;
  numero: string;
  fecha: string;
  cliente: string;
  clientId: string | null;
  telefono: string | null;
  direccion: string | null;
  tecnico: string | null;
  estado: string;
  observaciones: string | null;
  created_at: string;
}

interface TrabajosData {
  kpis: {
    pendientes: number;
    en_progreso: number;
    finalizados_sin_facturar: number;
    facturados: number;
    total: number;
  };
  statusDistribution: { name: string; count: number; fill: string }[];
  trabajos: Trabajo[];
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  borrador: { label: "Borrador", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", border: "border-slate-200" },
  pendiente: { label: "Pendiente", bg: "bg-blue-50 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200" },
  en_progreso: { label: "En Curso", bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200" },
  completado: { label: "Completado", bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200" },
  TRABAJO_COMPLETADO: { label: "Completado", bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200" },
  facturado: { label: "Facturado", bg: "bg-purple-50 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200" },
  cancelado: { label: "Cancelado", bg: "bg-red-50 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", border: "border-red-200" },
};

export default function CentroTrabajosPage() {
  const [data, setData] = useState<TrabajosData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");

  // Filtros
  const [search, setSearch] = useState("");
  const [selectedEstado, setSelectedEstado] = useState("todos");
  const [selectedDays, setSelectedDays] = useState("30");

  const fetchTrabajos = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedEstado && selectedEstado !== "todos") params.set("estado", selectedEstado);
      if (selectedDays) params.set("days", selectedDays);

      const res = await fetch(`/api/trabajos?${params.toString()}`);
      if (!res.ok) throw new Error("Error al consultar trabajos");
      const json = await res.json();
      setData(json);
    } catch {
      showToast("error", "No se pudieron cargar los trabajos operativos.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTrabajos();
  }, [selectedEstado, selectedDays]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTrabajos();
  };

  const handleClearFilters = () => {
    setSearch("");
    setSelectedEstado("todos");
    setSelectedDays("30");
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        <p className="text-sm text-slate-500">Cargando Centro de Trabajos...</p>
      </div>
    );
  }

  const kpis = data?.kpis || {
    pendientes: 0,
    en_progreso: 0,
    finalizados_sin_facturar: 0,
    facturados: 0,
    total: 0,
  };

  const trabajos = data?.trabajos || [];

  return (
    <div className="space-y-6">
      {/* Cabecera Principal */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <Briefcase className="h-6 w-6" />
            </span>
            <h1 className="page-title text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              Centro de Trabajos
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gestión y seguimiento operativo desde la orden inicial hasta la firma y facturación.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setRefreshing(true);
              fetchTrabajos();
            }}
            disabled={refreshing}
            className="btn-secondary text-xs sm:text-sm"
            title="Refrescar lista"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            <span>Actualizar</span>
          </button>
          <Link href="/partes-trabajo/nuevo" className="btn-primary text-xs sm:text-sm">
            <Plus className="h-4 w-4" />
            <span>Nuevo Trabajo</span>
          </Link>
        </div>
      </div>

      {/* 4 KPIs Operativos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Pendientes */}
        <div className="card p-4 space-y-1 border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>Pendientes</span>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
            {kpis.pendientes}
          </div>
          <p className="text-[11px] text-slate-500">Por iniciar o planificar</p>
        </div>

        {/* KPI 2: En Curso */}
        <div className="card p-4 space-y-1 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>En Curso</span>
            <Layers className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
            {kpis.en_progreso}
          </div>
          <p className="text-[11px] text-slate-500">En ejecución en obra</p>
        </div>

        {/* KPI 3: Finalizados sin Facturar */}
        <div className="card p-4 space-y-1 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>Finalizados</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
            {kpis.finalizados_sin_facturar}
          </div>
          <p className="text-[11px] text-slate-500">Partes listos para facturar</p>
        </div>

        {/* KPI 4: Facturados */}
        <div className="card p-4 space-y-1 border-l-4 border-l-purple-500">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>Facturados</span>
            <FileText className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
            {kpis.facturados}
          </div>
          <p className="text-[11px] text-slate-500">Completados y facturados</p>
        </div>
      </div>

      {/* Gráfica de Distribución Operativa */}
      <div className="card p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-blue-600" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Volumen de Trabajos por Estado Operativo
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Periodo:</span>
            <select
              value={selectedDays}
              onChange={(e) => setSelectedDays(e.target.value)}
              className="input-field text-xs py-1 px-2.5 h-8 rounded-lg"
              aria-label="Seleccionar periodo de tiempo"
            >
              <option value="7">Últimos 7 días</option>
              <option value="30">Últimos 30 días</option>
              <option value="90">Últimos 90 días</option>
            </select>
          </div>
        </div>

        <div className="h-48 w-full" aria-label="Gráfico de barras de trabajos por estado">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.statusDistribution || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
              <YAxis allowDecimals={false} stroke="#94a3b8" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.9)",
                  borderRadius: "8px",
                  border: "none",
                  color: "#fff",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="count" name="Trabajos" radius={[6, 6, 0, 0]}>
                {(data?.statusDistribution || []).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div className="card p-4 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, número de parte o dirección..."
              className="input-field pl-9 pr-3 text-xs sm:text-sm w-full"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedEstado}
              onChange={(e) => setSelectedEstado(e.target.value)}
              className="input-field text-xs sm:text-sm min-w-[140px]"
              aria-label="Filtrar por estado"
            >
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="en_progreso">En Curso</option>
              <option value="completado">Completados</option>
              <option value="facturado">Facturados</option>
              <option value="cancelado">Cancelados</option>
            </select>

            <button type="submit" className="btn-secondary text-xs sm:text-sm">
              <Filter className="h-4 w-4" />
              <span>Filtrar</span>
            </button>
          </div>
        </form>
      </div>

      {/* Listado Principal de Trabajos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <span>Órdenes y Partes ({trabajos.length})</span>
          </h2>

          <div className="hidden sm:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded text-xs flex items-center gap-1 ${
                viewMode === "table"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-semibold"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              title="Vista en tabla"
            >
              <List className="h-3.5 w-3.5" />
              <span>Tabla</span>
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={`p-1.5 rounded text-xs flex items-center gap-1 ${
                viewMode === "kanban"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-semibold"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              title="Vista en columnas"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Columnas</span>
            </button>
          </div>
        </div>

        {/* Vista en Tabla (Escritorio) */}
        {viewMode === "table" && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3 font-semibold">Nº Parte</th>
                    <th className="p-3 font-semibold">Cliente / Contacto</th>
                    <th className="p-3 font-semibold">Ubicación / Dirección</th>
                    <th className="p-3 font-semibold">Fecha</th>
                    <th className="p-3 font-semibold text-center">Estado</th>
                    <th className="p-3 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {trabajos.map((t) => {
                    const st = STATUS_CONFIG[t.estado] || STATUS_CONFIG.borrador;
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                          <Link href={`/parte-trabajo/${t.id}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                            {t.numero}
                          </Link>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <User className="h-3 w-3 text-slate-400" />
                            {t.cliente}
                          </div>
                          {t.telefono && (
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <Phone className="h-3 w-3 text-slate-400" />
                              {t.telefono}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                            {t.direccion || "—"}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            {t.fecha}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`inline-block px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full ${st.bg} ${st.text}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={`/parte-trabajo/${t.id}`}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                              title="Ver e Imprimir Parte A4"
                            >
                              <Printer className="h-4 w-4" />
                            </Link>
                            <Link
                              href={`/partes-trabajo/${t.id}`}
                              className="p-1.5 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                              title="Editar Detalle"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {trabajos.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <AlertCircle className="h-8 w-8 text-slate-400" />
                          <p className="font-semibold text-sm">No se encontraron trabajos con los filtros actuales</p>
                          <button
                            type="button"
                            onClick={handleClearFilters}
                            className="btn-secondary text-xs mt-2"
                          >
                            Limpiar Filtros
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Vista en Columnas (Kanban) */}
        {viewMode === "kanban" && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {["pendiente", "en_progreso", "completado", "facturado"].map((colStatus) => {
              const colConfig = STATUS_CONFIG[colStatus] || STATUS_CONFIG.borrador;
              const colItems = trabajos.filter((t) => {
                if (colStatus === "completado") return t.estado === "completado" || t.estado === "TRABAJO_COMPLETADO";
                if (colStatus === "pendiente") return t.estado === "borrador" || t.estado === "pendiente";
                return t.estado === colStatus;
              });

              return (
                <div key={colStatus} className="card p-3 space-y-3 bg-slate-50/50 dark:bg-slate-800/30">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                    <span className="font-bold text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${colConfig.bg.replace("bg-", "bg-emerald-")}`} />
                      {colConfig.label}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {colItems.length}
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                    {colItems.map((t) => (
                      <div
                        key={t.id}
                        className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2 shadow-xs hover:border-blue-400 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <span className="text-[11px] font-black text-blue-600 dark:text-blue-400">
                            {t.numero}
                          </span>
                          <span className="text-[10px] text-slate-400">{t.fecha}</span>
                        </div>
                        <div className="font-semibold text-xs text-slate-900 dark:text-slate-100 line-clamp-1">
                          {t.cliente}
                        </div>
                        {t.direccion && (
                          <div className="text-[10px] text-slate-500 line-clamp-1 flex items-center gap-1">
                            <MapPin className="h-2.5 w-2.5 shrink-0" />
                            {t.direccion}
                          </div>
                        )}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                          <Link
                            href={`/parte-trabajo/${t.id}`}
                            className="text-[10px] font-semibold text-blue-600 hover:underline flex items-center gap-0.5"
                          >
                            <Printer className="h-3 w-3" /> Imprimir
                          </Link>
                          <Link
                            href={`/partes-trabajo/${t.id}`}
                            className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:underline flex items-center gap-0.5"
                          >
                            Detalle <ChevronRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                    ))}
                    {colItems.length === 0 && (
                      <div className="p-4 text-center text-slate-400 text-xs italic">
                        Sin trabajos
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Vista Móvil (Tarjetas Verticales) */}
        <div className="sm:hidden space-y-3">
          {trabajos.map((t) => {
            const st = STATUS_CONFIG[t.estado] || STATUS_CONFIG.borrador;
            return (
              <div
                key={`mobile-${t.id}`}
                className="card p-4 space-y-3 border border-slate-200 dark:border-slate-800"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                      {t.numero}
                    </span>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-0.5">
                      {t.cliente}
                    </h3>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${st.bg} ${st.text}`}>
                    {st.label}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>{t.fecha}</span>
                  </div>
                  {t.direccion && (
                    <div className="flex items-start gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span>{t.direccion}</span>
                    </div>
                  )}
                  {t.telefono && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      <span>{t.telefono}</span>
                    </div>
                  )}
                </div>

                {/* Botones táctiles >=44px de altura */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2">
                  <Link
                    href={`/parte-trabajo/${t.id}`}
                    className="btn-secondary text-xs h-11 flex items-center justify-center gap-1.5"
                  >
                    <Printer className="h-4 w-4" />
                    <span>Imprimir A4</span>
                  </Link>
                  <Link
                    href={`/partes-trabajo/${t.id}`}
                    className="btn-primary text-xs h-11 flex items-center justify-center gap-1.5"
                  >
                    <span>Ver Detalle</span>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
