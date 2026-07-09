"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, ClipboardList, Calendar, Euro, Clock, ArrowRight, Users, MessageSquare, BarChart3, TrendingUp, TrendingDown, AlertTriangle, AlertCircle, Bell } from "lucide-react";

interface MonthlyBilling { month: string; year: number; total: number; }
interface TopClient { name: string; total: number; }
interface AlertOverdueInvoice { id: string; number: string; total: number; date: string; client_name: string; }
interface AlertExpiringBudget { id: string; number: string; valid_until: string; client_name: string; }
interface AlertTodayVisit { id: string; title: string; time: string; client_name: string; }

interface DashboardData {
  totalFacturacion: number;
  facturasPendientes: number;
  presupuestosPendientes: number;
  proximasVisitas: number;
  facturasEsteMes: number;
  clientesActivos: number;
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
  ultimasFacturas: Array<{ id: string; number: string; client_name: string; total: number; status: string; date: string; }>;
  proximasVisitasList: Array<{ id: string; title: string; client_name: string; date: string; time: string; address: string; }>;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
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
    ]).then(([dashboard, invoices, visits]) => {
      setData({
        ...dashboard,
        ultimasFacturas: (invoices || []).slice(0, 5),
        proximasVisitasList: (visits || []).filter((v: { status: string }) => v.status === "scheduled").slice(0, 5),
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-800 border-t-transparent"></div></div>);
  }

  const today = new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const kpis = [
    { label: "Facturacion total", value: `${(data?.totalFacturacion ?? 0).toFixed(2)} EUR`, icon: Euro, gradient: "from-emerald-500 to-emerald-600", href: "/facturas" },
    { label: "Pendiente de cobro", value: `${(data?.pendienteCobro ?? 0).toFixed(2)} EUR`, icon: Clock, gradient: "from-red-500 to-rose-600", href: "/facturas" },
    { label: "Facturas este mes", value: data?.facturasEsteMes ?? 0, icon: FileText, gradient: "from-blue-600 to-blue-800", href: "/facturas" },
    { label: "Presupuestos pendientes", value: data?.presupuestosPendientes ?? 0, icon: ClipboardList, gradient: "from-amber-500 to-orange-500", href: "/presupuestos" },
    { label: "Proximas tareas", value: data?.proximasVisitas ?? 0, icon: Calendar, gradient: "from-purple-500 to-purple-600", href: "/agenda" },
    { label: "Clientes activos", value: data?.clientesActivos ?? 0, icon: Users, gradient: "from-blue-700 to-blue-900", href: "/clientes" },
  ];

  const monthlyBilling = data?.monthlyBilling ?? [];
  const maxBilling = Math.max(...monthlyBilling.map((m) => m.total), 1);
  const topClients = data?.topClients ?? [];
  const thisMonth = data?.thisMonthTotal ?? 0;
  const lastMonth = data?.lastMonthTotal ?? 0;
  const monthDiff = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

  const quickActions = [
    { label: "Nueva factura", href: "/facturas/nueva", icon: FileText, color: "bg-blue-800 hover:bg-blue-900" },
    { label: "Nuevo presupuesto", href: "/presupuestos/nuevo", icon: ClipboardList, color: "bg-emerald-600 hover:bg-emerald-700" },
    { label: "Nueva tarea", href: "/agenda", icon: Calendar, color: "bg-purple-600 hover:bg-purple-700" },
    { label: "Nuevo cliente", href: "/clientes", icon: Users, color: "bg-amber-600 hover:bg-amber-700" },
    { label: "Enviar mensaje", href: "/comunicaciones", icon: MessageSquare, color: "bg-blue-600 hover:bg-blue-700" },
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="page-title">Buenos dias, Ivan</h1>
        <p className="page-subtitle capitalize">{today}</p>
      </div>

      <div className="mb-6">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Acciones rapidas</h2>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <Link key={action.label} href={action.href} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-white shadow-sm transition-all duration-200 ${action.color}`}>
              <action.icon className="h-3.5 w-3.5" />{action.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Alerts Section */}
      {data?.alerts && (data.alerts.overdueInvoices.length > 0 || data.alerts.expiringBudgets.length > 0 || data.alerts.todayVisits.length > 0) && (
        <div className="mb-8 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Bell className="h-4 w-4 text-slate-600" />
            <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Alertas</h2>
          </div>

          {data.alerts.overdueInvoices.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-semibold text-red-800">Facturas pendientes de cobro &gt;30 dias</span>
              </div>
              <div className="space-y-1.5">
                {data.alerts.overdueInvoices.map((inv) => (
                  <Link key={inv.id} href={`/facturas/${inv.id}`} className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2 text-sm hover:bg-white transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-red-700">{inv.number}</span>
                      <span className="text-slate-600">{inv.client_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">{formatDate(inv.date)}</span>
                      <span className="font-bold text-red-700">{inv.total.toFixed(2)} EUR</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {data.alerts.expiringBudgets.length > 0 && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-semibold text-orange-800">Presupuestos que caducan en menos de 3 dias</span>
              </div>
              <div className="space-y-1.5">
                {data.alerts.expiringBudgets.map((budget) => (
                  <Link key={budget.id} href={`/presupuestos/${budget.id}`} className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2 text-sm hover:bg-white transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-orange-700">{budget.number}</span>
                      <span className="text-slate-600">{budget.client_name}</span>
                    </div>
                    <span className="text-xs text-orange-700 font-medium">Caduca: {formatDate(budget.valid_until)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {data.alerts.todayVisits.length > 0 && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-800">Visitas de hoy</span>
              </div>
              <div className="space-y-1.5">
                {data.alerts.todayVisits.map((visit) => (
                  <Link key={visit.id} href="/agenda" className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2 text-sm hover:bg-white transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-blue-700">{visit.title}</span>
                      <span className="text-slate-600">{visit.client_name}</span>
                    </div>
                    {visit.time && <span className="text-xs text-blue-700 font-medium">{visit.time}</span>}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 mb-8">
        {kpis.map((kpi) => (
          <Link key={kpi.label} href={kpi.href} className="group card p-5 flex items-center justify-between cursor-pointer hover:border-blue-200">
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

      {/* Month comparison + Top clients */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="card-static p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Este mes vs anterior</h3>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold text-slate-900">{thisMonth.toFixed(0)} EUR</p>
            {lastMonth > 0 && (
              <span className={`flex items-center gap-0.5 text-xs font-semibold ${monthDiff >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {monthDiff >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {monthDiff >= 0 ? "+" : ""}{monthDiff.toFixed(0)}%
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">Mes anterior: {lastMonth.toFixed(0)} EUR</p>
        </div>

        <div className="card-static p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Top clientes por actividad</h3>
          {topClients.length === 0 ? (
            <p className="text-sm text-slate-400">Sin datos aun</p>
          ) : (
            <div className="space-y-2">
              {topClients.slice(0, 3).map((client, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-800">{idx + 1}</span>
                    <span className="text-sm font-medium text-slate-700">{client.name}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-900">{client.total.toFixed(2)} EUR</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Monthly Billing Chart */}
      <div className="card-static mb-8">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="h-5 w-5 text-blue-800" />
          <h2 className="text-lg font-semibold text-slate-900">Resumen mensual</h2>
        </div>
        <div className="flex items-end justify-between gap-2 h-48 px-2">
          {monthlyBilling.map((month, idx) => {
            const height = maxBilling > 0 ? (month.total / maxBilling) * 100 : 0;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-medium text-slate-600">{month.total > 0 ? `${month.total.toFixed(0)}` : "0"}</span>
                <div className="w-full flex items-end justify-center" style={{ height: "140px" }}>
                  <div className="w-full max-w-[40px] rounded-t-md bg-gradient-to-t from-blue-800 to-blue-500 transition-all duration-500 min-h-[4px]" style={{ height: `${Math.max(height, 2)}%` }} />
                </div>
                <span className="text-xs font-medium text-slate-500">{month.month}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-static">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Ultimos documentos</h2>
            <Link href="/facturas" className="text-sm text-blue-700 hover:text-blue-900 font-medium flex items-center gap-1">Ver todas <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          <div className="space-y-3">
            {(data?.ultimasFacturas ?? []).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No hay facturas</p>
            ) : (
              (data?.ultimasFacturas ?? []).map((factura) => {
                const status = statusLabels[factura.status] || statusLabels.draft;
                return (
                  <Link key={factura.id} href={`/facturas/${factura.id}`} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-blue-100 hover:bg-blue-50/30 transition-all duration-150">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-blue-800">{factura.number}</span>
                        <span className={`badge text-[10px] ${status.color}`}>{status.label}</span>
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{factura.client_name}</p>
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-sm font-bold text-slate-900">{factura.total.toFixed(2)} EUR</p>
                      <p className="text-[10px] text-slate-400">{formatDate(factura.date)}</p>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        <div className="card-static">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Proximas tareas</h2>
            <Link href="/agenda" className="text-sm text-blue-700 hover:text-blue-900 font-medium flex items-center gap-1">Ver agenda <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          <div className="space-y-3">
            {(data?.proximasVisitasList ?? []).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No hay tareas programadas</p>
            ) : (
              (data?.proximasVisitasList ?? []).map((visita) => (
                <Link key={visita.id} href="/agenda" className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-blue-100 hover:bg-blue-50/30 transition-all duration-150">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 border border-purple-100">
                    <Calendar className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{visita.title}</p>
                    <p className="text-xs text-slate-500 truncate">{visita.client_name} {visita.address ? `- ${visita.address}` : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-slate-700">{formatDate(visita.date)}</p>
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


