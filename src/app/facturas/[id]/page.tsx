"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, Send, CheckCircle, Shield } from "lucide-react";

interface InvoiceDetail {
  id: string;
  number: string;
  client_name: string;
  client_nif: string;
  client_address: string;
  client_city: string;
  client_postal_code: string;
  client_province: string;
  date: string;
  due_date: string;
  status: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes: string;
  ticketbai_id: string | null;
  ticketbai_qr: string | null;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: "Borrador", color: "bg-slate-100 text-slate-600" },
  sent: { label: "Enviada", color: "bg-blue-50 text-blue-700 border border-blue-100" },
  paid: { label: "Cobrada", color: "bg-emerald-50 text-emerald-700 border border-emerald-100" },
  overdue: { label: "Vencida", color: "bg-red-50 text-red-700 border border-red-100" },
};

export default function FacturaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetch(`/api/invoices/${params.id}`)
        .then((r) => r.json())
        .then((data) => {
          setInvoice(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [params.id]);

  const generateTicketBAI = async () => {
    if (!invoice) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/ticketbai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoice.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setInvoice({
          ...invoice,
          ticketbai_id: data.ticketbaiId,
          ticketbai_qr: data.qrCode,
          status: "sent",
        });
      }
    } catch (err) {
      console.error(err);
    }
    setGenerating(false);
  };

  const markPaid = async () => {
    if (!invoice) return;
    await fetch(`/api/invoices/${invoice.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid" }),
    });
    setInvoice({ ...invoice, status: "paid" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!invoice) {
    return <div className="text-center py-8 text-slate-500">Factura no encontrada</div>;
  }

  const status = statusLabels[invoice.status] || statusLabels.draft;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="page-title">Factura {invoice.number}</h1>
            <span className={`badge ${status.color}`}>{status.label}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {!invoice.ticketbai_id && (
            <button
              onClick={generateTicketBAI}
              disabled={generating}
              className="btn-primary"
            >
              <Send className="h-4 w-4" />
              {generating ? "Generando..." : "Generar TicketBAI"}
            </button>
          )}
          {invoice.status !== "paid" && (
            <button
              onClick={markPaid}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 transition-all duration-200"
            >
              <CheckCircle className="h-4 w-4" />
              Marcar cobrada
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="btn-secondary"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </button>
        </div>
      </div>

      <div className="card p-8 print:shadow-none print:border-none">
        {/* Header */}
        <div className="flex justify-between mb-8 pb-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900">MARTIN OYARZABAL, IVAN</h2>
            <p className="text-sm text-slate-500 mt-1">NIF: 16063731W</p>
            <p className="text-sm text-slate-500">Lehendakari Aguirre 7b 2 derecha</p>
            <p className="text-sm text-slate-500">48640 Berango, Bizkaia</p>
            <p className="text-sm text-slate-500 mt-2 font-medium">BBVA: ES66 0182 0450 1102 0150 3156</p>
          </div>
          <div className="text-right">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-50 border border-indigo-100 mb-2">
              <span className="text-lg font-bold text-indigo-700">FACTURA</span>
            </div>
            <p className="text-lg font-semibold text-slate-900">{invoice.number}</p>
            <p className="text-sm text-slate-500 mt-2">Fecha: {invoice.date}</p>
            {invoice.due_date && (
              <p className="text-sm text-slate-500">Vencimiento: {invoice.due_date}</p>
            )}
          </div>
        </div>

        {/* Client */}
        <div className="mb-8 p-4 bg-slate-50 rounded-lg border border-slate-100">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Datos del cliente</p>
          <p className="font-semibold text-slate-900">{invoice.client_name}</p>
          {invoice.client_nif && <p className="text-sm text-slate-600">NIF: {invoice.client_nif}</p>}
          {invoice.client_address && <p className="text-sm text-slate-600">{invoice.client_address}</p>}
          {invoice.client_city && (
            <p className="text-sm text-slate-600">
              {invoice.client_postal_code} {invoice.client_city}, {invoice.client_province}
            </p>
          )}
        </div>

        {/* Items */}
        <div className="overflow-hidden rounded-lg border border-slate-200 mb-6">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Descripcion</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 w-20">Cant.</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 w-28">Precio</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 w-28">Importe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-slate-700">{item.description}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{item.unit_price.toFixed(2)} EUR</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">{item.total.toFixed(2)} EUR</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Base imponible</span>
              <span className="font-medium text-slate-700">{invoice.subtotal.toFixed(2)} EUR</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">IVA {invoice.tax_rate}%</span>
              <span className="font-medium text-slate-700">{invoice.tax_amount.toFixed(2)} EUR</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-2 mt-2">
              <span className="text-slate-900">Total</span>
              <span className="text-slate-900">{invoice.total.toFixed(2)} EUR</span>
            </div>
          </div>
        </div>

        {/* TicketBAI info */}
        {invoice.ticketbai_id && (
          <div className="mt-8 p-4 rounded-lg bg-emerald-50 border border-emerald-100">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">TicketBAI Verificado</span>
            </div>
            <p className="text-xs text-emerald-600 font-mono">{invoice.ticketbai_id}</p>
            {invoice.ticketbai_qr && (
              <p className="text-xs text-emerald-600 font-mono mt-1">QR: {invoice.ticketbai_qr}</p>
            )}
          </div>
        )}

        {/* Notes */}
        {invoice.notes && (
          <div className="mt-6 pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Notas</p>
            <p className="text-sm text-slate-600">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
