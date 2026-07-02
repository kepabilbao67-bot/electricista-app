"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  ClipboardList,
  Calendar,
  TrendingUp,
  Euro,
  Clock,
  ArrowRight,
  Users,
} from "lucide-react";

interface DashboardData {
  totalFacturacion: number;
  facturasPendientes: number;
  presupuestosPendientes: number;
  proximasVisitas: number;
  facturasEsteMes: number;
  clientesActivos: number;
  ultimasFacturas: Array<{
    id: string;
    number: string;
    client_name: string;
    total: number;
    status: string;
    date: string;
  }>;
  proximasVisitasList: Array<{
    id: string;
    title: string;
    client_name: string;
    date: string;
    time: string;
    address: string;
  }>;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: "Borrador", color: "bg-slate-100 text-slate-600" },
  sent: { label: "Enviada", color: "bg-blue-50 text-blue-700 border border-blue-100" },
  paid: { label: "Cobrada", color: "bg-emerald-50 text-emerald-700 border border-emerald-100" },
  overdue: { label: "Vencida", color: "bg-red-50 text-red-700 border border-red-100" },
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard").then((res) => res.json()),
      fetch("/api/invoices").then((res) => res.json()).catch(() => []),
      fetch("/api/visits").then((res) => res.json()).catch(() => []),
    ])
      .then(([dashboard, invoices, visits]) => {
        setData({
          ...dashboard,
          ultimasFacturas: (invoices || []).slice(0, 5),
          proximasVisitasList: (visits || [])
            .filter((v: { status: string }) => v.status === "scheduled")
            .slice(0, 5),
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const kpis = [
    {
      label: "Facturacion total",
      value: `${(data?.totalFacturacion ?? 0).toFixed(2)} EUR`,
      icon: Euro,
      gradient: "from-emerald-500 to-emerald-600",
      bgColor: "bg-emerald-50",
      textColor: "text-emerald-700",
      href: "/facturas",
    },
    {
      label: "Facturas este mes",
      value: data?.facturasEsteMes ?? 0,
      icon: FileText,
      gradient: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-50",
      textColor: "text-blue-700",
      href: "/facturas",
    },
    {
      label: "Presupuestos pendientes",
      value: data?.presupuestosPendientes ?? 0,
      icon: ClipboardList,
      gradient: "from-amber-500 to-orange-500",
      bgColor: "bg-amber-50",
      textColor: "text-amber-700",
      href: "/presupuestos",
    },
    {
      label: "Proximas visitas",
      value: data?.proximasVisitas ?? 0,
      icon: Calendar,
      gradient: "from-purple-500 to-purple-600",
      bgColor: "bg-purple-50",
      textColor: "text-purple-700",
      href: "/agenda",
    },
    {
      label: "Facturas pendientes cobro",
      value: data?.facturasPendientes ?? 0,
      icon: Clock,
      gradient: "from-red-500 to-rose-600",
      bgColor: "bg-red-50",
      textColor: "text-red-700",
      href: "/facturas",
    },
    {
      label: "Clientes activos",
      value: data?.clientesActivos ?? 0,
      icon: Users,
      gradient: "from-indigo-500 to-indigo-600",
      bgColor: "bg-indigo-50",
      textColor: "text-indigo-700",
      href: "/clientes",
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="page-title">Buenos dias, Ivan</h1>
        <p className="page-subtitle capitalize">{today}</p>
      </div>

      {/* KPI Cards - Clickable */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 mb-8">
        {kpis.map((kpi) => (
          <Link
            key={kpi.label}
            href={kpi.href}
            className="group card p-5 flex items-center justify-between cursor-pointer hover:border-indigo-200"
          >
            <div className="flex-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{kpi.label}</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{kpi.value}</p>
            </div>
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${kpi.gradient} shadow-lg shadow-slate-200`}>
              <kpi.icon className="h-6 w-6 text-white" />
            </div>
          </Link>
        ))}
      </div>

      {/* Detail Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Ultimas facturas</h2>
            <Link href="/facturas" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
              Ver todas <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="space-y-3">
            {(data?.ultimasFacturas ?? []).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No hay facturas</p>
            ) : (
              (data?.ultimasFacturas ?? []).map((factura) => {
                const status = statusLabels[factura.status] || statusLabels.draft;
                return (
                  <Link
                    key={factura.id}
                    href={`/facturas/${factura.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all duration-150"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{factura.number}</span>
                        <span className={`badge text-[10px] ${status.color}`}>{status.label}</span>
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{factura.client_name}</p>
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-sm font-bold text-slate-900">{factura.total.toFixed(2)} EUR</p>
                      <p className="text-[10px] text-slate-400">{factura.date}</p>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Upcoming Visits */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Proximas visitas</h2>
            <Link href="/agenda" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
              Ver agenda <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="space-y-3">
            {(data?.proximasVisitasList ?? []).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No hay visitas programadas</p>
            ) : (
              (data?.proximasVisitasList ?? []).map((visita) => (
                <Link
                  key={visita.id}
                  href="/agenda"
                  className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all duration-150"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 border border-purple-100">
                    <Calendar className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{visita.title}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {visita.client_name} {visita.address ? `- ${visita.address}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-slate-700">{visita.date}</p>
                    {visita.time && <p className="text-[10px] text-slate-400">{visita.time}</p>}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
