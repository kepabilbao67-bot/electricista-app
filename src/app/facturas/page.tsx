"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Eye, FileText, Search, Euro, Clock, CheckCircle2, AlertCircle, Copy } from "lucide-react";
import { showToast } from "@/components/Toast";

interface Invoice {
  id: string;
  number: string;
  client_name: string;
  client_id: string;
  date: string;
  total: number;
  status: string;
  ticketbai_id: string | null;
}

const statusLabels: Record<string, { label: string; color: string; icon: typeof FileText }> = {
  draft: { label: "Borrador", color: "bg-slate-100 text-slate-600", icon: FileText },
  pending_batuz: { label: "Pte. Batuz", color: "bg-amber-50 text-amber-700 border border-amber-100", icon: Clock },
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

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export default function FacturasPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchInvoices = () => {
    fetch("/api/invoices")
      .then((res) => res.json())
      .then((data) => {
        setInvoices(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const markAsPaid = async (invoiceId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const res = await fetch(`/api/invoices/${invoiceId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid" }),
    });
    if (res.ok) {
      showToast("success", "Factura marcada como cobrada");
      setInvoices(invoices.map((inv) => inv.id === invoiceId ? { ...inv, status: "paid" } : inv));
    } else {
      showToast("error", "Error al actualizar la factura");
    }
  };

  const duplicateInvoice = async (invoice: Invoice, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const detailRes = await fetch(`/api/invoices/${invoice.id}`);
      const detail = await detailRes.json();

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: detail.client_id,
          date: new Date().toISOString().split("T")[0],
          notes: detail.notes || "",
          tax_rate: detail.tax_rate || 21,
          items: (detail.items || []).map((item: { description: string; quantity: number; unit_price: number }) => ({
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
          })),
        }),
      });

      if (res.ok) {
        const newInvoice = await res.json();
        showToast("success", `Factura duplicada: ${newInvoice.number}`);
        router.push(`/facturas/${newInvoice.id}`);
      } else {
        showToast("error", "Error al duplicar la factura");
      }
    } catch {
      showToast("error", "Error al duplicar la factura");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-800 border-t-transparent"></div>
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
    <div className="animate-fade-in">
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
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
            <Euro className="h-5 w-5 text-blue-800" />
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
                  ? "border-blue-300 bg-blue-50 text-blue-800 shadow-sm"
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
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((invoice) => {
                const status = statusLabels[invoice.status] || statusLabels.draft;
                const StatusIcon = status.icon;
                return (
                  <tr key={invoice.id} className="table-row">
                    <td className="px-4 py-3.5">
                      <span className="text-base font-bold text-blue-800">{invoice.number}</span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 font-medium">{invoice.client_name}</td>
                    <td className="px-4 py-3.5 hidden sm:table-cell text-slate-500">{formatDate(invoice.date)}</td>
                    <td className="px-4 py-3.5 text-right font-bold text-slate-900">
                      {invoice.total.toFixed(2)} EUR
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`badge gap-1 ${status.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {invoice.status !== "paid" && (
                          <button
                            onClick={(e) => markAsPaid(invoice.id, e)}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                            title="Marcar como cobrada"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Cobrar
                          </button>
                        )}
                        <button
                          onClick={(e) => duplicateInvoice(invoice, e)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                          title="Duplicar factura"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <Link
                          href={`/facturas/${invoice.id}`}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Ver
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <div className="empty-state">
                      <FileText className="empty-state-icon" />
                      <p className="empty-state-title">
                        {search || statusFilter ? "Sin resultados" : "Sin facturas"}
                      </p>
                      <p className="empty-state-text">
                        {search || statusFilter ? "No hay facturas con estos filtros" : "Crea tu primera factura para empezar"}
                      </p>
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
