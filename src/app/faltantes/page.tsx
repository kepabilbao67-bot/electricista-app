"use client";

import { useEffect, useState } from "react";

type Faltante = { id: string; obra: string; material: string; cantidad: string; unidad: string; fecha: string };
const KEY = "electricista360.faltantes.v1";

export default function FaltantesPage() {
  const [lista, setLista] = useState<Faltante[]>([]);
  const [cargado, setCargado] = useState(false);
  const [obra, setObra] = useState("");
  const [material, setMaterial] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [unidad, setUnidad] = useState("ud");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    try {
      const data: unknown = JSON.parse(localStorage.getItem(KEY) || "[]");
      if (Array.isArray(data)) setLista(data.filter((item): item is Faltante =>
        item && typeof item.id === "string" && typeof item.obra === "string" && typeof item.material === "string" && typeof item.cantidad === "string" && typeof item.unidad === "string" && typeof item.fecha === "string"));
    } catch { setMensaje("No se pudieron leer los faltantes guardados en este dispositivo."); }
    setCargado(true);
  }, []);

  function guardar(next: Faltante[]) {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      setLista(next);
      setMensaje("Guardado en este dispositivo.");
    } catch { setMensaje("No se pudo guardar. Comprueba el espacio del navegador."); }
  }

  function anadir(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!obra.trim() || !material.trim() || !cantidad.trim()) return;
    guardar([{ id: crypto.randomUUID(), obra: obra.trim(), material: material.trim(),
      cantidad: cantidad.trim(), unidad, fecha: new Date().toISOString() }, ...lista]);
    setMaterial("");
    setCantidad("1");
  }

  function exportar() {
    const csv = [["Obra", "Material", "Cantidad", "Unidad", "Fecha"],
      ...lista.map(f => [f.obra, f.material, f.cantidad, f.unidad, f.fecha]) ]
      .map(row => row.map(v => '"' + v.replace(/"/g, '""') + '"').join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "faltantes-obra-360.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const campo = "w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white";
  return <section className="mx-auto max-w-3xl space-y-5 pb-8">
    <h1 className="text-2xl font-bold">Faltantes de obra</h1>
    <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
      Registro local: los materiales se guardan solo en este navegador. No se sincronizan todavía entre PC y móvil.
      Descarga el CSV para conservar una copia.
    </p>
    <form onSubmit={anadir} className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-2">
      <label className="space-y-1 text-sm">Obra<input className={campo} value={obra} onChange={e => setObra(e.target.value)} required maxLength={120} placeholder="Nombre de la obra" /></label>
      <label className="space-y-1 text-sm">Material que falta<input className={campo} value={material} onChange={e => setMaterial(e.target.value)} required maxLength={160} placeholder="Ej. cable 2,5 mm²" /></label>
      <label className="space-y-1 text-sm">Cantidad<input className={campo} value={cantidad} onChange={e => setCantidad(e.target.value)} required maxLength={30} /></label>
      <label className="space-y-1 text-sm">Unidad<select className={campo} value={unidad} onChange={e => setUnidad(e.target.value)}>
        <option value="ud">Unidades</option><option value="m">Metros</option><option value="kg">Kilos</option>
        <option value="cajas">Cajas</option><option value="rollos">Rollos</option><option value="otros">Otros</option>
      </select></label>
      <button className="rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white sm:col-span-2" disabled={!cargado}>Añadir material faltante</button>
    </form>
    <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Pendientes ({lista.length})</h2>
      <button type="button" onClick={exportar} disabled={!lista.length} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Exportar CSV</button></div>
    {mensaje && <p role="status" className="text-sm">{mensaje}</p>}
    <div className="space-y-2">{lista.map(f => <article key={f.id} className="flex items-start justify-between gap-3 rounded-xl border p-3">
      <div className="min-w-0"><p className="font-semibold break-words">{f.material}</p><p className="text-sm">{f.cantidad} {f.unidad} · {f.obra}</p>
      <p className="text-xs text-slate-500">{new Date(f.fecha).toLocaleDateString("es-ES")}</p></div>
      <button type="button" onClick={() => guardar(lista.filter(x => x.id !== f.id))} className="shrink-0 rounded-lg border px-3 py-2 text-sm" aria-label={"Marcar recibido: " + f.material}>Recibido</button>
    </article>)}
    {cargado && !lista.length && <p className="text-sm text-slate-500">Aún no hay materiales pendientes registrados en este navegador.</p>}
    </div>
  </section>;
}
