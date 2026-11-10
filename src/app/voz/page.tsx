export default function Voz360Page() {
  return <section className="space-y-4">
    <h1 className="text-2xl font-bold">Voz 360</h1>
    <p className="text-sm text-slate-600 dark:text-slate-300">Dicta texto con «🎙️ Voz 360», escucha documentos con «🔊 Leer documento» y detén la reproducción cuando quieras. Permite el micrófono si el navegador lo solicita. El dictado depende de la compatibilidad del navegador.</p>
    <a href="/documentos360/index.html" target="_blank" rel="noopener noreferrer" className="inline-block rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white">Abrir Voz 360 a pantalla completa</a>
    <iframe title="Editor con Voz 360" src="/documentos360/index.html" allow="microphone" className="w-full rounded-xl border bg-white" style={{height:"75dvh"}} />
  </section>;
}
