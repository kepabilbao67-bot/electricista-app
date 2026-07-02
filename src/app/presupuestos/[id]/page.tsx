"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, FileText, Send } from "lucide-react";

interface BudgetDetail {
  id: string;
  number: string;
  client_name: string;
  client_nif: string;
  client_address: string;
  client_city: string;
  client_postal_code: string;
  client_province: string;
  date: string;
  valid_until: string;
  status: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes: string;
  converted_invoice_id: string | null;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
}

export default function PresupuestoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [budget, setBudget] = useState<BudgetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetch(`/api/budgets/${params.id}`)
        .then((r) => r.json())
        .then((data) => {
          setBudget(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [params.id]);

  const convertToInvoice = async () => {
    if (!budget) return;
    setConverting(true);
    try {
      const res = await fetch("/api/budgets/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budget_id: budget.id }),
      });
      if (res.ok) {
        const invoice = await res.json();
        router.push(`/facturas/${invoice.id}`);
      }
    } catch (err) {
      console.error(err);
    }
    setConverting(false);
  };

  const markSent = async () => {
    if (!budget) return;
    await fetch(`/api/budgets/${budget.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "sent" }),
    });
    setBudget({ ...budget, status: "sent" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  if (!budget) {
    return <div className="text-center py-8 text-gray-500">Presupuesto no encontrado</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="rounded-lg p-2 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold">Presupuesto {budget.number}</h1>
        <div className="ml-auto flex gap-2">
          {budget.status === "draft" && (
            <button
              onClick={markSent}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
            >
              <Send className="h-4 w-4" />
              Marcar enviado
            </button>
          )}
          {!budget.converted_invoice_id && budget.status !== "rejected" && (
            <button
              onClick={convertToInvoice}
              disabled={converting}
              className="inline-flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50"
            >
              <FileText className="h-4 w-4" />
              {converting ? "Convirtiendo..." : "Convertir a factura"}
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
        <div className="flex justify-between mb-8">
          <div>
            <h2 className="text-xl font-bold text-gray-900">MARTIN OYARZABAL, IVAN</h2>
            <p className="text-sm text-gray-500">NIF: 16063731W</p>
            <p className="text-sm text-gray-500">Lehendakari Aguirre 7b 2 derecha</p>
            <p className="text-sm text-gray-500">48640 Berango, Bizkaia</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-yellow-600">PRESUPUESTO</p>
            <p className="text-lg font-medium">{budget.number}</p>
            <p className="text-sm text-gray-500 mt-2">Fecha: {budget.date}</p>
            {budget.valid_until && (
              <p className="text-sm text-gray-500">Valido hasta: {budget.valid_until}</p>
            )}
          </div>
        </div>

        <div className="mb-8 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium text-gray-500 mb-1">Cliente:</p>
          <p className="font-medium">{budget.client_name}</p>
          {budget.client_nif && <p className="text-sm text-gray-600">NIF: {budget.client_nif}</p>}
          {budget.client_address && <p className="text-sm text-gray-600">{budget.client_address}</p>}
          {budget.client_city && (
            <p className="text-sm text-gray-600">
              {budget.client_postal_code} {budget.client_city}, {budget.client_province}
            </p>
          )}
        </div>

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
            {budget.items.map((item) => (
              <tr key={item.id}>
                <td className="py-2">{item.description}</td>
                <td className="py-2 text-right">{item.quantity}</td>
                <td className="py-2 text-right">{item.unit_price.toFixed(2)} EUR</td>
                <td className="py-2 text-right">{item.total.toFixed(2)} EUR</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t-2 border-gray-200 pt-4 text-right space-y-1">
          <p className="text-sm">Base imponible: {budget.subtotal.toFixed(2)} EUR</p>
          <p className="text-sm">IVA {budget.tax_rate}%: {budget.tax_amount.toFixed(2)} EUR</p>
          <p className="text-xl font-bold">Total: {budget.total.toFixed(2)} EUR</p>
        </div>

        {budget.notes && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">{budget.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
