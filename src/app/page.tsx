"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  ClipboardList,
  ClipboardCheck,
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
  Plus,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
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

const statusBadgeVariants: Record<string, "gray" | "blue" | "green" | "red"> = {
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

  const thisMonth = data?.thisMonthTotal ?? 0;
  const lastMonth = data?.lastMonthTotal ?? 0;
  const monthDiff =
    lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

  const monthlyBilling = data?.monthlyBilling ?? [];
  const maxBilling = Math.max(...monthlyBilling.map((m) => m.total), 1);
  const topClients = data?.topClients ?? [];

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
            <Badge variant="blue" size="md" dot>
              360° Activo
            </Badge>
            {isDemo && (
              <Badge variant="amber" size="md">
                DEMO / SIN VALIDEZ FISCAL
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1 capitalize flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Resumen diario de facturación, clientes y actividad · {today}
          </p>
          {isDemo && (
            <p className="text-xs text-slate-500 mt-1">
              Datos ficticios de demostración. El modo DEMO usa almacenamiento aislado.
            </p>
          )}
        </div>
      </div>

      {/* Acciones Rápidas con Botones Reutilizables */}
      <div>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
          Acciones Rápidas
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/facturas/nueva">
            <Button variant="primary" size="md" icon={Plus}>
              Nueva Factura
            </Button>
          </Link>
          <Link href="/presupuestos/nuevo">
            <Button variant="success" size="md" icon={ClipboardList}>
              Nuevo Presupuesto
            </Button>
          </Link>
          <Link href="/partes-trabajo/nuevo">
            <Button variant="secondary" size="md" icon={ClipboardCheck}>
              Nuevo Parte
            </Button>
          </Link>
          <Link href="/agenda">
            <Button variant="secondary" size="md" icon={Calendar}>
              Nueva Tarea
            </Button>
          </Link>
          <Link href="/clientes">
            <Button variant="secondary" size="md" icon={Users}>
              Nuevo Cliente
            </Button>
          </Link>
          <Link href="/crm">
            <Button variant="secondary" size="md" icon={BriefcaseBusiness}>
              Abrir CRM
            </Button>
          </Link>
          <Link href="/comunicaciones">
            <Button variant="ghost" size="md" icon={MessageSquare}>
              Enviar Mensaje
            </Button>
          </Link>
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
                Alertas Prioritarias
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {data.alerts.overdueInvoices.length > 0 && (
                <div className="rounded-2xl border border-red-200 bg-red-50/70 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2 text-red-800 font-bold text-xs uppercase tracking-wide">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    Facturas Vencidas
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
                    Presupuestos por Caducar
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
                    Visitas de Hoy
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

      {/* KPIs Superiores con Componentes UI Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Ingresos del Mes */}
        <Link href="/facturas">
          <Card
            title="Ingresos del Mes"
            icon={TrendingUp}
            variant="success"
            className="cursor-pointer hover:border-emerald-300"
          >
            <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {thisMonth.toFixed(2)} €
            </p>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Facturado este mes</span>
              {lastMonth > 0 && (
                <span
                  className={`font-bold flex items-center gap-0.5 ${
                    monthDiff >= 0 ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {monthDiff >= 0 ? "+" : ""}
                  {monthDiff.toFixed(0)}%
                </span>
              )}
            </div>
          </Card>
        </Link>

        {/* Card 2: Facturas Pendientes */}
        <Link href="/facturas">
          <Card
            title="Facturas Pendientes"
            icon={Clock}
            variant="warning"
            className="cursor-pointer hover:border-amber-300"
          >
            <p className="text-3xl font-extrabold text-amber-700 tracking-tight">
              {(data?.pendienteCobro ?? 0).toFixed(2)} €
            </p>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Pendiente de cobro</span>
              <span className="font-bold text-slate-700">
                {data?.facturasPendientes ?? 0} facturas
              </span>
            </div>
          </Card>
        </Link>

        {/* Card 3: Presupuestos Activos */}
        <Link href="/presupuestos">
          <Card
            title="Presupuestos Activos"
            icon={FileText}
            variant="default"
            className="cursor-pointer hover:border-blue-300"
          >
            <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {data?.presupuestosPendientes ?? 0}
            </p>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">En curso / Pendientes</span>
              <span className="font-bold text-blue-600 flex items-center gap-1">
                Ver lista <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </Card>
        </Link>

        {/* Card 4: Partes de Trabajo */}
        <Link href="/partes-trabajo">
          <Card
            title="Partes de Trabajo"
            icon={ClipboardCheck}
            variant="gradient"
            className="cursor-pointer hover:border-blue-400"
          >
            <p className="text-3xl font-extrabold text-blue-900 tracking-tight">
              {data?.proximasVisitas ?? 0}
            </p>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Próximos trabajos</span>
              <span className="font-bold text-blue-700 flex items-center gap-1">
                Ir a partes <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </Card>
        </Link>
      </div>

      {/* Analytics & Top Clients */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card variant="gradient" className="p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Facturación Histórica Total
            </span>
            <Euro className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {(data?.totalFacturacion ?? 0).toFixed(2)} €
          </p>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Clientes activos: <strong className="text-slate-800">{data?.clientesActivos ?? 0}</strong></span>
            <span>Oportunidades: <strong className="text-slate-800">{data?.oportunidadesActivas ?? 0}</strong></span>
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Top Clientes por Actividad
            </h3>
            <Link
              href="/clientes"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              Ver todos <ArrowRight className="h-3 w-3" />
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

      {/* Gráfico Mensual */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Evolución de Facturación
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
              Últimos Documentos Emitidos
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
                        variant={statusBadgeVariants[factura.status] || "gray"}
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
              Próximas Tareas Programadas
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
