"use client";

import { Suspense } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import ParteForm from "@/components/ParteForm";

export default function NuevoParteTrabajoPage() {
  return (
    <Suspense fallback={
      <div className="animate-fade-in flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2 text-sm text-slate-500">Cargando formulario...</span>
      </div>
    }>
      <NuevoParteContent />
    </Suspense>
  );
}

function NuevoParteContent() {
  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/partes-trabajo" className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50 transition-all">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="page-title">Nuevo parte de trabajo</h1>
          <p className="page-subtitle">Registra una intervención eléctrica</p>
        </div>
      </div>

      <ParteForm />
    </div>
  );
}
