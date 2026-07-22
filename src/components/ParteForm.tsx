"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader2, CheckCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { showToast } from "@/components/Toast";
import { CATALOGO_TRABAJOS, UNIDADES_TRABAJO } from "@/lib/catalogo-trabajos";
import { CATALOGO_MATERIALES, UNIDADES_MATERIAL } from "@/lib/catalogo-materiales";

export interface TrabajoLine {
  id: string;
  nombre_trabajo: string;
  hora: string;
  descripcion: string;
  cantidad: string;
  unidad: string;
  precio_unitario: string;
  estado: string;
}

export interface MaterialLine {
  id: string;
  nombre_material: string;
  referencia: string;
  descripcion: string;
  cantidad: string;
  unidad: string;
  precio_coste: string;
  precio_unitario: string;
}

export interface ParteFormData {
  fecha: string;
  tecnico: string;
  horaInicio: string;
  horaFin: string;
  cliente: string;
  client_id: string;
  direccion: string;
  observaciones: string;
  estado: string;
  iva_rate: string;
  descuento: string;
  budget_id: string;
  visit_id: string;
}

interface ParteFormProps {
  /** If provided, we're editing an existing parte */
  parteId?: string;
  initialData?: ParteFormData;
  initialTrabajos?: TrabajoLine[];
  initialMateriales?: MaterialLine[];
  onSaved?: (id: string) => void;
}

function createEmptyTrabajo(idx: number): TrabajoLine {
  return { id: `t${idx}_${Date.now()}`, nombre_trabajo: "", hora: "", descripcion: "", cantidad: "", unidad: "unidad", precio_unitario: "", estado: "completado" };
}

function createEmptyMaterial(idx: number): MaterialLine {
  return { id: `m${idx}_${Date.now()}`, nombre_material: "", referencia: "", descripcion: "", cantidad: "", unidad: "unidad", precio_coste: "", precio_unitario: "" };
}

function generateInitialTrabajos(): TrabajoLine[] {
  return Array.from({ length: 20 }, (_, i) => createEmptyTrabajo(i));
}

function generateInitialMateriales(): MaterialLine[] {
  return Array.from({ length: 20 }, (_, i) => createEmptyMaterial(i));
}

export default function ParteForm({ parteId, initialData, initialTrabajos, initialMateriales, onSaved }: ParteFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"trabajos" | "materiales">("trabajos");
  const isEditing = !!parteId;

  const [form, setForm] = useState<ParteFormData>(initialData || {
    fecha: new Date().toISOString().split("T")[0],
    tecnico: "Iván Martín",
    horaInicio: "",
    horaFin: "",
    cliente: "",
    client_id: "",
    direccion: "",
    observaciones: "",
    estado: "borrador",
    iva_rate: "21",
    descuento: "0",
    budget_id: "",
    visit_id: "",
  });

  const [trabajos, setTrabajos] = useState<TrabajoLine[]>(initialTrabajos || generateInitialTrabajos);
  const [materiales, setMateriales] = useState<MaterialLine[]>(initialMateriales || generateInitialMateriales);

  // Auto-fill from query params (only for new partes)
  const autoFillFromParams = useCallback(async () => {
    if (isEditing) return;
    const clientId = searchParams.get("client_id");
    const budgetId = searchParams.get("budget_id");
    const visitId = searchParams.get("visit_id");

    if (clientId) {
      try {
        const res = await fetch(`/api/clients/${clientId}`);
        if (res.ok) {
          const client = await res.json();
          setForm((prev) => ({
            ...prev,
            client_id: clientId,
            cliente: client.name || "",
            direccion: prev.direccion || client.address || "",
          }));
        }
      } catch { /* user fills manually */ }
    }
    if (budgetId) setForm((prev) => ({ ...prev, budget_id: budgetId }));
    if (visitId) {
      try {
        const res = await fetch(`/api/visits/${visitId}`);
        if (res.ok) {
          const visit = await res.json();
          setForm((prev) => ({
            ...prev,
            visit_id: visitId,
            direccion: prev.direccion || visit.address || "",
            observaciones: prev.observaciones || visit.notes || "",
            ...(visit.date ? { fecha: visit.date } : {}),
          }));
        }
      } catch { /* user fills manually */ }
    }
  }, [searchParams, isEditing]);

  useEffect(() => { autoFillFromParams(); }, [autoFillFromParams]);

  const updateForm = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  // --- Trabajo line handlers ---
  const updateTrabajo = (id: string, field: string, value: string) => {
    setTrabajos((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const selectTrabajoCatalog = (id: string, catalogId: string) => {
    const cat = CATALOGO_TRABAJOS.find((c) => c.id === catalogId);
    if (!cat) return;
    setTrabajos((prev) => prev.map((t) =>
      t.id === id ? {
        ...t,
        nombre_trabajo: cat.nombre,
        descripcion: cat.descripcion,
        unidad: cat.unidad,
        precio_unitario: cat.precioUnitario > 0 ? String(cat.precioUnitario) : "",
      } : t
    ));
  };

  const addTrabajo = () => setTrabajos((prev) => [...prev, createEmptyTrabajo(prev.length)]);

  const clearTrabajo = (id: string) => {
    setTrabajos((prev) => prev.map((t) =>
      t.id === id ? { ...t, nombre_trabajo: "", hora: "", descripcion: "", cantidad: "", unidad: "unidad", precio_unitario: "", estado: "completado" } : t
    ));
  };

  // --- Material line handlers ---
  const updateMaterial = (id: string, field: string, value: string) => {
    setMateriales((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const selectMaterialCatalog = (id: string, catalogId: string) => {
    const cat = CATALOGO_MATERIALES.find((c) => c.id === catalogId);
    if (!cat) return;
    setMateriales((prev) => prev.map((m) =>
      m.id === id ? {
        ...m,
        nombre_material: cat.nombre,
        descripcion: cat.descripcion,
        unidad: cat.unidad,
        precio_unitario: cat.precioVenta > 0 ? String(cat.precioVenta) : "",
        precio_coste: cat.precioCoste > 0 ? String(cat.precioCoste) : "",
      } : m
    ));
  };

  const addMaterial = () => setMateriales((prev) => [...prev, createEmptyMaterial(prev.length)]);

  const clearMaterial = (id: string) => {
    setMateriales((prev) => prev.map((m) =>
      m.id === id ? { ...m, nombre_material: "", referencia: "", descripcion: "", cantidad: "", unidad: "unidad", precio_coste: "", precio_unitario: "" } : m
    ));
  };

  // --- Calculations ---
  const calcLineImporte = (cantidad: string, precio: string) => {
    const c = parseFloat(cantidad) || 0;
    const p = parseFloat(precio) || 0;
    return c * p;
  };

  const subtotalTrabajos = trabajos.reduce(
    (sum, t) => sum + calcLineImporte(t.cantidad, t.precio_unitario), 0
  );

  // Total hours: sum all trabajo quantities (this section is mano de obra)
  const totalHorasTrabajo = trabajos.reduce((sum, t) => {
    const cantidad = typeof t.cantidad === "string"
      ? Number(t.cantidad.replace(",", "."))
      : Number(t.cantidad || 0);
    return sum + (Number.isFinite(cantidad) ? cantidad : 0);
  }, 0);
  const totalHorasTrabajoLabel = Number.isInteger(totalHorasTrabajo)
    ? String(totalHorasTrabajo)
    : String(parseFloat(totalHorasTrabajo.toFixed(2)));

  const subtotalMateriales = materiales.reduce(
    (sum, m) => sum + calcLineImporte(m.cantidad, m.precio_unitario), 0
  );

  const descuentoNum = parseFloat(form.descuento) || 0;
  const baseImponible = subtotalTrabajos + subtotalMateriales - descuentoNum;
  const ivaRate = parseFloat(form.iva_rate) || 21;
  const ivaAmount = baseImponible * (ivaRate / 100);
  const totalParte = baseImponible + ivaAmount;

  // --- Submit ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.cliente.trim()) { showToast("error", "El cliente es obligatorio"); return; }

    setSubmitting(true);
    try {
      const payload = {
        fecha: form.fecha,
        tecnico: form.tecnico,
        horaInicio: form.horaInicio,
        horaFin: form.horaFin,
        cliente: form.cliente,
        client_id: form.client_id || null,
        direccion: form.direccion,
        observaciones: form.observaciones,
        estado: form.estado,
        iva_rate: parseFloat(form.iva_rate) || 21,
        descuento: parseFloat(form.descuento) || 0,
        budget_id: form.budget_id || null,
        visit_id: form.visit_id || null,
        trabajos: trabajos
          .filter((t) => t.descripcion.trim() || t.nombre_trabajo.trim())
          .map((t, i) => ({ ...t, sort_order: i })),
        materiales: materiales
          .filter((m) => m.descripcion.trim() || m.nombre_material.trim())
          .map((m, i) => ({ ...m, sort_order: i })),
      };

      const url = isEditing ? `/api/partes-trabajo/${parteId}` : "/api/partes-trabajo";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Error desconocido" }));
        showToast("error", data.error || "Error al guardar el parte");
        setSubmitting(false);
        return;
      }

      const saved = await res.json();
      const savedId = saved.id || parteId;
      showToast("success", isEditing ? "Parte actualizado correctamente" : `Parte ${saved.numero} guardado correctamente`);

      if (onSaved) {
        onSaved(savedId);
      } else {
        router.push(`/partes-trabajo/${savedId}`);
      }
    } catch {
      showToast("error", "Error de conexión. El parte no se ha guardado.");
      setSubmitting(false);
    }
  };

  // --- Render ---
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Datos generales */}
      <div className="card-static">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Datos generales</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Fecha *</label>
            <input type="date" required value={form.fecha} onChange={(e) => updateForm("fecha", e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Operario</label>
            <input type="text" value={form.tecnico} onChange={(e) => updateForm("tecnico", e.target.value)} className="input-field" placeholder="Nombre del operario" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Hora inicio</label>
            <input type="time" value={form.horaInicio} onChange={(e) => updateForm("horaInicio", e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Hora fin</label>
            <input type="time" value={form.horaFin} onChange={(e) => updateForm("horaFin", e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Estado</label>
            <select value={form.estado} onChange={(e) => updateForm("estado", e.target.value)} className="input-field">
              <option value="borrador">Borrador</option>
              <option value="firmado">Firmado</option>
              <option value="cerrado">Cerrado</option>
            </select>
          </div>
        </div>
      </div>

      {/* Datos del cliente */}
      <div className="card-static">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Datos del cliente</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Cliente *</label>
            <input type="text" required value={form.cliente} onChange={(e) => updateForm("cliente", e.target.value)} className="input-field" placeholder="Nombre o razón social" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Dirección</label>
            <input type="text" value={form.direccion} onChange={(e) => updateForm("direccion", e.target.value)} className="input-field" placeholder="Dirección del trabajo" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card-static !p-0 overflow-hidden">
        <div className="flex border-b border-slate-200">
          <button type="button" onClick={() => setActiveTab("trabajos")}
            className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${activeTab === "trabajos" ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600" : "text-slate-600 hover:bg-slate-50"}`}>
            Trabajos / Mano de obra
            {subtotalTrabajos > 0 && <span className="ml-2 text-xs font-normal">({subtotalTrabajos.toFixed(2)} €)</span>}
          </button>
          <button type="button" onClick={() => setActiveTab("materiales")}
            className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${activeTab === "materiales" ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600" : "text-slate-600 hover:bg-slate-50"}`}>
            Materiales
            {subtotalMateriales > 0 && <span className="ml-2 text-xs font-normal">({subtotalMateriales.toFixed(2)} €)</span>}
          </button>
        </div>

        {/* Tab: Trabajos */}
        {activeTab === "trabajos" && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">Trabajos realizados</h3>
              <button type="button" onClick={addTrabajo} className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 transition-colors">
                <Plus className="h-3.5 w-3.5" /> Añadir fila de trabajo
              </button>
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs border border-slate-200 rounded-lg">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-2 py-2 text-left w-8">#</th>
                    <th className="px-2 py-2 text-left w-44">Trabajo</th>
                    <th className="px-2 py-2 text-left">Descripción</th>
                    <th className="px-2 py-2 text-center w-16">Cant.</th>
                    <th className="px-2 py-2 text-center w-20">Unidad</th>
                    <th className="px-2 py-2 text-right w-20">Precio</th>
                    <th className="px-2 py-2 text-right w-20">Importe</th>
                    <th className="px-2 py-2 text-center w-16">Estado</th>
                    <th className="px-2 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {trabajos.map((t, idx) => {
                    const importe = calcLineImporte(t.cantidad, t.precio_unitario);
                    return (
                      <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-2 py-1.5 text-slate-400 text-center">{idx + 1}</td>
                        <td className="px-1 py-1.5">
                          <select value={t.nombre_trabajo ? CATALOGO_TRABAJOS.find(c => c.nombre === t.nombre_trabajo)?.id || "" : ""}
                            onChange={(e) => { if (e.target.value) selectTrabajoCatalog(t.id, e.target.value); }}
                            className="input-field !py-1 text-xs w-full">
                            <option value="">Seleccionar...</option>
                            {CATALOGO_TRABAJOS.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                          </select>
                        </td>
                        <td className="px-1 py-1.5">
                          <input type="text" value={t.descripcion} onChange={(e) => updateTrabajo(t.id, "descripcion", e.target.value)} className="input-field !py-1 text-xs w-full" placeholder="Descripción del trabajo" />
                        </td>
                        <td className="px-1 py-1.5">
                          <input type="number" min="0" step="0.5" value={t.cantidad} onChange={(e) => updateTrabajo(t.id, "cantidad", e.target.value)} className="input-field !py-1 text-xs text-center w-full" placeholder="0" />
                        </td>
                        <td className="px-1 py-1.5">
                          <select value={t.unidad} onChange={(e) => updateTrabajo(t.id, "unidad", e.target.value)} className="input-field !py-1 text-xs w-full">
                            {UNIDADES_TRABAJO.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                          </select>
                        </td>
                        <td className="px-1 py-1.5">
                          <input type="number" min="0" step="0.01" value={t.precio_unitario} onChange={(e) => updateTrabajo(t.id, "precio_unitario", e.target.value)} className="input-field !py-1 text-xs text-right w-full" placeholder="0.00" />
                        </td>
                        <td className="px-2 py-1.5 text-right font-medium text-slate-700">{importe > 0 ? importe.toFixed(2) : ""}</td>
                        <td className="px-1 py-1.5">
                          <select value={t.estado} onChange={(e) => updateTrabajo(t.id, "estado", e.target.value)} className="input-field !py-1 text-xs w-full">
                            <option value="completado">OK</option>
                            <option value="pendiente">Pend.</option>
                            <option value="en_curso">Curso</option>
                          </select>
                        </td>
                        <td className="px-1 py-1.5 text-center">
                          <button type="button" onClick={() => clearTrabajo(t.id)} className="p-1 text-slate-400 hover:text-red-500" title="Limpiar fila">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-300">
                    <td colSpan={6} className="px-2 py-2 text-right text-xs font-semibold text-slate-700">Subtotal mano de obra:</td>
                    <td className="px-2 py-2 text-right text-sm font-bold text-slate-900">{subtotalTrabajos.toFixed(2)} €</td>
                    <td colSpan={2}></td>
                  </tr>
                  {totalHorasTrabajo > 0 && (
                    <tr className="bg-slate-50">
                      <td colSpan={6} className="px-2 py-1.5 text-right text-xs font-semibold text-slate-700">Total horas de trabajo:</td>
                      <td className="px-2 py-1.5 text-right text-sm font-bold text-slate-900">{totalHorasTrabajoLabel} h</td>
                      <td colSpan={2}></td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>

            {/* Mobile cards - Trabajos */}
            <div className="md:hidden space-y-3">
              {trabajos.map((t, idx) => {
                const importe = calcLineImporte(t.cantidad, t.precio_unitario);
                return (
                  <div key={t.id} className="border border-slate-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500">#{idx + 1}</span>
                      <button type="button" onClick={() => clearTrabajo(t.id)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                    <select value={t.nombre_trabajo ? CATALOGO_TRABAJOS.find(c => c.nombre === t.nombre_trabajo)?.id || "" : ""}
                      onChange={(e) => { if (e.target.value) selectTrabajoCatalog(t.id, e.target.value); }}
                      className="input-field text-sm w-full">
                      <option value="">Seleccionar trabajo...</option>
                      {CATALOGO_TRABAJOS.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                    <input type="text" value={t.descripcion} onChange={(e) => updateTrabajo(t.id, "descripcion", e.target.value)} className="input-field text-sm w-full" placeholder="Descripción" />
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-slate-500">Cant.</label>
                        <input type="number" min="0" step="0.5" value={t.cantidad} onChange={(e) => updateTrabajo(t.id, "cantidad", e.target.value)} className="input-field text-sm text-center" placeholder="0" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">Unidad</label>
                        <select value={t.unidad} onChange={(e) => updateTrabajo(t.id, "unidad", e.target.value)} className="input-field text-sm">
                          {UNIDADES_TRABAJO.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">Precio</label>
                        <input type="number" min="0" step="0.01" value={t.precio_unitario} onChange={(e) => updateTrabajo(t.id, "precio_unitario", e.target.value)} className="input-field text-sm text-right" placeholder="0.00" />
                      </div>
                    </div>
                    {importe > 0 && <p className="text-right text-sm font-semibold text-slate-800">Importe: {importe.toFixed(2)} €</p>}
                  </div>
                );
              })}
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                <button type="button" onClick={addTrabajo} className="inline-flex items-center gap-1 text-sm font-medium text-blue-700"><Plus className="h-4 w-4" /> Añadir fila</button>
                <div className="text-right">
                  <span className="text-sm font-bold text-slate-900">Subtotal: {subtotalTrabajos.toFixed(2)} €</span>
                  {totalHorasTrabajo > 0 && (
                    <p className="text-xs font-semibold text-slate-700">Total horas: {totalHorasTrabajoLabel} h</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Materiales */}
        {activeTab === "materiales" && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">Materiales utilizados</h3>
              <button type="button" onClick={addMaterial} className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 transition-colors">
                <Plus className="h-3.5 w-3.5" /> Añadir fila de material
              </button>
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs border border-slate-200 rounded-lg">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-2 py-2 text-left w-8">#</th>
                    <th className="px-2 py-2 text-left w-40">Material</th>
                    <th className="px-2 py-2 text-left">Descripción / Referencia</th>
                    <th className="px-2 py-2 text-center w-16">Cant.</th>
                    <th className="px-2 py-2 text-center w-20">Unidad</th>
                    <th className="px-2 py-2 text-right w-20">P. Venta</th>
                    <th className="px-2 py-2 text-right w-20">Importe</th>
                    <th className="px-2 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {materiales.map((m, idx) => {
                    const importe = calcLineImporte(m.cantidad, m.precio_unitario);
                    return (
                      <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-2 py-1.5 text-slate-400 text-center">{idx + 1}</td>
                        <td className="px-1 py-1.5">
                          <select value={m.nombre_material ? CATALOGO_MATERIALES.find(c => c.nombre === m.nombre_material)?.id || "" : ""}
                            onChange={(e) => { if (e.target.value) selectMaterialCatalog(m.id, e.target.value); }}
                            className="input-field !py-1 text-xs w-full">
                            <option value="">Seleccionar...</option>
                            {CATALOGO_MATERIALES.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                          </select>
                        </td>
                        <td className="px-1 py-1.5">
                          <input type="text" value={m.descripcion} onChange={(e) => updateMaterial(m.id, "descripcion", e.target.value)} className="input-field !py-1 text-xs w-full" placeholder="Descripción o referencia" />
                        </td>
                        <td className="px-1 py-1.5">
                          <input type="number" min="0" step="1" value={m.cantidad} onChange={(e) => updateMaterial(m.id, "cantidad", e.target.value)} className="input-field !py-1 text-xs text-center w-full" placeholder="0" />
                        </td>
                        <td className="px-1 py-1.5">
                          <select value={m.unidad} onChange={(e) => updateMaterial(m.id, "unidad", e.target.value)} className="input-field !py-1 text-xs w-full">
                            {UNIDADES_MATERIAL.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                          </select>
                        </td>
                        <td className="px-1 py-1.5">
                          <input type="number" min="0" step="0.01" value={m.precio_unitario} onChange={(e) => updateMaterial(m.id, "precio_unitario", e.target.value)} className="input-field !py-1 text-xs text-right w-full" placeholder="0.00" />
                        </td>
                        <td className="px-2 py-1.5 text-right font-medium text-slate-700">{importe > 0 ? importe.toFixed(2) : ""}</td>
                        <td className="px-1 py-1.5 text-center">
                          <button type="button" onClick={() => clearMaterial(m.id)} className="p-1 text-slate-400 hover:text-red-500" title="Limpiar fila">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-300">
                    <td colSpan={6} className="px-2 py-2 text-right text-xs font-semibold text-slate-700">Subtotal materiales:</td>
                    <td className="px-2 py-2 text-right text-sm font-bold text-slate-900">{subtotalMateriales.toFixed(2)} €</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile cards - Materiales */}
            <div className="md:hidden space-y-3">
              {materiales.map((m, idx) => {
                const importe = calcLineImporte(m.cantidad, m.precio_unitario);
                return (
                  <div key={m.id} className="border border-slate-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500">#{idx + 1}</span>
                      <button type="button" onClick={() => clearMaterial(m.id)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                    <select value={m.nombre_material ? CATALOGO_MATERIALES.find(c => c.nombre === m.nombre_material)?.id || "" : ""}
                      onChange={(e) => { if (e.target.value) selectMaterialCatalog(m.id, e.target.value); }}
                      className="input-field text-sm w-full">
                      <option value="">Seleccionar material...</option>
                      {CATALOGO_MATERIALES.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                    <input type="text" value={m.descripcion} onChange={(e) => updateMaterial(m.id, "descripcion", e.target.value)} className="input-field text-sm w-full" placeholder="Descripción o referencia" />
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-slate-500">Cant.</label>
                        <input type="number" min="0" step="1" value={m.cantidad} onChange={(e) => updateMaterial(m.id, "cantidad", e.target.value)} className="input-field text-sm text-center" placeholder="0" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">Unidad</label>
                        <select value={m.unidad} onChange={(e) => updateMaterial(m.id, "unidad", e.target.value)} className="input-field text-sm">
                          {UNIDADES_MATERIAL.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">P. Venta</label>
                        <input type="number" min="0" step="0.01" value={m.precio_unitario} onChange={(e) => updateMaterial(m.id, "precio_unitario", e.target.value)} className="input-field text-sm text-right" placeholder="0.00" />
                      </div>
                    </div>
                    {importe > 0 && <p className="text-right text-sm font-semibold text-slate-800">Importe: {importe.toFixed(2)} €</p>}
                  </div>
                );
              })}
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                <button type="button" onClick={addMaterial} className="inline-flex items-center gap-1 text-sm font-medium text-blue-700"><Plus className="h-4 w-4" /> Añadir fila</button>
                <span className="text-sm font-bold text-slate-900">Subtotal: {subtotalMateriales.toFixed(2)} €</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Resumen económico */}
      <div className="card-static">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Resumen económico</h2>
        <div className="max-w-sm ml-auto space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Subtotal mano de obra</span>
            <span className="font-medium">{subtotalTrabajos.toFixed(2)} €</span>
          </div>
          {totalHorasTrabajo > 0 && (
            <div className="flex justify-between font-semibold">
              <span className="text-slate-700">Total horas de trabajo</span>
              <span>{totalHorasTrabajoLabel} h</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-600">Subtotal materiales</span>
            <span className="font-medium">{subtotalMateriales.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-600">Descuento</span>
            <div className="flex items-center gap-1">
              <input type="number" min="0" step="0.01" value={form.descuento} onChange={(e) => updateForm("descuento", e.target.value)}
                className="input-field !py-1 text-xs text-right w-20" placeholder="0.00" />
              <span className="text-xs text-slate-500">€</span>
            </div>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2">
            <span className="text-slate-700 font-medium">Base imponible</span>
            <span className="font-semibold">{baseImponible.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-600">IVA</span>
            <div className="flex items-center gap-1">
              <select value={form.iva_rate} onChange={(e) => updateForm("iva_rate", e.target.value)} className="input-field !py-1 text-xs w-16">
                <option value="21">21%</option>
                <option value="10">10%</option>
                <option value="4">4%</option>
                <option value="0">0%</option>
              </select>
              <span className="text-sm font-medium w-20 text-right">{ivaAmount.toFixed(2)} €</span>
            </div>
          </div>
          <div className="flex justify-between border-t-2 border-slate-800 pt-2">
            <span className="text-slate-900 font-bold">Total parte</span>
            <span className="text-lg font-bold text-slate-900">{totalParte.toFixed(2)} €</span>
          </div>
        </div>
      </div>

      {/* Observaciones */}
      <div className="card-static">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Observaciones</h2>
        <textarea value={form.observaciones} onChange={(e) => updateForm("observaciones", e.target.value)} rows={3} className="input-field" placeholder="Notas adicionales, incidencias, recomendaciones al cliente..." />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>) : (<><CheckCircle className="h-4 w-4" /> {isEditing ? "Guardar cambios" : "Guardar parte"}</>)}
        </button>
      </div>
    </form>
  );
}
