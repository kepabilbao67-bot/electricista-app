export default function Documentos360Page() {
  return <section className="space-y-4">
    <h1 className="text-2xl font-bold">Documentos 360</h1>
    <p className="text-sm text-slate-600 dark:text-slate-300">Abre, edita y descarga documentos. Los borradores se guardan en este navegador, no se sincronizan con el CRM.</p>
    <a href="/documentos360/index.html" target="_blank" rel="noopener noreferrer" className="inline-block rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white">Abrir editor a pantalla completa</a>
    <iframe title="Editor Documentos 360" src="/documentos360/index.html" allow="microphone" className="w-full rounded-xl border bg-white" style={{height: "75dvh"}} />
  </section>;
}
