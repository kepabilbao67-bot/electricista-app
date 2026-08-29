"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error locally without exposing sensitive stack
    console.error("App boundary error caught:", error.message);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center mb-6 shadow-sm">
        <AlertTriangle className="h-8 w-8 text-rose-600 dark:text-rose-400" />
      </div>

      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
        Algo ha salido mal
      </h1>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
        Se ha producido un error inesperado al renderizar esta vista. Puedes intentar recargar la sección o volver al inicio.
      </p>

      <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-800 dark:bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-900 dark:hover:bg-blue-700 transition-all cursor-pointer"
        >
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
        >
          <Home className="h-4 w-4" />
          Ir al Inicio
        </Link>
      </div>
    </div>
  );
}
