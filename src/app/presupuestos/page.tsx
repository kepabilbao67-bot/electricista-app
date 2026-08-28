"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Eye, Copy, ClipboardCheck, AlertTriangle, Trash2, Calendar, FileText, User } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
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

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

const statusBadgeVariants: Record<string, "gray" | "blue" | "green" | "red"> = {
  draft: "gray",
  sent: "blue",
  accepted: "green",
  rejected: "red",
};

const statusLabels: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviado",
  accepted: "Aceptado",
  rejected: "Rechazado",
};

export default function PresupuestosPage() {
  const router = useRouter();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [creatingParte, setCreatingParte] = useState<string | null>(null);

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
      const detailRes = await fetch(`/api/budgets/${budget.id}`);
      const detail = await detailRes.json();

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

  const handleDelete = async (budget: Budget) => {
    const confirmMsg = budget.converted_invoice_id
      ? "Este presupuesto está convertido en factura. ¿Seguro que quieres borrarlo?"
      : "¿Seguro que quieres borrar este presupuesto? Esta acción no se puede deshacer.";
    if (!confirm(confirmMsg)) return;
    try {
      const res = await fetch(`/api/budgets/${budget.id}`, { method: "DELETE" });
      if (res.ok) {
        setBudgets(budgets.filter((b) => b.id !== budget.id));
        showToast("success", `Presupuesto ${budget.number} eliminado`);
      } else {
        showToast("error", "Error al eliminar el presupuesto");
      }
    } catch {
      showToast("error", "Error al eliminar el presupuesto");
    }
  };

  const handleCreateParte = async (budgetId: string) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      showToast("error", "Sin conexión a internet. Verifica tu red e inténtalo de nuevo.");
      setCreatingParte(null);
      return;
    }
    if (!confirm("¿Crear un Parte de Trabajo a partir de este presupuesto?")) return;
    setCreatingParte(budgetId);
    try {
      const res = await fetch(`/api/budgets/${budgetId}/create-parte`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        showToast("success", `Parte de trabajo creado: ${data.numero}`);
        router.push(`/partes-trabajo/${data.id}`);
      } else {
        showToast("error", data.error || "Error al crear parte de trabajo");
        if (data.parteId) {
          router.push(`/partes-trabajo/${data.parteId}`);
        }
      }
    } catch (err) {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        showToast("error", "Sin conexión a internet. Verifica tu red e inténtalo de nuevo.");
      } else if (err instanceof TypeError) {
        showToast("error", "Error de conexión con el servidor. Verifica tu red.");
      } else {
        showToast("error", "Error de conexión al crear parte de trabajo");
      }
    } finally {
      setCreatingParte(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-800 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Presupuestos</h1>
          <p className="text-sm text-slate-500 mt-1">{budgets.length} presupuestos registrados</p>
        </div>
        <Link href="/presupuestos/nuevo">
          <Button variant="primary" size="md" icon={Plus}>
            Nuevo Presupuesto
          </Button>
        </Link>
      </div>

      {/* Empty State */}
      {budgets.length === 0 ? (
        <EmptyState
          title="Aún no tienes presupuestos"
          description="Crea tu primer presupuesto para clientes con cálculo de IVA, REBT y desglose de materiales y mano de obra."
          actionLabel="Crear Primer Presupuesto"
          actionHref="/presupuestos/nuevo"
        />
      ) : (
        <div className="space-y-4">
          {/* Mobile Cards (Visualización móvil) */}
          <div className="grid grid-cols-1 md:hidden gap-3">
            {budgets.map((budget) => {
              const statusVariant = statusBadgeVariants[budget.status] || "gray";
              const expired = isExpired(budget.valid_until) && budget.status !== "accepted" && budget.status !== "rejected";
              return (
                <Card key={budget.id} variant="default" className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-base font-extrabold text-blue-900">{budget.number}</span>
                      <p className="text-xs text-slate-600 font-medium mt-0.5">{budget.client_name || "Sin cliente"}</p>
                    </div>
                    <Badge variant={statusVariant} size="sm">
                      {statusLabels[budget.status] || budget.status}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>{formatDate(budget.date)}</span>
                    </div>
                    <div>
                      <span className="text-sm font-extrabold text-slate-900">{budget.total.toFixed(2)} €</span>
                    </div>
                  </div>

                  {expired && (
                    <div className="flex items-center gap-1 text-xs text-rose-700 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>Caducado ({formatDate(budget.valid_until)})</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-100">
                    <Link href={`/presupuestos/${budget.id}`}>
                      <Button variant="ghost" size="sm" icon={Eye}>Ver</Button>
                    </Link>
                    {budget.status !== "rejected" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={ClipboardCheck}
                        onClick={() => handleCreateParte(budget.id)}
                        disabled={creatingParte === budget.id}
                        className="text-emerald-700 hover:text-emerald-800"
                      >
                        Parte
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Copy}
                      onClick={() => handleDuplicate(budget)}
                      disabled={duplicating === budget.id}
                    >
                      Duplicar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      onClick={() => handleDelete(budget)}
                      className="text-rose-600 hover:text-rose-700"
                    >
                      Borrar
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="table-header">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Número</th>
                  <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Cliente</th>
                  <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500 hidden sm:table-cell">Fecha</th>
                  <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500 hidden md:table-cell">Validez</th>
                  <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Total</th>
                  <th className="px-4 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Estado</th>
                  <th className="px-5 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {budgets.map((budget) => {
                  const statusVariant = statusBadgeVariants[budget.status] || "gray";
                  const expired = isExpired(budget.valid_until) && budget.status !== "accepted" && budget.status !== "rejected";
                  return (
                    <tr key={budget.id} className="hover:bg-blue-50/20 transition-colors">
                      <td className="px-5 py-4">
                        <Link href={`/presupuestos/${budget.id}`} className="font-extrabold text-blue-900 hover:text-blue-600 transition-colors text-sm">
                          {budget.number}
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-slate-700 font-medium">
                        {budget.client_name || <span className="text-slate-400 italic">Sin cliente</span>}
                      </td>
                      <td className="px-4 py-4 hidden sm:table-cell text-xs text-slate-500 font-medium">
                        {formatDate(budget.date)}
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        {budget.valid_until ? (
                          <span className={`inline-flex items-center gap-1 text-xs ${expired ? "text-rose-600 font-bold" : "text-slate-500"}`}>
                            {expired && <AlertTriangle className="h-3.5 w-3.5" />}
                            {formatDate(budget.valid_until)}
                            {expired && <span className="text-[10px] bg-rose-50 rounded px-1.5 py-0.5 border border-rose-200">Caducado</span>}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right font-extrabold text-slate-900 text-sm">
                        {budget.total.toFixed(2)} €
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Badge variant={statusVariant} size="sm">
                          {statusLabels[budget.status] || budget.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/presupuestos/${budget.id}`}>
                            <Button variant="ghost" size="sm" icon={Eye}>Ver</Button>
                          </Link>
                          {budget.status !== "rejected" && (
                            budget.client_id ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={ClipboardCheck}
                                onClick={() => handleCreateParte(budget.id)}
                                disabled={creatingParte === budget.id}
                                className="text-emerald-700 hover:text-emerald-800"
                              >
                                Parte
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={ClipboardCheck}
                                onClick={() => showToast("error", "Asigna un cliente antes de crear el parte de trabajo.")}
                                className="text-slate-300 cursor-not-allowed"
                              >
                                Parte
                              </Button>
                            )
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Copy}
                            onClick={() => handleDuplicate(budget)}
                            disabled={duplicating === budget.id}
                          >
                            Duplicar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Trash2}
                            onClick={() => handleDelete(budget)}
                            className="text-rose-600 hover:text-rose-700"
                          >
                            Borrar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
