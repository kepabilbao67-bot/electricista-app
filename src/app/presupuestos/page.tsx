"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Eye, Copy, FileText, AlertTriangle } from "lucide-react";
import { showToast } from "@/components/Toast";

interface Budget {
  id: string;
  number: string;
  client_id: string;
  client_name: string;
  date: string;
  valid_until: string;
  total: number;
  status: string;
  converted_invoice_id: string | null;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: "Borrador", color: "bg-slate-100 text-slate-600" },
  sent: { label: "Enviado", color: "bg-blue-50 text-blue-700 border border-blue-100" },
  accepted: { label: "Aceptado", color: "bg-emerald-50 text-emerald-700 border border-emerald-100" },
  rejected: { label: "Rechazado", color: "bg-red-50 text-red-700 border border-red-100" },
};

export default function PresupuestosPage() {
  const router = useRouter();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [converting, setConverting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/budgets")
      .then((res) => res.json())
      .then((data) => {
        setBudgets(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const isExpired = (validUntil: string) => {
    if (!validUntil) return false;
    const today = new Date().toISOString().split("T")[0];
    return validUntil < today;
  };

  const handleDuplicate = async (budget: Budget) => {
    setDuplicating(budget.id);
    try {
      // Get full budget details with items
      const detailRes = await fetch(`/api/budgets/${budget.id}`);
      const detail = await detailRes.json();

      // Create new budget with same items
      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: detail.client_id,
          date: new Date().toISOString().split("T")[0],
          valid_until: null,
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
        const newBudget = await res.json();
        showToast("success", `Presupuesto duplicado: ${newBudget.number}`);
        router.push(`/presupuestos/${newBudget.id}`);
      } else {
        showToast("error", "Error al duplicar el presupuesto");
      }
    } catch {
      showToast("error", "Error al duplicar el presupuesto");
    }
    setDuplicating(null);
  };

  const handleConvert = async (budgetId: string) => {
    if (!confirm("Convertir este presupuesto a factura?")) return;
    setConverting(budgetId);
    try {
      const res = await fetch("/api/budgets/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budget_id: budgetId }),
      });

      if (res.ok) {
        const invoice = await res.json();
        showToast("success", `Factura creada: ${invoice.number}`);
        router.push(`/facturas/${invoice.id}`);
      } else {
        const err = await res.json();
        showToast("error", err.error || "Error al convertir");
      }
    } catch {
      showToast("error", "Error al convertir el presupuesto");
    }
    setConverting(null);
  };

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
          <h1 className="page-title">Presupuestos</h1>
          <p className="page-subtitle">{budgets.length} presupuestos registrados</p>
        </div>
        <Link href="/presupuestos/nuevo" className="btn-primary">
          <Plus className="h-4 w-4" />
          Nuevo presupuesto
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
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hidden md:table-cell">Validez</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Total</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Estado</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((budget) => {
                const status = statusLabels[budget.status] || statusLabels.draft;
                const expired = isExpired(budget.valid_until) && budget.status !== "accepted" && budget.status !== "rejected";
                return (
                  <tr key={budget.id} className="table-row">
                    <td className="px-4 py-3.5 font-semibold text-slate-900">{budget.number}</td>
                    <td className="px-4 py-3.5 text-slate-600">{budget.client_name}</td>
                    <td className="px-4 py-3.5 hidden sm:table-cell text-slate-500">{budget.date}</td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      {budget.valid_until ? (
                        <span className={`inline-flex items-center gap-1 text-xs ${expired ? "text-red-600 font-semibold" : "text-slate-500"}`}>
                          {expired && <AlertTriangle className="h-3 w-3" />}
                          {budget.valid_until}
                          {expired && <span className="text-[10px] bg-red-50 rounded px-1 border border-red-200">Caducado</span>}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-slate-900">{budget.total.toFixed(2)} EUR</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`badge ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/presupuestos/${budget.id}`}
                          className="rounded-lg p-1.5 text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="Ver detalle"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          onClick={() => handleDuplicate(budget)}
                          disabled={duplicating === budget.id}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors disabled:opacity-50"
                          title="Duplicar presupuesto"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        {!budget.converted_invoice_id && budget.status !== "rejected" && (
                          <button
                            onClick={() => handleConvert(budget.id)}
                            disabled={converting === budget.id}
                            className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                            title="Convertir a factura"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {budgets.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    No hay presupuestos registrados
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
