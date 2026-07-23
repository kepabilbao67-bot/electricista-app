"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { showToast } from "@/components/Toast";
import { ArrowLeft, Printer, Trash2, Loader2, Pencil, X } from "lucide-react";
import ParteForm from "@/components/ParteForm";
import { getTrabajoColorClass } from "@/components/ParteForm";
import type { ParteFormData, TrabajoLine, MaterialLine } from "@/components/ParteForm";

interface TrabajoDB {
  id: string;
  nombre_trabajo: string | null;
  hora: string | null;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  estado: string;
  color?: string | null;
}

interface MaterialDB {
  id: string;
  nombre_material: string | null;
  referencia: string | null;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio_coste: number;
  precio_unitario: number;
}

interface ParteDetalle {
  id: string;
  numero: string;
  fecha: string;
  tecnico: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  cliente: string;
  direccion: string | null;
  observaciones: string | null;
  estado: string;
  iva_rate: number | null;
  descuento: number | null;
  trabajos: TrabajoDB[];
  materiales: MaterialDB[];
}

export default function ParteTrabajoDetailPage() {
  return (
    <Suspense fallback={
      <div className="animate-fade-in flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2 text-sm text-slate-500">Cargando parte...</span>
      </div>
    }>
      <ParteTrabajoDetail />
    </Suspense>
  );
}

function ParteTrabajoDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [parte, setParte] = useState<ParteDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<"trabajos" | "materiales">("trabajos");

  const fetchParte = async () => {
    try {
      const res = await fetch(`/api/partes-trabajo/${id}`);
      if (res.status === 404) { setNotFound(true); return; }
      if (res.ok) { setParte(await res.json()); }
      else { showToast("error", "Error al cargar el parte"); setNotFound(true); }
    } catch { showToast("error", "Error de conexión"); setNotFound(true); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchParte(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="animate-fade-in flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2 text-sm text-slate-500">Cargando parte...</span>
      </div>
    );
  }

  if (notFound || !parte) {
    return (
      <div className="animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/partes-trabajo" className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50 transition-all">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="page-title">Parte no encontrado</h1>
        </div>
        <p className="text-slate-500">El parte de trabajo solicitado no existe.</p>
      </div>
    );
  }

  // --- Edit mode ---
  if (editing) {
    const formData: ParteFormData = {
      fecha: parte.fecha, tecnico: parte.tecnico || "", horaInicio: parte.hora_inicio || "",
      horaFin: parte.hora_fin || "", cliente: parte.cliente, client_id: "",
      direccion: parte.direccion || "", observaciones: parte.observaciones || "",
      estado: parte.estado, iva_rate: String(parte.iva_rate ?? 21),
      descuento: String(parte.descuento ?? 0), budget_id: "", visit_id: "",
    };
    const formTrabajos: TrabajoLine[] = parte.trabajos.length > 0
      ? parte.trabajos.map((t, i) => ({ id: `t${i}_${Date.now()}`, nombre_trabajo: t.nombre_trabajo || "", hora: t.hora || "", descripcion: t.descripcion, cantidad: t.cantidad ? String(t.cantidad) : "", unidad: t.unidad || "unidad", precio_unitario: t.precio_unitario ? String(t.precio_unitario) : "", estado: t.estado || "completado", color: t.color || "default" }))
      : Array.from({ length: 20 }, (_, i) => ({ id: `t${i}_${Date.now()}`, nombre_trabajo: "", hora: "", descripcion: "", cantidad: "", unidad: "unidad", precio_unitario: "", estado: "completado", color: "default" }));
    while (formTrabajos.length < 20) formTrabajos.push({ id: `t${formTrabajos.length}_${Date.now() + formTrabajos.length}`, nombre_trabajo: "", hora: "", descripcion: "", cantidad: "", unidad: "unidad", precio_unitario: "", estado: "completado", color: "default" });
    const formMateriales: MaterialLine[] = parte.materiales.length > 0
      ? parte.materiales.map((m, i) => ({ id: `m${i}_${Date.now()}`, nombre_material: m.nombre_material || "", referencia: m.referencia || "", descripcion: m.descripcion, cantidad: m.cantidad ? String(m.cantidad) : "", unidad: m.unidad || "unidad", precio_coste: m.precio_coste ? String(m.precio_coste) : "", precio_unitario: m.precio_unitario ? String(m.precio_unitario) : "" }))
      : Array.from({ length: 20 }, (_, i) => ({ id: `m${i}_${Date.now()}`, nombre_material: "", referencia: "", descripcion: "", cantidad: "", unidad: "unidad", precio_coste: "", precio_unitario: "" }));
    while (formMateriales.length < 20) formMateriales.push({ id: `m${formMateriales.length}_${Date.now() + formMateriales.length}`, nombre_material: "", referencia: "", descripcion: "", cantidad: "", unidad: "unidad", precio_coste: "", precio_unitario: "" });

    return (
      <div className="animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setEditing(false)} className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50 transition-all"><X className="h-4 w-4" /></button>
          <div><h1 className="page-title">Editar {parte.numero}</h1><p className="page-subtitle">Modificando parte de trabajo</p></div>
        </div>
        <ParteForm parteId={id} initialData={formData} initialTrabajos={formTrabajos} initialMateriales={formMateriales}
          onSaved={() => { setEditing(false); setLoading(true); fetchParte().finally(() => setLoading(false)); }} />
      </div>
    );
  }

  // --- View mode ---
  const handlePrint = () => window.print();
  const handleDelete = async () => {
    if (!window.confirm("¿Seguro que quieres borrar este parte de trabajo? Esta acción no se puede deshacer.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/partes-trabajo/${id}`, { method: "DELETE" });
      if (res.ok) { showToast("success", "Parte de trabajo eliminado"); router.push("/partes-trabajo"); }
      else { showToast("error", "Error al eliminar el parte"); setDeleting(false); }
    } catch { showToast("error", "Error de conexión al eliminar"); setDeleting(false); }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  // Calculations
  const subtotalTrabajos = parte.trabajos.reduce((sum, t) => sum + (t.cantidad || 0) * (t.precio_unitario || 0), 0);
  const subtotalMateriales = parte.materiales.reduce((sum, m) => sum + (m.cantidad || 0) * (m.precio_unitario || 0), 0);
  const descuentoNum = parte.descuento || 0;
  const baseImponible = subtotalTrabajos + subtotalMateriales - descuentoNum;
  const ivaRate = parte.iva_rate ?? 21;
  const ivaAmount = baseImponible * (ivaRate / 100);
  const totalParte = baseImponible + ivaAmount;
  const totalHoras = parte.trabajos.reduce((sum, t) => {
    const c = typeof t.cantidad === "number" ? t.cantidad : Number(String(t.cantidad || "0").replace(",", "."));
    return sum + (Number.isFinite(c) ? c : 0);
  }, 0);
  const totalHorasLabel = Number.isInteger(totalHoras) ? String(totalHoras) : String(parseFloat(totalHoras.toFixed(2)));

  const UNIDAD_LABELS: Record<string, string> = { hora: "h", unidad: "ud", metro: "m", punto: "pto", servicio: "srv", rollo: "rollo", caja: "caja", paquete: "paq" };

  return (
    <div className="animate-fade-in">
      {/* Screen-only header */}
      <div className="flex items-center justify-between mb-6 no-print">
        <div className="flex items-center gap-3">
          <Link href="/partes-trabajo" className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50 transition-all"><ArrowLeft className="h-4 w-4" /></Link>
          <div><h1 className="page-title">{parte.numero}</h1><p className="page-subtitle">Parte de trabajo — {parte.cliente}</p></div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setEditing(true)} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-sm font-medium text-blue-600 shadow-sm hover:bg-blue-50 transition-all"><Pencil className="h-4 w-4" /> Editar</button>
          <button onClick={handleDelete} disabled={deleting} className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 shadow-sm hover:bg-red-50 transition-all disabled:opacity-50"><Trash2 className="h-4 w-4" /> Borrar</button>
          <button onClick={handlePrint} className="btn-primary"><Printer className="h-4 w-4" /> Imprimir / PDF</button>
        </div>
      </div>

      {/* Screen-only tabs */}
      <div className="no-print mb-6">
        <div className="flex border-b border-slate-200 rounded-t-xl overflow-hidden bg-white shadow-sm">
          <button onClick={() => setActiveTab("trabajos")} className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${activeTab === "trabajos" ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600" : "text-slate-600 hover:bg-slate-50"}`}>Mano de obra ({parte.trabajos.length})</button>
          <button onClick={() => setActiveTab("materiales")} className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${activeTab === "materiales" ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600" : "text-slate-600 hover:bg-slate-50"}`}>Materiales ({parte.materiales.length})</button>
        </div>
      </div>

      {/* Printable document */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6 md:p-10 print:shadow-none print:border-none print:p-0 print:rounded-none max-w-4xl mx-auto print-parte">

        {/* CABECERA — compact inline */}
        <div className="flex justify-between items-start border-b-2 border-slate-800 pb-3 mb-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">S&H ELÉCTRICAS</h2>
            <p className="text-xs text-slate-600 mt-0.5">Iván Martín Oyarzabal · Tel: 609 421 750</p>
          </div>
          <div className="text-right">
            <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide">Parte de Trabajo</h3>
            <p className="text-xs text-slate-600 mt-0.5">Nº: <span className="font-semibold text-slate-900">{parte.numero}</span></p>
          </div>
        </div>

        {/* DATOS GENERALES + CLIENTE — single compact row */}
        <div className="grid grid-cols-6 gap-2 mb-3 text-xs border border-slate-200 rounded p-2">
          <div><span className="font-semibold text-slate-500 block">Fecha</span><span className="text-slate-900">{formatDate(parte.fecha)}</span></div>
          <div><span className="font-semibold text-slate-500 block">Operario</span><span className="text-slate-900">{parte.tecnico || "—"}</span></div>
          <div><span className="font-semibold text-slate-500 block">Inicio</span><span className="text-slate-900">{parte.hora_inicio || "—"}</span></div>
          <div><span className="font-semibold text-slate-500 block">Fin</span><span className="text-slate-900">{parte.hora_fin || "—"}</span></div>
          <div><span className="font-semibold text-slate-500 block">Cliente</span><span className="text-slate-900 font-medium">{parte.cliente}</span></div>
          <div><span className="font-semibold text-slate-500 block">Dirección</span><span className="text-slate-900">{parte.direccion || "—"}</span></div>
        </div>

        {/* TRABAJOS — always visible on screen if active tab, always visible in print */}
        <div className={`mb-3 ${activeTab !== "trabajos" ? "hidden print-show" : ""}`}>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Trabajos realizados</h4>
          {parte.trabajos.length > 0 && (
            <table className="w-full text-xs border border-slate-200">
              <thead>
                <tr className="bg-slate-100">
                  <th className="px-1 py-1 text-left w-6">#</th>
                  <th className="px-1 py-1 text-left">Descripción</th>
                  <th className="px-1 py-1 text-center w-10">Cant.</th>
                  <th className="px-1 py-1 text-center w-8">Ud.</th>
                  <th className="px-1 py-1 text-right w-14">Precio</th>
                  <th className="px-1 py-1 text-right w-16">Importe</th>
                </tr>
              </thead>
              <tbody>
                {parte.trabajos.map((t, idx) => {
                  const importe = (t.cantidad || 0) * (t.precio_unitario || 0);
                  const colorClass = getTrabajoColorClass(t.color);
                  return (
                    <tr key={t.id} className="border-t border-slate-100">
                      <td className="px-1 py-1 text-slate-400">{idx + 1}</td>
                      <td className={`px-1 py-1 ${colorClass}`}>
                        {t.nombre_trabajo && <span className="font-medium">{t.nombre_trabajo}: </span>}
                        {t.descripcion}
                      </td>
                      <td className="px-1 py-1 text-center text-slate-700">{t.cantidad || ""}</td>
                      <td className="px-1 py-1 text-center text-slate-600">{UNIDAD_LABELS[t.unidad] || t.unidad}</td>
                      <td className="px-1 py-1 text-right text-slate-700">{t.precio_unitario ? `${t.precio_unitario.toFixed(2)}` : ""}</td>
                      <td className="px-1 py-1 text-right font-medium text-slate-900">{importe > 0 ? `${importe.toFixed(2)} €` : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* MATERIALES — only if there are materials */}
        {parte.materiales.length > 0 && (
          <div className={`mb-3 ${activeTab !== "materiales" ? "hidden print-show" : ""}`}>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Materiales</h4>
            <table className="w-full text-xs border border-slate-200">
              <thead>
                <tr className="bg-slate-100">
                  <th className="px-1 py-1 text-left w-6">#</th>
                  <th className="px-1 py-1 text-left">Material</th>
                  <th className="px-1 py-1 text-center w-10">Cant.</th>
                  <th className="px-1 py-1 text-center w-8">Ud.</th>
                  <th className="px-1 py-1 text-right w-14">Precio</th>
                  <th className="px-1 py-1 text-right w-16">Importe</th>
                </tr>
              </thead>
              <tbody>
                {parte.materiales.map((m, idx) => {
                  const importe = (m.cantidad || 0) * (m.precio_unitario || 0);
                  return (
                    <tr key={m.id} className="border-t border-slate-100">
                      <td className="px-1 py-1 text-slate-400">{idx + 1}</td>
                      <td className="px-1 py-1 text-slate-800">{m.nombre_material && <span className="font-medium">{m.nombre_material}: </span>}{m.descripcion}</td>
                      <td className="px-1 py-1 text-center text-slate-700">{m.cantidad || ""}</td>
                      <td className="px-1 py-1 text-center text-slate-600">{UNIDAD_LABELS[m.unidad] || m.unidad}</td>
                      <td className="px-1 py-1 text-right text-slate-700">{m.precio_unitario ? `${m.precio_unitario.toFixed(2)}` : ""}</td>
                      <td className="px-1 py-1 text-right font-medium text-slate-900">{importe > 0 ? `${importe.toFixed(2)} €` : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* RESUMEN ECONÓMICO — single compact block */}
        <div className="mb-3 border border-slate-200 rounded p-2 print-keep-together">
          <div className="max-w-xs ml-auto space-y-0.5 text-xs">
            <div className="flex justify-between"><span className="text-slate-600">Subtotal mano de obra</span><span>{subtotalTrabajos.toFixed(2)} €</span></div>
            {totalHoras > 0 && <div className="flex justify-between font-semibold"><span className="text-slate-700">Total horas</span><span>{totalHorasLabel} h</span></div>}
            {subtotalMateriales > 0 && <div className="flex justify-between"><span className="text-slate-600">Subtotal materiales</span><span>{subtotalMateriales.toFixed(2)} €</span></div>}
            {descuentoNum > 0 && <div className="flex justify-between"><span className="text-slate-600">Descuento</span><span>-{descuentoNum.toFixed(2)} €</span></div>}
            <div className="flex justify-between border-t border-slate-200 pt-0.5"><span className="font-medium text-slate-700">Base imponible</span><span className="font-semibold">{baseImponible.toFixed(2)} €</span></div>
            <div className="flex justify-between"><span className="text-slate-600">IVA ({ivaRate}%)</span><span>{ivaAmount.toFixed(2)} €</span></div>
            <div className="flex justify-between border-t-2 border-slate-800 pt-1"><span className="font-bold text-slate-900">TOTAL</span><span className="text-sm font-bold text-slate-900">{totalParte.toFixed(2)} €</span></div>
          </div>
        </div>

        {/* OBSERVACIONES — only if present */}
        {parte.observaciones && (
          <div className="mb-3 p-2 border border-slate-200 rounded bg-amber-50/50 print:bg-transparent">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-0.5">Observaciones</h4>
            <p className="text-xs text-slate-700 whitespace-pre-line">{parte.observaciones}</p>
          </div>
        )}

        {/* FIRMAS — compact */}
        <div className="grid grid-cols-2 gap-4 mt-4 print-keep-together">
          <div className="text-center">
            <div className="border-b-2 border-slate-300 h-14 mb-1"></div>
            <p className="text-[9px] font-semibold text-slate-600 uppercase">Firma del operario</p>
            <p className="text-[9px] text-slate-500">{parte.tecnico || "—"}</p>
          </div>
          <div className="text-center">
            <div className="border-b-2 border-slate-300 h-14 mb-1"></div>
            <p className="text-[9px] font-semibold text-slate-600 uppercase">Conformidad del cliente</p>
            <p className="text-[9px] text-slate-500">{parte.cliente}</p>
          </div>
        </div>

        {/* TEXTO LEGAL */}
        <div className="border-t border-slate-200 pt-2 mt-2">
          <p className="text-[8px] text-slate-400 leading-tight">Conforme con los trabajos realizados. Protección de datos: los datos serán tratados para gestionar la relación contractual.</p>
        </div>
      </div>
    </div>
  );
}
