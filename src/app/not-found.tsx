import Link from "next/link";
import { ArrowLeft, Home, FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center mb-6 shadow-sm">
        <FileQuestion className="h-8 w-8 text-blue-600 dark:text-blue-400" />
      </div>

      <h1 className="text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
        404 — Página no encontrada
      </h1>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
        La ruta a la que intentas acceder no existe, ha sido movida o no se encuentra disponible.
      </p>

      <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-800 dark:bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-900 dark:hover:bg-blue-700 transition-all"
        >
          <Home className="h-4 w-4" />
          Volver al Dashboard
        </Link>
        <Link
          href="/clientes"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Ver Clientes
        </Link>
      </div>
    </div>
  );
}
