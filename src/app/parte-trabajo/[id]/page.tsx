"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, CheckCircle2, Loader2, FileText, Phone, MapPin, User, Calendar } from "lucide-react";
import { showToast } from "@/components/Toast";

interface TrabajoLine {
  id: string;
  nombre_trabajo: string | null;
  hora: string | null;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
}

interface MaterialLine {
  id: string;
  nombre_material: string | null;
  referencia: string | null;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
}

interface ParteData {
  id: string;
  numero: string;
  fecha: string;
  tecnico: string | null;
  cliente: string;
  telefono: string | null;
  direccion: string | null;
  observaciones: string | null;
  estado: string;
  iva_rate: number | null;
  descuento: number | null;
  trabajos: TrabajoLine[];
  materiales: MaterialLine[];
}

export default function ParteTrabajoViewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [parte, setParte] = useState<ParteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/parte-trabajo/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Parte no encontrado");
        return res.json();
      })
      .then((data) => {
        setParte(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [id]);

  const handleMarkCompletedAndPrint = async () => {
    if (!parte) return;
    setUpdating(true);

    try {
      await fetch(`/api/parte-trabajo/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "TRABAJO_COMPLETADO" }),
      });

      setParte((prev) => (prev ? { ...prev, estado: "TRABAJO_COMPLETADO" } : null));
      showToast("success", "Parte marcado como completado.");
    } catch {
      // Continuar con impresión incluso si falla red
    } finally {
      setUpdating(false);
      setTimeout(() => {
        window.print();
      }, 250);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!parte) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center px-4">
        <FileText className="h-12 w-12 text-slate-400 mb-3" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Parte de trabajo no encontrado</h2>
        <p className="text-sm text-slate-500 mt-1 mb-4">El identificador solicitado no existe o ha sido eliminado.</p>
        <Link href="/partes-trabajo" className="btn-secondary">
          <ArrowLeft className="h-4 w-4" /> Volver a partes de trabajo
        </Link>
      </div>
    );
  }

  const subtotalTrabajos = (parte.trabajos || []).reduce(
    (acc, t) => acc + (t.cantidad || 1) * (t.precio_unitario || 0),
    0
  );
  const subtotalMateriales = (parte.materiales || []).reduce(
    (acc, m) => acc + (m.cantidad || 1) * (m.precio_unitario || 0),
    0
  );
  const subtotalBruto = subtotalTrabajos + subtotalMateriales;
  const descuentoAmount = (subtotalBruto * (parte.descuento || 0)) / 100;
  const baseImponible = subtotalBruto - descuentoAmount;
  const ivaRate = parte.iva_rate !== null && parte.iva_rate !== undefined ? parte.iva_rate : 21;
  const ivaAmount = (baseImponible * ivaRate) / 100;
  const totalFinal = baseImponible + ivaAmount;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Barra de Acciones (Oculta en Impresión) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <Link
          href="/partes-trabajo"
          className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-secondary text-xs sm:text-sm"
          >
            <Printer className="h-4 w-4" /> Imprimir A4
          </button>
          <button
            type="button"
            onClick={handleMarkCompletedAndPrint}
            disabled={updating}
            className="btn-primary text-xs sm:text-sm"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            {updating ? "Guardando..." : "Marcar Completado e Imprimir"}
          </button>
        </div>
      </div>

      {/* Documento A4 Imprimible */}
      <div className="print-parte bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-10 shadow-sm print:shadow-none print:border-none print:p-0">
        {/* Cabecera Documento */}
        <div className="flex flex-col sm:flex-row justify-between items-start pb-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <span className="text-xs font-bold text-blue-700 uppercase tracking-widest">PARTE DE TRABAJO OFICIAL</span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">{parte.numero}</h1>
            <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 dark:text-slate-400">
              <Calendar className="h-3.5 w-3.5" />
              <span>Fecha: <strong>{parte.fecha}</strong></span>
              {parte.tecnico && <span>• Técnico: <strong>{parte.tecnico}</strong></span>}
            </div>
          </div>

          <div className="mt-4 sm:mt-0 text-left sm:text-right">
            <span
              className={`inline-block px-3 py-1 text-xs font-bold uppercase rounded-full ${
                parte.estado === "completado" || parte.estado === "TRABAJO_COMPLETADO"
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : "bg-amber-100 text-amber-800 border border-amber-300"
              }`}
            >
              {parte.estado === "TRABAJO_COMPLETADO" ? "COMPLETADO" : parte.estado.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Datos Cliente y Dirección */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 my-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
          <div className="space-y-1.5 text-xs">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Datos del Cliente</span>
            <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-slate-500" /> {parte.cliente}
            </p>
            {parte.telefono && (
              <p className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-slate-500" /> {parte.telefono}
              </p>
            )}
          </div>

          <div className="space-y-1.5 text-xs">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Ubicación del Trabajo</span>
            <p className="text-slate-700 dark:text-slate-300 flex items-start gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
              <span>{parte.direccion || "Dirección del cliente habitual"}</span>
            </p>
          </div>
        </div>

        {/* Tabla Trabajos Realizados */}
        {parte.trabajos && parte.trabajos.length > 0 && (
          <div className="my-6 space-y-2">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Trabajos y Tareas Ejecutadas
            </h3>
            <table className="w-full text-xs text-left border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="p-2.5 font-semibold">Descripción / Concepto</th>
                  <th className="p-2.5 font-semibold text-center w-16">Cant.</th>
                  <th className="p-2.5 font-semibold text-right w-24">Precio Un.</th>
                  <th className="p-2.5 font-semibold text-right w-24">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {parte.trabajos.map((t, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-2.5">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {t.nombre_trabajo || t.descripcion}
                      </div>
                      {t.nombre_trabajo && t.descripcion && (
                        <div className="text-[11px] text-slate-500">{t.descripcion}</div>
                      )}
                    </td>
                    <td className="p-2.5 text-center">{t.cantidad} {t.unidad}</td>
                    <td className="p-2.5 text-right">{t.precio_unitario?.toFixed(2)} €</td>
                    <td className="p-2.5 text-right font-medium">
                      {((t.cantidad || 1) * (t.precio_unitario || 0)).toFixed(2)} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tabla Materiales Utilizados */}
        {parte.materiales && parte.materiales.length > 0 && (
          <div className="my-6 space-y-2">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Materiales y Suministros
            </h3>
            <table className="w-full text-xs text-left border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="p-2.5 font-semibold">Material</th>
                  <th className="p-2.5 font-semibold text-center w-16">Cant.</th>
                  <th className="p-2.5 font-semibold text-right w-24">P.V.P</th>
                  <th className="p-2.5 font-semibold text-right w-24">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {parte.materiales.map((m, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-2.5">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {m.nombre_material || m.descripcion}
                      </div>
                    </td>
                    <td className="p-2.5 text-center">{m.cantidad} {m.unidad}</td>
                    <td className="p-2.5 text-right">{m.precio_unitario?.toFixed(2)} €</td>
                    <td className="p-2.5 text-right font-medium">
                      {((m.cantidad || 1) * (m.precio_unitario || 0)).toFixed(2)} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Observaciones y Totales */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 my-6 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="sm:col-span-7 text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
              Observaciones y Notas Técnicas
            </span>
            <p className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 text-[11px] leading-relaxed">
              {parte.observaciones || "Trabajo ejecutado según normativa y conformidad del cliente."}
            </p>
          </div>

          <div className="sm:col-span-5 space-y-2 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Subtotal:</span>
                <span>{subtotalBruto.toFixed(2)} €</span>
              </div>
              {parte.descuento ? (
                <div className="flex justify-between text-emerald-600">
                  <span>Descuento ({parte.descuento}%):</span>
                  <span>-{descuentoAmount.toFixed(2)} €</span>
                </div>
              ) : null}
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Base Imponible:</span>
                <span>{baseImponible.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>IVA ({ivaRate}%):</span>
                <span>{ivaAmount.toFixed(2)} €</span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between text-sm font-bold text-slate-900 dark:text-slate-100">
                <span>TOTAL FINAL:</span>
                <span>{totalFinal.toFixed(2)} €</span>
              </div>
            </div>
          </div>
        </div>

        {/* Firmas / Pie de Impresión */}
        <div className="grid grid-cols-2 gap-8 pt-10 mt-8 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
          <div className="border-t border-dashed border-slate-300 dark:border-slate-700 pt-2">
            Firma del Técnico
          </div>
          <div className="border-t border-dashed border-slate-300 dark:border-slate-700 pt-2">
            Conforme Cliente
          </div>
        </div>
      </div>
    </div>
  );
}
