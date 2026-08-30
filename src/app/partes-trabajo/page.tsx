"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ClipboardCheck, Eye, Search, FileText, Trash2, Loader2 } from "lucide-react";
import { showToast } from "@/components/Toast";

export type ParteTrabajoEstado =
  | "borrador"
  | "pendiente"
  | "en_progreso"
  | "completado"
  | "TRABAJO_COMPLETADO"
  | "facturado"
  | "firmado"
  | "cerrado"
  | "cancelado";

interface ParteTrabajo {
  id: string;
  numero: string;
  fecha: string;
  cliente: string;
  tecnico: string;
  estado: ParteTrabajoEstado;
}

const ESTADO_COLORS: Record<ParteTrabajoEstado, string> = {
  borrador: "bg-amber-50 text-amber-700 border-amber-100",
  pendiente: "bg-amber-50 text-amber-700 border-amber-100",
  en_progreso: "bg-blue-50 text-blue-700 border-blue-100",
  completado: "bg-emerald-50 text-emerald-700 border-emerald-100",
  TRABAJO_COMPLETADO: "bg-emerald-50 text-emerald-700 border-emerald-100",
  facturado: "bg-purple-50 text-purple-700 border-purple-100",
  firmado: "bg-blue-50 text-blue-700 border-blue-100",
  cerrado: "bg-slate-50 text-slate-700 border-slate-100",
  cancelado: "bg-red-50 text-red-700 border-red-100",
};

export default function PartesTrabajoPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [partes, setPartes] = useState<ParteTrabajo[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [convertingToInvoice, setConvertingToInvoice] = useState<string | null>(null);

  useEffect(() => {
    fetchPartes();
  }, []);

  const fetchPartes = async () => {
    try {
      const res = await fetch("/api/partes-trabajo");
      if (res.ok) {
        const data = await res.json();
        setPartes(data);
      } else {
        showToast("error", "Error al cargar los partes de trabajo");
      }
    } catch {
      showToast("error", "Error de conexión al cargar partes");
    } finally {
      setLoading(false);
    }
  };

  const filtered = partes.filter(
    (p) =>
      p.numero.toLowerCase().includes(search.toLowerCase()) ||
      p.cliente.toLowerCase().includes(search.toLowerCase()) ||
      (p.tecnico || "").toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Seguro que quieres borrar este parte de trabajo? Esta acción no se puede deshacer.")) return;

    setDeleting(id);
    try {
      const res = await fetch(`/api/partes-trabajo/${id}`, { method: "DELETE" });
      if (res.ok) {
        setPartes((prev) => prev.filter((p) => p.id !== id));
        showToast("success", "Parte de trabajo eliminado");
      } else {
        showToast("error", "Error al eliminar el parte");
      }
    } catch {
      showToast("error", "Error de conexión al eliminar");
    } finally {
      setDeleting(null);
    }
  };

  const handleConvertToInvoice = async (parteId: string) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      showToast("error", "Sin conexión a internet. Verifica tu red e inténtalo de nuevo.");
      setConvertingToInvoice(null);
      return;
    }
    if (!window.confirm("¿Generar factura a partir de este parte de trabajo?")) return;
    setConvertingToInvoice(parteId);
    try {
      const res = await fetch(`/api/partes-trabajo/${parteId}/convert`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        showToast("success", `Factura creada: ${data.number}`);
        router.push(`/facturas/${data.id}`);
      } else {
        showToast("error", data.error || "Error al generar factura");
        // Si ya existía una factura para este parte, navega a ella
        if (data.invoiceId) {
          router.push(`/facturas/${data.invoiceId}`);
        }
      }
    } catch (err) {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        showToast("error", "Sin conexión a internet. Verifica tu red e inténtalo de nuevo.");
      } else if (err instanceof TypeError) {
        showToast("error", "Error de conexión con el servidor. Verifica tu red.");
      } else {
        showToast("error", "Error de conexión al generar factura");
      }
    } finally {
      setConvertingToInvoice(null);
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">Partes de trabajo</h1>
          <p className="page-subtitle">{filtered.length} partes registrados</p>
        </div>
        <div className="flex gap-2">
          <Link href="/partes-trabajo/plantilla" className="btn-secondary">
            <FileText className="h-4 w-4" />
            Plantilla en blanco
          </Link>
          <Link href="/partes-trabajo/nuevo" className="btn-primary">
            <Plus className="h-4 w-4" />
            Nuevo parte
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nº, cliente o técnico..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9"
          />
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <span className="ml-2 text-sm text-slate-500">Cargando partes...</span>
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-header">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Nº Parte</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hidden md:table-cell">Técnico</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((parte) => (
                  <tr key={parte.id} className="table-row">
                    <td className="px-4 py-3.5">
                      <span className="font-semibold text-slate-900">{parte.numero}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-slate-600">{formatDate(parte.fecha)}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-slate-700">{parte.cliente}</span>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className="text-xs text-slate-600">{parte.tecnico || "—"}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-medium rounded-full px-2.5 py-1 border ${ESTADO_COLORS[parte.estado] || ESTADO_COLORS.borrador}`}>
                        {parte.estado ? parte.estado.charAt(0).toUpperCase() + parte.estado.slice(1) : "Borrador"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/partes-trabajo/${parte.id}`}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Ver
                        </Link>
                        {(parte.estado === "completado" || parte.estado === "TRABAJO_COMPLETADO") && (
                          <button
                            onClick={() => handleConvertToInvoice(parte.id)}
                            disabled={convertingToInvoice === parte.id}
                            className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                            title="Generar factura"
                          >
                            {convertingToInvoice === parte.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <FileText className="h-3.5 w-3.5" />}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(parte.id)}
                          disabled={deleting === parte.id}
                          className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors disabled:opacity-50"
                          title="Eliminar parte"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <div className="empty-state">
                        <ClipboardCheck className="empty-state-icon" />
                        <p className="empty-state-title">Sin partes de trabajo</p>
                        <p className="empty-state-text">Crea tu primer parte de trabajo para registrar intervenciones</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
