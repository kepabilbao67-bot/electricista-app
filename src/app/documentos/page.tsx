import Link from "next/link";

/** Documentos 360 funciona en el navegador; no escribe en la BD del cliente. */
export default function DocumentosPage() {
  return (
    <main className="space-y-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Documentos 360</h1>
          <p className="text-sm text-slate-300">Editor, visor y firma. Guarda o descarga los archivos antes de salir: los borradores son locales a este navegador.</p>
        </div>
        <Link href="/documentos360/index.html" target="_blank" rel="noopener noreferrer" className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white">Abrir a pantalla completa</Link>
      </div>
      <iframe src="/documentos360/index.html" title="Documentos 360" className="h-[80vh] w-full rounded-xl border border-slate-600 bg-white" />
    </main>
  );
}
