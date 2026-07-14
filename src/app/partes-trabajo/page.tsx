"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, ClipboardCheck, Eye, Search } from "lucide-react";

interface ParteTrabajo {
  id: string;
  numero: string;
  fecha: string;
  cliente: string;
  tecnico: string;
  estado: "borrador" | "firmado" | "cerrado";
}

const ESTADO_COLORS: Record<string, string> = {
  borrador: "bg-amber-50 text-amber-700 border-amber-100",
  firmado: "bg-blue-50 text-blue-700 border-blue-100",
  cerrado: "bg-emerald-50 text-emerald-700 border-emerald-100",
};

const PARTES_DEMO: ParteTrabajo[] = [
  {
    id: "pt-001",
    numero: "PT-2025-001",
    fecha: "2025-07-10",
    cliente: "Comunidad Prop. C/ Autonomía 14",
    tecnico: "Iván Martín",
    estado: "cerrado",
  },
  {
    id: "pt-002",
    numero: "PT-2025-002",
    fecha: "2025-07-11",
    cliente: "Bar Restaurante Zubialde",
    tecnico: "Iván Martín",
    estado: "firmado",
  },
  {
    id: "pt-003",
    numero: "PT-2025-003",
    fecha: "2025-07-14",
    cliente: "Talleres Mecánicos Eibar S.L.",
    tecnico: "Iván Martín",
    estado: "borrador",
  },
  {
    id: "pt-004",
    numero: "PT-2025-004",
    fecha: "2025-07-14",
    cliente: "María López García",
    tecnico: "Iván Martín",
    estado: "borrador",
  },
];

export default function PartesTrabajoPage() {
  const [search, setSearch] = useState("");

  const filtered = PARTES_DEMO.filter(
    (p) =>
      p.numero.toLowerCase().includes(search.toLowerCase()) ||
      p.cliente.toLowerCase().includes(search.toLowerCase()) ||
      p.tecnico.toLowerCase().includes(search.toLowerCase())
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

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">Partes de trabajo</h1>
          <p className="page-subtitle">{filtered.length} partes registrados</p>
        </div>
        <Link href="/partes-trabajo/nuevo" className="btn-primary">
          <Plus className="h-4 w-4" />
          Nuevo parte
        </Link>
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

      {/* Table */}
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
                    <span className="text-xs text-slate-600">{parte.tecnico}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs font-medium rounded-full px-2.5 py-1 border ${ESTADO_COLORS[parte.estado]}`}>
                      {parte.estado.charAt(0).toUpperCase() + parte.estado.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <Link
                      href={`/partes-trabajo/${parte.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Ver
                    </Link>
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
    </div>
  );
}
