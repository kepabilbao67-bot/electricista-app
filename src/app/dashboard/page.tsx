"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  TrendingUp,
  Euro,
  ClipboardCheck,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  UserPlus,
  ArrowRight,
  BarChart3,
  Calendar,
  Layers,
  PieChart as PieIcon,
  Loader2,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { showToast } from "@/components/Toast";

interface AnalyticsData {
  kpis: {
    totalLeads: number;
    thisMonthLeads: number;
    lastMonthLeads: number;
    monthVariation: number;
    conversionRate: number;
    estimatedRevenue: number;
    completedJobs: number;
  };
  statusCounts: { name: string; count: number; fill: string }[];
  weeklyLeads: { date: string; day: string; leads: number }[];
  topServices: { name: string; value: number }[];
  recentLeads: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    status: string;
    interest: string | null;
    created_at: string;
  }[];
}

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

const STATUS_BADGES: Record<string, string> = {
  nuevo: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  contactado: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  cualificado: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  convertido: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  descartado: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export default function AnalyticsDashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch("/api/analytics");
      if (!res.ok) throw new Error("Error al cargar analíticas");
      const json = await res.json();
      setData(json);
    } catch {
      showToast("error", "No se pudieron cargar las analíticas.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
    showToast("info", "Actualizando métricas de negocio...");
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        <p className="text-sm text-slate-500">Calculando analíticas y métricas de negocio...</p>
      </div>
    );
  }

  const kpis = data?.kpis || {
    totalLeads: 0,
    thisMonthLeads: 0,
    lastMonthLeads: 0,
    monthVariation: 0,
    conversionRate: 0,
    estimatedRevenue: 0,
    completedJobs: 0,
  };

  return (
    <div className="space-y-6">
      {/* Cabecera del Dashboard */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <BarChart3 className="h-6 w-6" />
            </span>
            <h1 className="page-title text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              Dashboard de Analíticas
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Métricas de rendimiento, captación de clientes y conversión de trabajos en tiempo real.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-secondary text-xs sm:text-sm"
            title="Refrescar métricas"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refrescar</span>
          </button>
          <Link href="/leads" className="btn-primary text-xs sm:text-sm">
            <UserPlus className="h-4 w-4" />
            <span>Gestionar Leads</span>
          </Link>
        </div>
      </div>

      {/* Grid de KPIs Principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Leads */}
        <div className="card p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Leads Totales</span>
            <Users className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
              {kpis.totalLeads}
            </span>
            <span
              className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${
                kpis.monthVariation >= 0
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
              }`}
            >
              {kpis.monthVariation >= 0 ? (
                <ArrowUpRight className="h-3.5 w-3.5 mr-0.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5 mr-0.5" />
              )}
              {Math.abs(kpis.monthVariation)}% mes
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {kpis.thisMonthLeads} nuevos leads registrados este mes
          </p>
        </div>

        {/* Card 2: Tasa de Conversión */}
        <div className="card p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Tasa de Conversión</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
              {kpis.conversionRate}%
            </span>
            <span className="text-xs text-slate-500">Leads a Clientes</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, kpis.conversionRate)}%` }}
            />
          </div>
        </div>

        {/* Card 3: Ingresos Cobrados */}
        <div className="card p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Facturación Cobrada</span>
            <Euro className="h-4 w-4 text-purple-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
              {kpis.estimatedRevenue.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Facturas liquidadas y registradas en sistema
          </p>
        </div>

        {/* Card 4: Trabajos Completados */}
        <div className="card p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Partes Completados</span>
            <ClipboardCheck className="h-4 w-4 text-amber-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
              {kpis.completedJobs}
            </span>
            <span className="text-xs text-slate-500">Ejecutados</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Partes de trabajo oficiales firmados y finalizados
          </p>
        </div>
      </div>

      {/* Grid de Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Evolución Semanal de Leads */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Evolución de Captación (Últimos 7 días)
              </h3>
            </div>
            <span className="text-xs text-slate-500">Nuevos leads</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.weeklyLeads || []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                <YAxis allowDecimals={false} stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.9)",
                    borderRadius: "8px",
                    border: "none",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="leads"
                  name="Leads"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#3b82f6" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Leads por Estado */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-emerald-600" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Pipeline de Leads por Estado
              </h3>
            </div>
            <span className="text-xs text-slate-500">Distribución</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.statusCounts || []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis allowDecimals={false} stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.9)",
                    borderRadius: "8px",
                    border: "none",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="count" name="Cantidad" radius={[6, 6, 0, 0]}>
                  {(data?.statusCounts || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 3: Servicios más Solicitados */}
        <div className="card p-5 space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-purple-600" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Top Servicios e Intereses Demandados
              </h3>
            </div>
            <span className="text-xs text-slate-500">Demanda B2B y Residencial</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.topServices || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {(data?.topServices || []).map((entry, index) => (
                    <Cell key={`pie-cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.9)",
                    borderRadius: "8px",
                    border: "none",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tabla: Últimos 5 Leads */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Últimos Leads Registrados</h3>
            <p className="text-xs text-slate-500">Oportunidades recientes listas para seguimiento comercial</p>
          </div>
          <Link
            href="/leads"
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            Ver todos los leads <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3 font-semibold">Cliente / Empresa</th>
                <th className="p-3 font-semibold">Contacto</th>
                <th className="p-3 font-semibold">Interés / Servicio</th>
                <th className="p-3 font-semibold text-center">Estado</th>
                <th className="p-3 font-semibold text-right">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(data?.recentLeads || []).map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">{lead.name}</td>
                  <td className="p-3 text-slate-600 dark:text-slate-400">
                    <div>{lead.email || "—"}</div>
                    <div className="text-[10px] text-slate-400">{lead.phone || ""}</div>
                  </td>
                  <td className="p-3 text-slate-700 dark:text-slate-300">{lead.interest || "General"}</td>
                  <td className="p-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                        STATUS_BADGES[lead.status.toLowerCase()] || "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {lead.status}
                    </span>
                  </td>
                  <td className="p-3 text-right text-slate-500">
                    {new Date(lead.created_at).toLocaleDateString("es-ES")}
                  </td>
                </tr>
              ))}
              {(!data?.recentLeads || data.recentLeads.length === 0) && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    No hay leads registrados aún.
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
