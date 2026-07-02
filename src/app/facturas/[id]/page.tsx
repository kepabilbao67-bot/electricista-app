"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, Send, CheckCircle } from "lucide-react";

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  if (!invoice) {
    return <div className="text-center py-8 text-gray-500">Factura no encontrada</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="rounded-lg p-2 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold">Factura {invoice.number}</h1>
        <div className="ml-auto flex gap-2">
          {!invoice.ticketbai_id && (
            <button
              onClick={generateTicketBAI}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {generating ? "Generando..." : "Generar TicketBAI"}
            </button>
          )}
          {invoice.status !== "paid" && (
            <button
              onClick={markPaid}
              className="inline-flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600"
            >
              <CheckCircle className="h-4 w-4" />
              Marcar cobrada
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm print:shadow-none print:border-none">
        {/* Header */}
        <div className="flex justify-between mb-8">
          <div>
            <h2 className="text-xl font-bold text-gray-900">MARTIN OYARZABAL, IVAN</h2>
            <p className="text-sm text-gray-500">NIF: 16063731W</p>
            <p className="text-sm text-gray-500">Lehendakari Aguirre 7b 2 derecha</p>
            <p className="text-sm text-gray-500">48640 Berango, Bizkaia</p>
            <p className="text-sm text-gray-500 mt-2">BBVA: ES66 0182 0450 1102 0150 3156</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-yellow-600">FACTURA</p>
            <p className="text-lg font-medium">{invoice.number}</p>
            <p className="text-sm text-gray-500 mt-2">Fecha: {invoice.date}</p>
            {invoice.due_date && (
              <p className="text-sm text-gray-500">Vencimiento: {invoice.due_date}</p>
            )}
          </div>
        </div>

        {/* Client */}
        <div className="mb-8 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium text-gray-500 mb-1">Cliente:</p>
          <p className="font-medium">{invoice.client_name}</p>
          {invoice.client_nif && <p className="text-sm text-gray-600">NIF: {invoice.client_nif}</p>}
          {invoice.client_address && <p className="text-sm text-gray-600">{invoice.client_address}</p>}
          {invoice.client_city && (
            <p className="text-sm text-gray-600">
              {invoice.client_postal_code} {invoice.client_city}, {invoice.client_province}
            </p>
          )}
        </div>

        {/* Items */}
        <table className="w-full text-sm mb-6">
          <thead className="border-b-2 border-gray-200">
            <tr>
              <th className="pb-2 text-left font-medium">Descripcion</th>
              <th className="pb-2 text-right font-medium w-20">Cant.</th>
              <th className="pb-2 text-right font-medium w-28">Precio</th>
              <th className="pb-2 text-right font-medium w-28">Importe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoice.items.map((item) => (
              <tr key={item.id}>
                <td className="py-2">{item.description}</td>
                <td className="py-2 text-right">{item.quantity}</td>
                <td className="py-2 text-right">{item.unit_price.toFixed(2)} EUR</td>
                <td className="py-2 text-right">{item.total.toFixed(2)} EUR</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="border-t-2 border-gray-200 pt-4 text-right space-y-1">
          <p className="text-sm">Base imponible: {invoice.subtotal.toFixed(2)} EUR</p>
          <p className="text-sm">IVA {invoice.tax_rate}%: {invoice.tax_amount.toFixed(2)} EUR</p>
          <p className="text-xl font-bold">Total: {invoice.total.toFixed(2)} EUR</p>
        </div>

        {/* TicketBAI info */}
        {invoice.ticketbai_id && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-400">TicketBAI: {invoice.ticketbai_id}</p>
            {invoice.ticketbai_qr && (
              <p className="text-xs text-gray-400 mt-1">QR: {invoice.ticketbai_qr}</p>
            )}
          </div>
        )}

        {/* Notes */}
        {invoice.notes && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
