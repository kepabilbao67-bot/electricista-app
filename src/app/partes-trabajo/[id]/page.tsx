"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

/* ─── Demo data (matches the list in /partes-trabajo) ─── */
const PARTES_DEMO: Record<string, {
  numero: string;
  fecha: string;
  tecnico: string;
  horaInicio: string;
  horaFin: string;
  cliente: string;
  direccion: string;
  telefono: string;
  personaContacto: string;
  trabajos: { hora: string; descripcion: string; estado: string }[];
  materiales: { referencia: string; descripcion: string; cantidad: number; precioUnitario: number }[];
  observaciones: string;
  estado: string;
}> = {
  "pt-001": {
    numero: "PT-2025-001",
    fecha: "2025-07-10",
    tecnico: "Iván Martín",
    horaInicio: "09:00",
    horaFin: "12:30",
    cliente: "Comunidad Prop. C/ Autonomía 14",
    direccion: "C/ Autonomía 14, 3º, Eibar",
    telefono: "943 123 456",
    personaContacto: "Pedro Gómez (Presidente)",
    trabajos: [
      { hora: "09:00", descripcion: "Revisión de cuadro general de protección en portal", estado: "Completado" },
      { hora: "10:15", descripcion: "Sustitución de diferencial 40A 30mA por fallo de disparo", estado: "Completado" },
      { hora: "11:00", descripcion: "Verificación de toma de tierra y medición de aislamiento", estado: "Completado" },
    ],
    materiales: [
      { referencia: "DIF-40-30", descripcion: "Diferencial Schneider 40A 30mA clase AC", cantidad: 1, precioUnitario: 48.50 },
      { referencia: "CAB-6-AV", descripcion: "Cable H07V-K 6mm² amarillo-verde (tierra)", cantidad: 5, precioUnitario: 1.85 },
      { referencia: "BOR-16", descripcion: "Bornas de conexión 16mm²", cantidad: 4, precioUnitario: 2.10 },
    ],
    observaciones: "Se recomienda revisión completa de la instalación comunitaria al superar los 25 años de antigüedad. Próxima ITC-BT-05 en 2026.",
    estado: "cerrado",
  },
  "pt-002": {
    numero: "PT-2025-002",
    fecha: "2025-07-11",
    tecnico: "Iván Martín",
    horaInicio: "16:00",
    horaFin: "18:00",
    cliente: "Bar Restaurante Zubialde",
    direccion: "Plaza del Mercado 7, Eibar",
    telefono: "943 987 654",
    personaContacto: "Ana Zubialde",
    trabajos: [
      { hora: "16:00", descripcion: "Instalación de línea independiente para horno industrial trifásico", estado: "Completado" },
      { hora: "17:00", descripcion: "Colocación de magnetotérmico 3P+N 32A y cableado", estado: "Completado" },
    ],
    materiales: [
      { referencia: "MAG-3P-32", descripcion: "Magnetotérmico 3P+N 32A curva C", cantidad: 1, precioUnitario: 62.00 },
      { referencia: "CAB-4-N", descripcion: "Cable RV-K 4x4mm² (15m)", cantidad: 1, precioUnitario: 67.50 },
      { referencia: "TUBO-25", descripcion: "Tubo corrugado libre halógenos 25mm (10m)", cantidad: 1, precioUnitario: 8.90 },
    ],
    observaciones: "Instalación conforme a REBT. Cliente solicita certificado de instalación para licencia de actividad.",
    estado: "firmado",
  },
  "pt-003": {
    numero: "PT-2025-003",
    fecha: "2025-07-14",
    tecnico: "Iván Martín",
    horaInicio: "08:30",
    horaFin: "11:00",
    cliente: "Talleres Mecánicos Eibar S.L.",
    direccion: "Polígono Azitain, Nave 12, Eibar",
    telefono: "943 456 789",
    personaContacto: "Mikel Arrizabalaga",
    trabajos: [
      { hora: "08:30", descripcion: "Diagnóstico de caída de tensión en línea de fuerza taller", estado: "Completado" },
      { hora: "09:30", descripcion: "Sustitución de bornas oxidadas en cuadro secundario", estado: "Pendiente" },
    ],
    materiales: [
      { referencia: "BOR-35", descripcion: "Bornas industriales 35mm²", cantidad: 6, precioUnitario: 4.50 },
    ],
    observaciones: "Pendiente presupuesto para renovación completa del cuadro secundario.",
    estado: "borrador",
  },
  "pt-004": {
    numero: "PT-2025-004",
    fecha: "2025-07-14",
    tecnico: "Iván Martín",
    horaInicio: "12:00",
    horaFin: "13:30",
    cliente: "María López García",
    direccion: "C/ Errebal 22, 1ºB, Eibar",
    telefono: "688 112 233",
    personaContacto: "María López",
    trabajos: [
      { hora: "12:00", descripcion: "Reparación de punto de luz en salón (interruptor y mecanismo)", estado: "Completado" },
      { hora: "12:45", descripcion: "Revisión de enchufes en cocina por chispeo", estado: "Completado" },
    ],
    materiales: [
      { referencia: "INT-SIM", descripcion: "Interruptor simple Simon 82 blanco", cantidad: 1, precioUnitario: 12.40 },
      { referencia: "BASE-SCH", descripcion: "Base enchufe Schuko con TT Simon 82", cantidad: 2, precioUnitario: 9.80 },
    ],
    observaciones: "Instalación doméstica en buen estado general. Se recomienda no sobrecargar regletas en cocina.",
    estado: "borrador",
  },
};

export default function ParteTrabajoDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const parte = PARTES_DEMO[id];

  if (!parte) {
    return (
      <div className="animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/partes-trabajo"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="page-title">Parte no encontrado</h1>
        </div>
        <p className="text-slate-500">El parte de trabajo solicitado no existe.</p>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const totalMateriales = parte.materiales.reduce(
    (sum, m) => sum + m.cantidad * m.precioUnitario,
    0
  );

  return (
    <div className="animate-fade-in">
      {/* Screen-only header */}
      <div className="flex items-center justify-between mb-6 no-print">
        <div className="flex items-center gap-3">
          <Link
            href="/partes-trabajo"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="page-title">{parte.numero}</h1>
            <p className="page-subtitle">Parte de trabajo — {parte.cliente}</p>
          </div>
        </div>
        <button onClick={handlePrint} className="btn-primary">
          <Printer className="h-4 w-4" />
          Imprimir / Guardar PDF
        </button>
      </div>

      {/* Printable document */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6 md:p-10 print:shadow-none print:border-none print:p-0 print:rounded-none max-w-4xl mx-auto">

        {/* ═══ CABECERA ═══ */}
        <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">AUTONOMO360</h2>
            <p className="text-sm text-slate-600 mt-1">Empresa de demostración</p>
            <p className="text-sm text-slate-600">Gestión profesional para electricistas</p>
          </div>
          <div className="text-right">
            <h3 className="text-lg font-bold text-slate-900 uppercase tracking-wide">Parte de Trabajo</h3>
            <p className="text-sm text-slate-600 mt-1">Nº Parte: <span className="font-semibold text-slate-900">{parte.numero}</span></p>
          </div>
        </div>

        {/* ═══ DATOS GENERALES ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-slate-50 rounded-lg print:bg-transparent print:border print:border-slate-300">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Fecha</p>
            <p className="text-sm font-medium text-slate-900">{formatDate(parte.fecha)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Técnico</p>
            <p className="text-sm font-medium text-slate-900">{parte.tecnico}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Hora inicio</p>
            <p className="text-sm font-medium text-slate-900">{parte.horaInicio}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Hora fin</p>
            <p className="text-sm font-medium text-slate-900">{parte.horaFin}</p>
          </div>
        </div>

        {/* ═══ DATOS DEL CLIENTE ═══ */}
        <div className="mb-6 p-4 border border-slate-200 rounded-lg">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Datos del cliente</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-slate-500">Cliente: </span>
              <span className="font-medium text-slate-900">{parte.cliente}</span>
            </div>
            <div>
              <span className="text-slate-500">Contacto: </span>
              <span className="font-medium text-slate-900">{parte.personaContacto}</span>
            </div>
            <div>
              <span className="text-slate-500">Dirección: </span>
              <span className="font-medium text-slate-900">{parte.direccion}</span>
            </div>
            <div>
              <span className="text-slate-500">Teléfono: </span>
              <span className="font-medium text-slate-900">{parte.telefono}</span>
            </div>
          </div>
        </div>

        {/* ═══ TRABAJOS REALIZADOS ═══ */}
        <div className="mb-6">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Trabajos realizados</h4>
          <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-slate-100 print:bg-slate-200">
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 w-20">Hora/Ref</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Descripción del servicio / tarea realizada</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 w-28">Estado</th>
              </tr>
            </thead>
            <tbody>
              {parte.trabajos.map((t, idx) => (
                <tr key={idx} className="border-t border-slate-100">
                  <td className="px-3 py-2.5 text-xs text-slate-600">{t.hora}</td>
                  <td className="px-3 py-2.5 text-sm text-slate-800">{t.descripcion}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-slate-700">{t.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ═══ MATERIALES Y REPUESTOS ═══ */}
        <div className="mb-6">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Materiales y repuestos utilizados</h4>
          <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-slate-100 print:bg-slate-200">
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 w-24">Referencia</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Descripción del material</th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 w-20">Cantidad</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 w-24">P. Unitario</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 w-24">Total</th>
              </tr>
            </thead>
            <tbody>
              {parte.materiales.map((m, idx) => (
                <tr key={idx} className="border-t border-slate-100">
                  <td className="px-3 py-2.5 text-xs text-slate-600 font-mono">{m.referencia}</td>
                  <td className="px-3 py-2.5 text-sm text-slate-800">{m.descripcion}</td>
                  <td className="px-3 py-2.5 text-xs text-center text-slate-700">{m.cantidad}</td>
                  <td className="px-3 py-2.5 text-xs text-right text-slate-700">{m.precioUnitario.toFixed(2)} &euro;</td>
                  <td className="px-3 py-2.5 text-xs text-right font-medium text-slate-900">{(m.cantidad * m.precioUnitario).toFixed(2)} &euro;</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 bg-slate-50">
                <td colSpan={4} className="px-3 py-2.5 text-xs font-semibold text-slate-700 text-right">Total materiales:</td>
                <td className="px-3 py-2.5 text-sm font-bold text-slate-900 text-right">{totalMateriales.toFixed(2)} &euro;</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ═══ OBSERVACIONES ═══ */}
        {parte.observaciones && (
          <div className="mb-8 p-4 border border-slate-200 rounded-lg bg-amber-50/50 print:bg-transparent">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Observaciones</h4>
            <p className="text-sm text-slate-700">{parte.observaciones}</p>
          </div>
        )}

        {/* ═══ FIRMAS ═══ */}
        <div className="grid grid-cols-2 gap-8 mb-8 mt-10">
          <div className="text-center">
            <div className="border-b-2 border-slate-300 h-20 mb-2"></div>
            <p className="text-xs font-semibold text-slate-600 uppercase">Firma del técnico / operario</p>
            <p className="text-xs text-slate-500 mt-1">{parte.tecnico}</p>
          </div>
          <div className="text-center">
            <div className="border-b-2 border-slate-300 h-20 mb-2"></div>
            <p className="text-xs font-semibold text-slate-600 uppercase">Conformidad del cliente</p>
            <p className="text-xs text-slate-500 mt-1">{parte.personaContacto}</p>
          </div>
        </div>

        {/* ═══ TEXTO LEGAL ═══ */}
        <div className="border-t border-slate-200 pt-4 space-y-2">
          <p className="text-[10px] text-slate-500 leading-relaxed">
            El cliente declara estar conforme con los trabajos realizados y los materiales detallados en este parte de trabajo.
          </p>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            Protección de datos: los datos serán tratados con la finalidad de gestionar la relación contractual y el servicio prestado.
          </p>
        </div>
      </div>
    </div>
  );
}
