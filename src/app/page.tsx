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
  Receipt,
  Scale,
  Building2,
  Phone,
  Mail,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { OnboardingBanner } from "@/components/ui/OnboardingBanner";
import { CardSkeleton } from "@/components/ui/Skeleton";

interface MonthlyEvolutionItem {
  month: string;
  year: number;
  ingresos: number;
  gastos: number;
  beneficio: number;
}

interface MonthlyBilling {
  month: string;
  year: number;
  total: number;
}

interface TopClient {
  name: string;
  total: number;
}

interface RecentClient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
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
  thisMonthTotal: number;
  thisMonthSubtotal?: number;
  thisMonthTax?: number;
  lastMonthTotal: number;
  thisYearTotal: number;
  thisYearSubtotal?: number;
  thisYearTax?: number;
  thisMonthExpenses: number;
  thisMonthExpensesSubtotal?: number;
  thisMonthExpensesTax?: number;
  thisYearExpenses: number;
  thisYearExpensesSubtotal?: number;
  thisYearExpensesTax?: number;
  thisMonthProfit: number;
  thisYearProfit: number;
  pendienteCobro: number;
  facturasPendientes: number;
  facturasVencidasCount: number;
  facturasVencidasTotal: number;
  presupuestosPendientes: number;
  proximasVisitas: number;
  facturasEsteMes: number;
  clientesActivos: number;
  oportunidadesActivas: number;
  tareasPendientes: number;
  monthlyBilling: MonthlyBilling[];
  monthlyEvolution?: MonthlyEvolutionItem[];
  fiscal: {
    mes: {
      ivaRepercutido: number;
      ivaSoportado: number;
      ivaLiquidacion: number;
    };
    ano: {
      ivaRepercutido: number;
      ivaSoportado: number;
      ivaLiquidacion: number;
    };
    irpfDisponible: boolean;
    irpfNota: string;
  };
  topClients: TopClient[];
  recentClients?: RecentClient[];
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
  const clean = dateStr.split("T")[0];
  const parts = clean.split("-");
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
        <div className="h-20 rounded-2xl bg-slate-200/80 dark:bg-slate-800/80 animate-shimmer" />
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

  const thisYearTotal = data?.thisYearTotal ?? 0;
  const thisMonthExpenses = data?.thisMonthExpenses ?? 0;
  const thisYearExpenses = data?.thisYearExpenses ?? 0;
  const thisMonthProfit = data?.thisMonthProfit ?? (thisMonth - thisMonthExpenses);

  const monthlyEvolution = data?.monthlyEvolution ?? (data?.monthlyBilling || []).map((m) => ({
    month: m.month,
    year: m.year,
    ingresos: m.total,
    gastos: 0,
    beneficio: m.total,
  }));

  const maxEvolutionValue = Math.max(
    ...monthlyEvolution.map((m) => Math.max(m.ingresos, m.gastos)),
    1
  );

  const topClients = data?.topClients ?? [];
  const recentClients = data?.recentClients ?? [];
  const fiscalMes = data?.fiscal?.mes ?? {
    ivaRepercutido: data?.thisMonthTax ?? 0,
    ivaSoportado: data?.thisMonthExpensesTax ?? 0,
    ivaLiquidacion: (data?.thisMonthTax ?? 0) - (data?.thisMonthExpensesTax ?? 0),
  };

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
            Resumen operativo, financiero y fiscal · {today}
          </p>
          {isDemo && (
            <p className="text-xs text-slate-500 mt-1">
              Datos ficticios de demostración. El modo DEMO usa almacenamiento aislado.
            </p>
          )}
        </div>
      </div>

      {/* Acciones Rápidas */}
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
          <Link href="/gastos">
            <Button variant="secondary" size="md" icon={Receipt}>
              Registrar Gasto
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
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-red-800 font-bold text-xs uppercase tracking-wide">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      Facturas Vencidas ({data.alerts.overdueInvoices.length})
                    </div>
                    <span className="text-xs font-extrabold text-red-700">
                      {(data.facturasVencidasTotal ?? 0).toFixed(2)} €
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {data.alerts.overdueInvoices.map((inv) => (
                      <Link
                        key={inv.id}
                        href={isDemo ? "/facturas" : `/facturas/${inv.id}`}
                        className="flex items-center justify-between rounded-xl bg-white p-2.5 text-xs hover:shadow-sm transition-all"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="font-bold text-red-700 block">{inv.number}</span>
                          <span className="text-slate-500 text-[11px] truncate block">{inv.client_name}</span>
                        </div>
                        <span className="font-bold text-slate-900 shrink-0">
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
                        <div className="min-w-0 pr-2">
                          <span className="font-bold text-amber-700 block">{budget.number}</span>
                          <span className="text-slate-500 text-[11px] truncate block">{budget.client_name}</span>
                        </div>
                        <span className="text-slate-500 font-medium shrink-0">
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
                        <span className="text-blue-700 font-bold shrink-0 ml-2">{visit.time}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      {/* BLOQUE 1: KPIs Financieros Principales */}
      <div>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
          Rendimiento Financiero
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Facturación del Mes */}
          <Link href="/facturas">
            <Card
              title="Facturación del Mes"
              icon={TrendingUp}
              variant="success"
              className="cursor-pointer hover:border-emerald-300 h-full"
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
                    {monthDiff.toFixed(0)}% vs mes ant.
                  </span>
                )}
              </div>
            </Card>
          </Link>

          {/* Card 2: Facturación del Año */}
          <Link href="/facturas">
            <Card
              title="Facturación Anual"
              icon={Euro}
              variant="default"
              className="cursor-pointer hover:border-blue-300 h-full"
            >
              <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {thisYearTotal.toFixed(2)} €
              </p>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Año en curso</span>
                <span className="font-bold text-blue-700">
                  {data?.facturasEsteMes ?? 0} fac. este mes
                </span>
              </div>
            </Card>
          </Link>

          {/* Card 3: Gastos del Mes */}
          <Link href="/gastos">
            <Card
              title="Gastos del Mes"
              icon={Receipt}
              variant="warning"
              className="cursor-pointer hover:border-amber-300 h-full"
            >
              <p className="text-3xl font-extrabold text-amber-700 tracking-tight">
                {thisMonthExpenses.toFixed(2)} €
              </p>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Total gastos mes</span>
                <span className="font-bold text-slate-600">
                  Anual: {thisYearExpenses.toFixed(0)} €
                </span>
              </div>
            </Card>
          </Link>

          {/* Card 4: Beneficio Estimado */}
          <Card
            title="Beneficio Estimado"
            icon={thisMonthProfit >= 0 ? TrendingUp : TrendingDown}
            variant={thisMonthProfit >= 0 ? "success" : "warning"}
            className="h-full"
          >
            <p
              className={`text-3xl font-extrabold tracking-tight ${
                thisMonthProfit >= 0 ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {thisMonthProfit.toFixed(2)} €
            </p>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Ingresos - Gastos (Mes)</span>
              <span
                className={`font-bold ${
                  thisMonthProfit >= 0 ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {thisMonth > 0
                  ? `${((thisMonthProfit / thisMonth) * 100).toFixed(0)}% margen`
                  : "0%"}
              </span>
            </div>
          </Card>
        </div>
      </div>

      {/* BLOQUE 2: Estado de Cobros y Resumen Fiscal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cobros y Pendientes */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Estado de Cobros
              </h3>
            </div>
            <Link
              href="/facturas"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              Ver facturas <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-900">Pendiente de Cobro</span>
                <Badge variant="amber" size="sm">
                  {data?.facturasPendientes ?? 0} facturas
                </Badge>
              </div>
              <p className="text-2xl font-extrabold text-amber-800 mt-1">
                {(data?.pendienteCobro ?? 0).toFixed(2)} €
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-red-50/70 border border-red-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-red-900">Facturas Vencidas</span>
                <Badge variant={data?.facturasVencidasCount ? "red" : "gray"} size="sm">
                  {data?.facturasVencidasCount ?? 0} vencidas
                </Badge>
              </div>
              <p className="text-2xl font-extrabold text-red-800 mt-1">
                {(data?.facturasVencidasTotal ?? 0).toFixed(2)} €
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between text-xs text-slate-500">
              <span>Presupuestos activos: <strong>{data?.presupuestosPendientes ?? 0}</strong></span>
              <span>Trabajos próx.: <strong>{data?.proximasVisitas ?? 0}</strong></span>
            </div>
          </div>
        </Card>

        {/* Resumen Fiscal IVA Real */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-blue-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Métricas Fiscales · IVA Estimado del Mes
              </h3>
            </div>
            <Badge variant="blue" size="sm">
              Cálculo con datos reales
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/80">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                IVA Repercutido (Ventas)
              </span>
              <p className="text-xl font-extrabold text-slate-900 mt-1">
                {fiscalMes.ivaRepercutido.toFixed(2)} €
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Facturas emitidas del mes</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/80">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                IVA Soportado (Compras)
              </span>
              <p className="text-xl font-extrabold text-amber-800 mt-1">
                {fiscalMes.ivaSoportado.toFixed(2)} €
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Gastos registrados del mes</p>
            </div>

            <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/60">
              <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">
                Liquidación IVA Est.
              </span>
              <p className="text-xl font-extrabold text-blue-900 mt-1">
                {fiscalMes.ivaLiquidacion.toFixed(2)} €
              </p>
              <p className="text-[11px] text-blue-700 mt-1">
                {fiscalMes.ivaLiquidacion >= 0 ? "A ingresar a Hacienda" : "A compensar / devolver"}
              </p>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5 text-xs text-slate-500">
            <Sparkles className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <p>
              <strong>Nota fiscal:</strong> Los importes de IVA se calculan directamente a partir de las cuotas tributarias registradas en cada factura y gasto. El IRPF se gestiona a nivel de declaración trimestral.
            </p>
          </div>
        </Card>
      </div>

      {/* BLOQUE 3: Gráfica de Evolución Mensual (Ingresos vs Gastos) */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Evolución de Ingresos y Gastos
              </h2>
              <p className="text-xs text-slate-500">Histórico de los últimos 6 meses</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-slate-700">
              <span className="h-3 w-3 rounded-sm bg-gradient-to-t from-blue-700 to-blue-500" />
              Ingresos (€)
            </span>
            <span className="flex items-center gap-1.5 text-slate-700">
              <span className="h-3 w-3 rounded-sm bg-gradient-to-t from-amber-600 to-amber-400" />
              Gastos (€)
            </span>
          </div>
        </div>

        <div className="flex items-end justify-between gap-3 h-56 pt-4 px-2">
          {monthlyEvolution.map((month, idx) => {
            const heightIngresos = maxEvolutionValue > 0 ? (month.ingresos / maxEvolutionValue) * 100 : 0;
            const heightGastos = maxEvolutionValue > 0 ? (month.gastos / maxEvolutionValue) * 100 : 0;

            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                <div className="text-[10px] font-bold text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center">
                  <span className="text-blue-700 font-extrabold">{month.ingresos.toFixed(0)}€</span>
                  {month.gastos > 0 && <span className="text-amber-700">{month.gastos.toFixed(0)}€</span>}
                </div>

                <div
                  className="w-full flex items-end justify-center gap-1.5 rounded-t-xl bg-slate-100/80 p-1"
                  style={{ height: "140px" }}
                >
                  {/* Barra Ingresos */}
                  <div
                    className="w-1/2 max-w-[24px] rounded-t-md bg-gradient-to-t from-blue-700 via-blue-600 to-indigo-500 shadow-xs transition-all duration-500 min-h-[4px] group-hover:brightness-110"
                    style={{ height: `${Math.max(heightIngresos, 4)}%` }}
                    title={`Ingresos ${month.month}: ${month.ingresos.toFixed(2)}€`}
                  />
                  {/* Barra Gastos */}
                  <div
                    className="w-1/2 max-w-[24px] rounded-t-md bg-gradient-to-t from-amber-600 via-amber-500 to-yellow-400 shadow-xs transition-all duration-500 min-h-[4px] group-hover:brightness-110"
                    style={{ height: `${Math.max(heightGastos, 4)}%` }}
                    title={`Gastos ${month.month}: ${month.gastos.toFixed(2)}€`}
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

      {/* BLOQUE 4: Detalle Operativo - Clientes Recientes, Últimas Facturas y Tareas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Clientes Recientes */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Clientes Recientes
              </h3>
            </div>
            <Link
              href="/clientes"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              Ver todos <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {recentClients.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">Sin clientes registrados</p>
            ) : (
              recentClients.slice(0, 5).map((client) => (
                <Link
                  key={client.id}
                  href={`/clientes/${client.id}`}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all duration-150"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">{client.name}</p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 truncate">
                      {client.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {client.phone}
                        </span>
                      )}
                      {client.email && (
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3" /> {client.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-2" />
                </Link>
              ))
            )}
          </div>
        </Card>

        {/* Últimas Facturas Emitidas */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Últimas Facturas
              </h3>
            </div>
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
                  <div className="text-right ml-3 shrink-0">
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

        {/* Próximas Tareas y Visitas */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-purple-600" />
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Próximas Tareas
              </h3>
            </div>
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
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 border border-purple-100 text-purple-600 shadow-xs shrink-0">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {visita.title}
                    </p>
                    <p className="text-xs text-slate-500 truncate font-medium">
                      {visita.client_name} {visita.address ? `· ${visita.address}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
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
        Autónomo 360 · Centro de Control Operativo y Financiero para Autónomos
      </p>
    </div>
  );
}
