export default function Documentos360Page() {
  return <section className="space-y-4">
    <h1 className="text-2xl font-bold">Documentos 360</h1>
    <p className="text-sm text-slate-600 dark:text-slate-300">Abre, edita y descarga documentos. Los borradores se guardan en este navegador, no se sincronizan con el CRM.</p>
    <a href="/documentos360/index.html" className="block rounded-xl bg-blue-700 px-4 py-4 text-center font-semibold text-white md:inline-block md:py-3">Abrir Documentos 360 a pantalla completa</a>
    <p className="text-sm text-slate-600 dark:text-slate-300 md:hidden">En el móvil se abre directamente el editor para evitar dos zonas de desplazamiento y facilitar la selección de archivos.</p>
    <iframe title="Editor Documentos 360" src="/documentos360/index.html" allow="microphone" className="hidden w-full rounded-xl border bg-white md:block" style={{height: "75dvh"}} />
  </section>;
}
