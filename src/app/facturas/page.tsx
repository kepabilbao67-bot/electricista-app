"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Eye, FileText } from "lucide-react";

interface Invoice {
  id: string;
  number: string;
  client_name: string;
  date: string;
  total: number;
  status: string;
  ticketbai_id: string | null;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: "Borrador", color: "bg-slate-100 text-slate-600" },
  sent: { label: "Enviada", color: "bg-blue-50 text-blue-700 border border-blue-100" },
  paid: { label: "Cobrada", color: "bg-emerald-50 text-emerald-700 border border-emerald-100" },
  overdue: { label: "Vencida", color: "bg-red-50 text-red-700 border border-red-100" },
};

export default function FacturasPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

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
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 hidden md:table-cell">TicketBAI</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => {
                const status = statusLabels[invoice.status] || statusLabels.draft;
                return (
                  <tr key={invoice.id} className="table-row">
                    <td className="px-4 py-3.5 font-semibold text-slate-900">{invoice.number}</td>
                    <td className="px-4 py-3.5 text-slate-600">{invoice.client_name}</td>
                    <td className="px-4 py-3.5 hidden sm:table-cell text-slate-500">{invoice.date}</td>
                    <td className="px-4 py-3.5 text-right font-semibold text-slate-900">
                      {invoice.total.toFixed(2)} EUR
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`badge ${status.color}`}>
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
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    No hay facturas registradas
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
