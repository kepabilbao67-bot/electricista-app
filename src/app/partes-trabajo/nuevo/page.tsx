"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { showToast } from "@/components/Toast";

interface MaterialLine {
  id: string;
  referencia: string;
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
}

interface TrabajoLine {
  id: string;
  hora: string;
  descripcion: string;
  estado: string;
}

export default function NuevoParteTrabajoPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    numero: "PT-2025-005",
    fecha: new Date().toISOString().split("T")[0],
    tecnico: "Iván Martín",
    horaInicio: "",
    horaFin: "",
    cliente: "",
    direccion: "",
    telefono: "",
    personaContacto: "",
    observaciones: "",
  });

  const [trabajos, setTrabajos] = useState<TrabajoLine[]>([
    { id: "t1", hora: "", descripcion: "", estado: "completado" },
  ]);

  const [materiales, setMateriales] = useState<MaterialLine[]>([
    { id: "m1", referencia: "", descripcion: "", cantidad: "1", precioUnitario: "" },
  ]);

  const updateForm = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addTrabajo = () => {
    setTrabajos((prev) => [
      ...prev,
      { id: `t${Date.now()}`, hora: "", descripcion: "", estado: "completado" },
    ]);
  };

  const removeTrabajo = (id: string) => {
    if (trabajos.length > 1) {
      setTrabajos((prev) => prev.filter((t) => t.id !== id));
    }
  };

  const updateTrabajo = (id: string, field: string, value: string) => {
    setTrabajos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const addMaterial = () => {
    setMateriales((prev) => [
      ...prev,
      { id: `m${Date.now()}`, referencia: "", descripcion: "", cantidad: "1", precioUnitario: "" },
    ]);
  };

  const removeMaterial = (id: string) => {
    if (materiales.length > 1) {
      setMateriales((prev) => prev.filter((m) => m.id !== id));
    }
  };

  const updateMaterial = (id: string, field: string, value: string) => {
    setMateriales((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    if (!form.cliente.trim()) {
      showToast("error", "El cliente es obligatorio");
      setSubmitting(false);
      return;
    }

    // Demo: simula guardado y redirige a vista del parte
    setTimeout(() => {
      showToast("success", "Parte de trabajo guardado correctamente");
      router.push("/partes-trabajo/pt-001");
    }, 500);
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/partes-trabajo"
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="page-title">Nuevo parte de trabajo</h1>
          <p className="page-subtitle">Registra una intervención eléctrica</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos generales */}
        <div className="card-static">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Datos generales</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nº Parte</label>
              <input
                type="text"
                value={form.numero}
                onChange={(e) => updateForm("numero", e.target.value)}
                className="input-field"
                placeholder="PT-2025-XXX"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Fecha *</label>
              <input
                type="date"
                required
                value={form.fecha}
                onChange={(e) => updateForm("fecha", e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Técnico / Operario</label>
              <input
                type="text"
                value={form.tecnico}
                onChange={(e) => updateForm("tecnico", e.target.value)}
                className="input-field"
                placeholder="Nombre del técnico"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Hora inicio</label>
                <input
                  type="time"
                  value={form.horaInicio}
                  onChange={(e) => updateForm("horaInicio", e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Hora fin</label>
                <input
                  type="time"
                  value={form.horaFin}
                  onChange={(e) => updateForm("horaFin", e.target.value)}
                  className="input-field"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Datos del cliente */}
        <div className="card-static">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Datos del cliente</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Cliente *</label>
              <input
                type="text"
                required
                value={form.cliente}
                onChange={(e) => updateForm("cliente", e.target.value)}
                className="input-field"
                placeholder="Nombre o razón social"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Persona de contacto</label>
              <input
                type="text"
                value={form.personaContacto}
                onChange={(e) => updateForm("personaContacto", e.target.value)}
                className="input-field"
                placeholder="Persona que atiende"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Dirección</label>
              <input
                type="text"
                value={form.direccion}
                onChange={(e) => updateForm("direccion", e.target.value)}
                className="input-field"
                placeholder="Dirección del trabajo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Teléfono</label>
              <input
                type="tel"
                value={form.telefono}
                onChange={(e) => updateForm("telefono", e.target.value)}
                className="input-field"
                placeholder="Teléfono de contacto"
              />
            </div>
          </div>
        </div>

        {/* Trabajos realizados */}
        <div className="card-static">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">Trabajos realizados</h2>
            <button
              type="button"
              onClick={addTrabajo}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Añadir línea
            </button>
          </div>
          <div className="space-y-3">
            {trabajos.map((t, idx) => (
              <div key={t.id} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-2">
                  {idx === 0 && <label className="block text-xs font-medium text-slate-500 mb-1">Hora/Ref</label>}
                  <input
                    type="text"
                    value={t.hora}
                    onChange={(e) => updateTrabajo(t.id, "hora", e.target.value)}
                    className="input-field text-xs"
                    placeholder="09:00"
                  />
                </div>
                <div className="col-span-7">
                  {idx === 0 && <label className="block text-xs font-medium text-slate-500 mb-1">Descripción del servicio / tarea realizada</label>}
                  <input
                    type="text"
                    value={t.descripcion}
                    onChange={(e) => updateTrabajo(t.id, "descripcion", e.target.value)}
                    className="input-field text-xs"
                    placeholder="Revisión de cuadro eléctrico, sustitución de diferencial..."
                  />
                </div>
                <div className="col-span-2">
                  {idx === 0 && <label className="block text-xs font-medium text-slate-500 mb-1">Estado</label>}
                  <select
                    value={t.estado}
                    onChange={(e) => updateTrabajo(t.id, "estado", e.target.value)}
                    className="input-field text-xs"
                  >
                    <option value="completado">Completado</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="en_curso">En curso</option>
                  </select>
                </div>
                <div className="col-span-1 flex items-end">
                  {idx === 0 && <label className="block text-xs font-medium text-transparent mb-1">X</label>}
                  <button
                    type="button"
                    onClick={() => removeTrabajo(t.id)}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    disabled={trabajos.length <= 1}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Materiales utilizados */}
        <div className="card-static">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">Materiales y repuestos</h2>
            <button
              type="button"
              onClick={addMaterial}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Añadir material
            </button>
          </div>
          <div className="space-y-3">
            {materiales.map((m, idx) => (
              <div key={m.id} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-2">
                  {idx === 0 && <label className="block text-xs font-medium text-slate-500 mb-1">Referencia</label>}
                  <input
                    type="text"
                    value={m.referencia}
                    onChange={(e) => updateMaterial(m.id, "referencia", e.target.value)}
                    className="input-field text-xs"
                    placeholder="REF-001"
                  />
                </div>
                <div className="col-span-5">
                  {idx === 0 && <label className="block text-xs font-medium text-slate-500 mb-1">Descripción del material</label>}
                  <input
                    type="text"
                    value={m.descripcion}
                    onChange={(e) => updateMaterial(m.id, "descripcion", e.target.value)}
                    className="input-field text-xs"
                    placeholder="Diferencial 40A 30mA, cable 2.5mm²..."
                  />
                </div>
                <div className="col-span-2">
                  {idx === 0 && <label className="block text-xs font-medium text-slate-500 mb-1">Cantidad</label>}
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={m.cantidad}
                    onChange={(e) => updateMaterial(m.id, "cantidad", e.target.value)}
                    className="input-field text-xs"
                  />
                </div>
                <div className="col-span-2">
                  {idx === 0 && <label className="block text-xs font-medium text-slate-500 mb-1">P. Unitario</label>}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={m.precioUnitario}
                    onChange={(e) => updateMaterial(m.id, "precioUnitario", e.target.value)}
                    className="input-field text-xs"
                    placeholder="0.00"
                  />
                </div>
                <div className="col-span-1 flex items-end">
                  {idx === 0 && <label className="block text-xs font-medium text-transparent mb-1">X</label>}
                  <button
                    type="button"
                    onClick={() => removeMaterial(m.id)}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    disabled={materiales.length <= 1}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Observaciones */}
        <div className="card-static">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Observaciones</h2>
          <textarea
            value={form.observaciones}
            onChange={(e) => updateForm("observaciones", e.target.value)}
            rows={3}
            className="input-field"
            placeholder="Notas adicionales, incidencias, recomendaciones al cliente..."
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button type="submit" disabled={submitting} className="btn-primary">
            <Save className="h-4 w-4" />
            {submitting ? "Guardando..." : "Guardar parte"}
          </button>
          <Link href="/partes-trabajo" className="btn-secondary">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
