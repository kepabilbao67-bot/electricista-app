"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Eye, FileText, Search, Euro, Clock, CheckCircle2, AlertCircle } from "lucide-react";

interface Invoice {
  id: string;
  number: string;
  client_name: string;
  date: string;
  total: number;
  status: string;
  ticketbai_id: string | null;
}

const statusLabels: Record<string, { label: string; color: string; icon: typeof FileText }> = {
  draft: { label: "Borrador", color: "bg-slate-100 text-slate-600", icon: FileText },
  sent: { label: "Enviada", color: "bg-blue-50 text-blue-700 border border-blue-100", icon: Clock },
  paid: { label: "Cobrada", color: "bg-emerald-50 text-emerald-700 border border-emerald-100", icon: CheckCircle2 },
  overdue: { label: "Vencida", color: "bg-red-50 text-red-700 border border-red-100", icon: AlertCircle },
};

const statusFilters = [
  { value: "", label: "Todas" },
  { value: "draft", label: "Borrador" },
  { value: "sent", label: "Enviadas" },
  { value: "paid", label: "Cobradas" },
  { value: "overdue", label: "Vencidas" },
];

export default function FacturasPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    fetch("/api/invoices")
      .then((res) => res.json())
      .then((data) => {
        setInvoices(data);
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

  // Filter invoices
  const filtered = invoices.filter((inv) => {
    const matchesStatus = !statusFilter || inv.status === statusFilter;
    const matchesSearch = !search ||
      inv.number.toLowerCase().includes(search.toLowerCase()) ||
      inv.client_name.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Calculate totals
  const totalFacturado = invoices.reduce((acc, inv) => acc + inv.total, 0);
  const totalCobrado = invoices.filter((inv) => inv.status === "paid").reduce((acc, inv) => acc + inv.total, 0);
  const totalPendiente = invoices.filter((inv) => inv.status === "sent" || inv.status === "overdue").reduce((acc, inv) => acc + inv.total, 0);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">Facturas</h1>
          <p className="page-subtitle">{invoices.length} facturas registradas</p>
        </div>
        <Link href="/facturas/nueva" className="btn-primary">
          <Plus className="h-4 w-4" />
          Nueva factura
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50">
            <Euro className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total facturado</p>
            <p className="text-lg font-bold text-slate-900">{totalFacturado.toFixed(2)} EUR</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Cobrado</p>
            <p className="text-lg font-bold text-emerald-700">{totalCobrado.toFixed(2)} EUR</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
            <Clock className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Pendiente cobro</p>
            <p className="text-lg font-bold text-amber-700">{totalPendiente.toFixed(2)} EUR</p>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por numero o cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={`rounded-lg px-3 py-2 text-xs font-medium border transition-all duration-200 ${
                statusFilter === filter.value
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700 shadow-sm"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-header">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Numero</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hidden sm:table-cell">Fecha</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Total</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Estado</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 hidden md:table-cell">TBAI</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((invoice) => {
                const status = statusLabels[invoice.status] || statusLabels.draft;
                const StatusIcon = status.icon;
                return (
                  <tr key={invoice.id} className="table-row">
                    <td className="px-4 py-3.5 font-semibold text-slate-900">{invoice.number}</td>
                    <td className="px-4 py-3.5 text-slate-600">{invoice.client_name}</td>
                    <td className="px-4 py-3.5 hidden sm:table-cell text-slate-500">{invoice.date}</td>
                    <td className="px-4 py-3.5 text-right font-semibold text-slate-900">
                      {invoice.total.toFixed(2)} EUR
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`badge gap-1 ${status.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center hidden md:table-cell">
                      {invoice.ticketbai_id ? (
                        <div className="flex items-center justify-center">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 border border-emerald-100">
                            <FileText className="h-3.5 w-3.5 text-emerald-600" />
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={`/facturas/${invoice.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Ver
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    {search || statusFilter ? "No hay facturas con estos filtros" : "No hay facturas registradas"}
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
