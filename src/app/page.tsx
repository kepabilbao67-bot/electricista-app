"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  ClipboardList,
  Calendar,
  Euro,
  Clock,
  ArrowRight,
  Users,
  MessageSquare,
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  Bell,
  BriefcaseBusiness,
  Sparkles,
  Zap,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { OnboardingBanner } from "@/components/ui/OnboardingBanner";
import { CardSkeleton } from "@/components/ui/Skeleton";

interface MonthlyBilling {
  month: string;
  year: number;
  total: number;
}
interface TopClient {
  name: string;
  total: number;
}
interface AlertOverdueInvoice {
  id: string;
  number: string;
  total: number;
  date: string;
  client_name: string;
}
interface AlertExpiringBudget {
  id: string;
  number: string;
  valid_until: string;
  client_name: string;
}
interface AlertTodayVisit {
  id: string;
  title: string;
  time: string;
  client_name: string;
}

interface DashboardData {
  demoMode: boolean;
  totalFacturacion: number;
  facturasPendientes: number;
  presupuestosPendientes: number;
  proximasVisitas: number;
  facturasEsteMes: number;
  clientesActivos: number;
  oportunidadesActivas: number;
  tareasPendientes: number;
  monthlyBilling: MonthlyBilling[];
  pendienteCobro: number;
  topClients: TopClient[];
  thisMonthTotal: number;
  lastMonthTotal: number;
  alerts: {
    overdueInvoices: AlertOverdueInvoice[];
    expiringBudgets: AlertExpiringBudget[];
    todayVisits: AlertTodayVisit[];
  };
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

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

const statusBadgeColors: Record<string, "gray" | "blue" | "green" | "red"> = {
  draft: "gray",
  sent: "blue",
  paid: "green",
  overdue: "red",
};

const statusLabels: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviada",
  paid: "Cobrada",
  overdue: "Vencida",
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard").then((res) => res.json()),
      fetch("/api/invoices?context=dashboard-demo")
        .then((res) => res.json())
        .catch(() => []),
      fetch("/api/visits?context=dashboard-demo")
        .then((res) => res.json())
        .catch(() => []),
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
      <div className="space-y-6 animate-fade-in">
        <div className="h-20 rounded-2xl bg-slate-200/80 animate-shimmer" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
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
      label: "Facturación total",
      value: `${(data?.totalFacturacion ?? 0).toFixed(2)} EUR`,
      icon: Euro,
      gradient: "from-emerald-500 to-teal-600",
      shadow: "shadow-emerald-500/10",
      href: "/facturas",
    },
    {
      label: "Pendiente de cobro",
      value: `${(data?.pendienteCobro ?? 0).toFixed(2)} EUR`,
      icon: Clock,
      gradient: "from-rose-500 to-red-600",
      shadow: "shadow-rose-500/10",
      href: "/facturas",
    },
    {
      label: "Facturas este mes",
      value: data?.facturasEsteMes ?? 0,
      icon: FileText,
      gradient: "from-blue-600 to-indigo-600",
      shadow: "shadow-blue-500/10",
      href: "/facturas",
    },
    {
      label: "Presupuestos pendientes",
      value: data?.presupuestosPendientes ?? 0,
      icon: ClipboardList,
      gradient: "from-amber-500 to-orange-500",
      shadow: "shadow-amber-500/10",
      href: "/presupuestos",
    },
    {
      label: "Próximas tareas",
      value: data?.proximasVisitas ?? 0,
      icon: Calendar,
      gradient: "from-purple-500 to-indigo-600",
      shadow: "shadow-purple-500/10",
      href: "/agenda",
    },
    {
      label: "Clientes activos",
      value: data?.clientesActivos ?? 0,
      icon: Users,
      gradient: "from-blue-700 to-slate-900",
      shadow: "shadow-slate-500/10",
      href: "/clientes",
    },
    {
      label: "Oportunidades activas",
      value: data?.oportunidadesActivas ?? 0,
      icon: BriefcaseBusiness,
      gradient: "from-cyan-600 to-blue-600",
      shadow: "shadow-cyan-500/10",
      href: "/crm",
    },
    {
      label: "Acciones CRM",
      value: data?.tareasPendientes ?? 0,
      icon: Bell,
      gradient: "from-fuchsia-600 to-pink-600",
      shadow: "shadow-fuchsia-500/10",
      href: "/crm",
    },
  ];

  const monthlyBilling = data?.monthlyBilling ?? [];
  const maxBilling = Math.max(...monthlyBilling.map((m) => m.total), 1);
  const topClients = data?.topClients ?? [];
  const thisMonth = data?.thisMonthTotal ?? 0;
  const lastMonth = data?.lastMonthTotal ?? 0;
  const monthDiff =
    lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

  const quickActions = [
    {
      label: "Nueva factura",
      href: "/facturas/nueva",
      icon: FileText,
      color: "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white",
    },
    {
      label: "Nuevo presupuesto",
      href: "/presupuestos/nuevo",
      icon: ClipboardList,
      color: "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white",
    },
    {
      label: "Nueva tarea",
      href: "/agenda",
      icon: Calendar,
      color: "bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white",
    },
    {
      label: "Nuevo cliente",
      href: "/clientes",
      icon: Users,
      color: "bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white",
    },
    {
      label: "Abrir CRM",
      href: "/crm",
      icon: BriefcaseBusiness,
      color: "bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800 text-white",
    },
    {
      label: "Enviar mensaje",
      href: "/comunicaciones",
      icon: MessageSquare,
      color: "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white",
    },
  ];

  const isDemo = data?.demoMode === true;
  const hasClients = (data?.clientesActivos ?? 0) > 0;
  const hasBudgets = (data?.presupuestosPendientes ?? 0) > 0 || (data?.totalFacturacion ?? 0) > 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Onboarding Guide for new setups */}
      <OnboardingBanner
        ownerName="Iván Martín Oyarzabal"
        hasClients={hasClients}
        hasBudgets={hasBudgets}
      />

      {/* Main Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Panel de control
            </h1>
            <Badge color="blue" size="md" dot>
              360° Activo
            </Badge>
            {isDemo && (
              <Badge color="amber" size="md">
                DEMO / SIN VALIDEZ FISCAL
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1 capitalize flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Resumen de facturación, clientes y actividad · {today}
          </p>
          {isDemo && (
            <p className="text-xs text-slate-500 mt-1">
              Datos ficticios de demostración. El modo DEMO usa almacenamiento aislado.
            </p>
          )}
        </div>
      </div>

      {/* Quick Action Chips */}
      <div>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
          Acciones rápidas
        </h2>
        <div className="flex flex-wrap gap-2.5">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${action.color}`}
            >
              <action.icon className="h-4 w-4" />
              {action.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Alerts Section */}
      {data?.alerts &&
        (data.alerts.overdueInvoices.length > 0 ||
          data.alerts.expiringBudgets.length > 0 ||
          data.alerts.todayVisits.length > 0) && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-blue-600" />
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Alertas prioritarias
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {data.alerts.overdueInvoices.length > 0 && (
                <div className="rounded-2xl border border-red-200 bg-red-50/70 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2 text-red-800 font-bold text-xs uppercase tracking-wide">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    Facturas vencidas
                  </div>
                  <div className="space-y-1.5">
                    {data.alerts.overdueInvoices.map((inv) => (
                      <Link
                        key={inv.id}
                        href={isDemo ? "/facturas" : `/facturas/${inv.id}`}
                        className="flex items-center justify-between rounded-xl bg-white p-2.5 text-xs hover:shadow-sm transition-all"
                      >
                        <span className="font-bold text-red-700">{inv.number}</span>
                        <span className="font-bold text-slate-900">
                          {inv.total.toFixed(2)} €
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {data.alerts.expiringBudgets.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2 text-amber-800 font-bold text-xs uppercase tracking-wide">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Presupuestos por caducar
                  </div>
                  <div className="space-y-1.5">
                    {data.alerts.expiringBudgets.map((budget) => (
                      <Link
                        key={budget.id}
                        href={isDemo ? "/presupuestos" : `/presupuestos/${budget.id}`}
                        className="flex items-center justify-between rounded-xl bg-white p-2.5 text-xs hover:shadow-sm transition-all"
                      >
                        <span className="font-bold text-amber-700">{budget.number}</span>
                        <span className="text-slate-500">
                          {formatDate(budget.valid_until)}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {data.alerts.todayVisits.length > 0 && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2 text-blue-800 font-bold text-xs uppercase tracking-wide">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    Visitas / Tareas de hoy
                  </div>
                  <div className="space-y-1.5">
                    {data.alerts.todayVisits.map((visit) => (
                      <Link
                        key={visit.id}
                        href="/agenda"
                        className="flex items-center justify-between rounded-xl bg-white p-2.5 text-xs hover:shadow-sm transition-all"
                      >
                        <span className="font-semibold text-blue-900 truncate">
                          {visit.title}
                        </span>
                        <span className="text-blue-700 font-bold">{visit.time}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Link
            key={kpi.label}
            href={kpi.href}
            className={`group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:border-blue-300 hover:-translate-y-0.5 cursor-pointer relative overflow-hidden flex items-center justify-between ${kpi.shadow}`}
          >
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {kpi.label}
              </p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1.5 tracking-tight">
                {kpi.value}
              </p>
            </div>
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${kpi.gradient} text-white shadow-md transition-transform duration-300 group-hover:scale-110`}
            >
              <kpi.icon className="h-6 w-6" />
            </div>
          </Link>
        ))}
      </div>

      {/* Analytics & Top Clients */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card variant="gradient" className="p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Comparativa mensual
            </span>
            <Zap className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-3">
            <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {thisMonth.toFixed(0)} €
            </p>
            {lastMonth > 0 && (
              <span
                className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                  monthDiff >= 0
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {monthDiff >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {monthDiff >= 0 ? "+" : ""}
                {monthDiff.toFixed(0)}%
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Facturado el mes anterior:{" "}
            <span className="font-semibold text-slate-700">
              {lastMonth.toFixed(0)} €
            </span>
          </p>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Top clientes por actividad
            </h3>
            <Link
              href="/clientes"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              Ver clientes <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {topClients.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">Sin clientes registrados</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {topClients.slice(0, 3).map((client, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/80"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white shadow-xs">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-800 truncate">
                      {client.name}
                    </span>
                  </div>
                  <span className="text-xs font-extrabold text-blue-700 ml-2">
                    {client.total.toFixed(0)} €
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Monthly Chart Bar */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Evolución de facturación
              </h2>
              <p className="text-xs text-slate-500">Histórico de ingresos mensuales</p>
            </div>
          </div>
        </div>
        <div className="flex items-end justify-between gap-3 h-52 pt-6 px-2">
          {monthlyBilling.map((month, idx) => {
            const height = maxBilling > 0 ? (month.total / maxBilling) * 100 : 0;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                <span className="text-[11px] font-bold text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
                  {month.total > 0 ? `${month.total.toFixed(0)}€` : "0€"}
                </span>
                <div
                  className="w-full flex items-end justify-center rounded-t-xl bg-slate-100/80 p-1"
                  style={{ height: "140px" }}
                >
                  <div
                    className="w-full max-w-[48px] rounded-t-lg bg-gradient-to-t from-blue-700 via-blue-600 to-indigo-500 shadow-md shadow-blue-600/20 transition-all duration-500 min-h-[6px] group-hover:brightness-110"
                    style={{ height: `${Math.max(height, 4)}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  {month.month}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Detail Rows: Últimas Facturas y Tareas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">
              Últimos documentos emitidos
            </h2>
            <Link
              href="/facturas"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              Ver todas <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="space-y-2.5">
            {(data?.ultimasFacturas ?? []).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">
                No hay facturas emitidas recientemente
              </p>
            ) : (
              (data?.ultimasFacturas ?? []).map((factura) => (
                <Link
                  key={factura.id}
                  href={isDemo ? "/facturas" : `/facturas/${factura.id}`}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all duration-150"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-blue-900">
                        {factura.number}
                      </span>
                      <Badge
                        color={statusBadgeColors[factura.status] || "gray"}
                        size="sm"
                      >
                        {statusLabels[factura.status] || factura.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5 font-medium">
                      {factura.client_name}
                    </p>
                  </div>
                  <div className="text-right ml-3">
                    <p className="text-sm font-extrabold text-slate-900">
                      {factura.total.toFixed(2)} €
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {formatDate(factura.date)}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">
              Próximas tareas programadas
            </h2>
            <Link
              href="/agenda"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              Ver agenda <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="space-y-2.5">
            {(data?.proximasVisitasList ?? []).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">
                No hay tareas pendientes en la agenda
              </p>
            ) : (
              (data?.proximasVisitasList ?? []).map((visita) => (
                <Link
                  key={visita.id}
                  href="/agenda"
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all duration-150"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 border border-purple-100 text-purple-600 shadow-xs">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {visita.title}
                    </p>
                    <p className="text-xs text-slate-500 truncate font-medium">
                      {visita.client_name} {visita.address ? `· ${visita.address}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-700">
                      {formatDate(visita.date)}
                    </p>
                    {visita.time && (
                      <p className="text-[10px] text-purple-600 font-bold">
                        {visita.time}
                      </p>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>

      <p className="text-center text-[11px] text-slate-400 mt-8 no-print">
        Autónomo 360 · Plataforma de gestión profesional para electricistas y autónomos
      </p>
    </div>
  );
}
