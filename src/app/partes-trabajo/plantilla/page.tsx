"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { COMPANY_PROFILE } from "@/lib/company-profile";

export default function PlantillaParteTrabajoPage() {
  const handlePrint = () => {
    window.print();
  };

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
            <h1 className="page-title">Plantilla en blanco</h1>
            <p className="page-subtitle">Imprime copias para rellenar a mano</p>
          </div>
        </div>
        <button onClick={handlePrint} className="btn-primary">
          <Printer className="h-4 w-4" />
          Imprimir plantilla
        </button>
      </div>

      <p className="text-xs text-slate-500 mb-4 no-print">
        Selecciona el número de copias en el diálogo de impresión del navegador.
      </p>

      {/* Printable template */}
      <div className="print-template bg-white rounded-xl border border-slate-200/80 shadow-sm p-6 md:p-8 print:shadow-none print:border-none print:p-0 print:rounded-none max-w-4xl mx-auto text-[11px] leading-tight">

        {/* CABECERA */}
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">{COMPANY_PROFILE.tradeName}</h2>
            <p className="text-[10px] text-slate-700 mt-0.5">{COMPANY_PROFILE.legalName}</p>
            <p className="text-[10px] text-slate-700">NIF: {COMPANY_PROFILE.nif}</p>
            <p className="text-[10px] text-slate-700">{COMPANY_PROFILE.addressLine1}</p>
            <p className="text-[10px] text-slate-700">{COMPANY_PROFILE.addressLine2}</p>
            <p className="text-[10px] text-slate-700">Tel: {COMPANY_PROFILE.phone}</p>
          </div>
          <div className="text-right">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Parte de Trabajo</h3>
          </div>
        </div>

        {/* DATOS GENERALES */}
        <div className="grid grid-cols-5 gap-2 mb-4 text-[10px]">
          <div className="col-span-1 border border-slate-300 p-1.5">
            <span className="font-semibold text-slate-600 block">Nº Parte</span>
            <div className="h-4 border-b border-slate-200 mt-1"></div>
          </div>
          <div className="col-span-1 border border-slate-300 p-1.5">
            <span className="font-semibold text-slate-600 block">Fecha</span>
            <div className="h-4 border-b border-slate-200 mt-1"></div>
          </div>
          <div className="col-span-1 border border-slate-300 p-1.5">
            <span className="font-semibold text-slate-600 block">Operario</span>
            <div className="h-4 border-b border-slate-200 mt-1"></div>
          </div>
          <div className="col-span-1 border border-slate-300 p-1.5">
            <span className="font-semibold text-slate-600 block">Hora inicio</span>
            <div className="h-4 border-b border-slate-200 mt-1"></div>
          </div>
          <div className="col-span-1 border border-slate-300 p-1.5">
            <span className="font-semibold text-slate-600 block">Hora fin</span>
            <div className="h-4 border-b border-slate-200 mt-1"></div>
          </div>
        </div>

        {/* DATOS DEL CLIENTE */}
        <div className="border border-slate-300 p-2 mb-4">
          <p className="font-bold text-slate-700 text-[10px] uppercase tracking-wider mb-2">Datos del cliente</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px]">
            <div>
              <span className="text-slate-500">Cliente: </span>
              <span className="border-b border-slate-300 inline-block w-40"></span>
            </div>
            <div>
              <span className="text-slate-500">Teléfono: </span>
              <span className="border-b border-slate-300 inline-block w-32"></span>
            </div>
            <div>
              <span className="text-slate-500">Dirección: </span>
              <span className="border-b border-slate-300 inline-block w-40"></span>
            </div>
            <div>
              <span className="text-slate-500">Contacto: </span>
              <span className="border-b border-slate-300 inline-block w-32"></span>
            </div>
          </div>
        </div>

        {/* TRABAJOS REALIZADOS */}
        <div className="mb-4">
          <p className="font-bold text-slate-700 text-[10px] uppercase tracking-wider mb-1">Trabajos realizados</p>
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-1.5 py-1 text-left w-16 font-semibold">Hora/Ref</th>
                <th className="border border-slate-300 px-1.5 py-1 text-left font-semibold">Descripción del servicio / tarea realizada</th>
                <th className="border border-slate-300 px-1.5 py-1 text-left w-20 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {[...Array(6)].map((_, i) => (
                <tr key={i}>
                  <td className="border border-slate-300 px-1.5 py-2.5"></td>
                  <td className="border border-slate-300 px-1.5 py-2.5"></td>
                  <td className="border border-slate-300 px-1.5 py-2.5"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* MATERIALES Y REPUESTOS */}
        <div className="mb-4">
          <p className="font-bold text-slate-700 text-[10px] uppercase tracking-wider mb-1">Materiales y repuestos</p>
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-1.5 py-1 text-left w-20 font-semibold">Referencia</th>
                <th className="border border-slate-300 px-1.5 py-1 text-left font-semibold">Descripción del material</th>
                <th className="border border-slate-300 px-1.5 py-1 text-center w-14 font-semibold">Cant.</th>
                <th className="border border-slate-300 px-1.5 py-1 text-right w-16 font-semibold">P. Unit.</th>
              </tr>
            </thead>
            <tbody>
              {[...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td className="border border-slate-300 px-1.5 py-2.5"></td>
                  <td className="border border-slate-300 px-1.5 py-2.5"></td>
                  <td className="border border-slate-300 px-1.5 py-2.5"></td>
                  <td className="border border-slate-300 px-1.5 py-2.5"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* FIRMAS */}
        <div className="grid grid-cols-2 gap-6 mb-4">
          <div className="text-center">
            <div className="border border-slate-300 h-14 mb-1 rounded-sm"></div>
            <p className="text-[9px] font-semibold text-slate-600 uppercase">Firma del técnico / operario</p>
          </div>
          <div className="text-center">
            <div className="border border-slate-300 h-14 mb-1 rounded-sm"></div>
            <p className="text-[9px] font-semibold text-slate-600 uppercase">Conformidad del cliente</p>
          </div>
        </div>

        {/* OBSERVACIONES Y TEXTO LEGAL */}
        <div className="border-t border-slate-300 pt-2 space-y-1.5">
          <p className="text-[9px] text-slate-600 leading-relaxed">
            <span className="font-semibold">Observaciones y conformidad:</span> El cliente declara estar conforme con los trabajos realizados y los materiales detallados en este parte de trabajo.
          </p>
          <p className="text-[9px] text-slate-600 leading-relaxed">
            <span className="font-semibold">Protección de datos:</span> En cumplimiento de la normativa vigente en materia de protección de datos personales, le informamos de que sus datos serán tratados por S&amp;H Eléctricas, titular Iván Martín Oyarzabal, con la finalidad de gestionar la relación contractual y el servicio prestado.
          </p>
        </div>
      </div>
    </div>
  );
}
