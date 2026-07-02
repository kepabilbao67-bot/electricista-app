"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Eye } from "lucide-react";

interface Budget {
  id: string;
  number: string;
  client_name: string;
  date: string;
  valid_until: string;
  total: number;
  status: string;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: "Borrador", color: "bg-gray-100 text-gray-700" },
  sent: { label: "Enviado", color: "bg-blue-100 text-blue-700" },
  accepted: { label: "Aceptado", color: "bg-green-100 text-green-700" },
  rejected: { label: "Rechazado", color: "bg-red-100 text-red-700" },
};

export default function PresupuestosPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/budgets")
      .then((res) => res.json())
      .then((data) => {
        setBudgets(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Presupuestos</h1>
        <Link
          href="/presupuestos/nuevo"
          className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-yellow-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nuevo presupuesto
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Numero</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Cliente</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 hidden sm:table-cell">Fecha</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 hidden md:table-cell">Validez</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Total</th>
                <th className="px-4 py-3 text-center font-medium text-gray-700">Estado</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {budgets.map((budget) => {
                const status = statusLabels[budget.status] || statusLabels.draft;
                return (
                  <tr key={budget.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{budget.number}</td>
                    <td className="px-4 py-3">{budget.client_name}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-gray-500">{budget.date}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-500">{budget.valid_until || "-"}</td>
                    <td className="px-4 py-3 text-right font-medium">{budget.total.toFixed(2)} EUR</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/presupuestos/${budget.id}`}
                        className="inline-flex items-center gap-1 rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {budgets.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
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
