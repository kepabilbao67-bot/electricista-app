"use client";

import { useEffect, useRef, useState } from "react";

type Point = { x: number; y: number };
type Entry = { id: string; name: string; distance: number; unit: string; date: string };
const STORAGE = "electricista360.mediciones.v1";
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export default function MedicionesPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pictureRef = useRef<HTMLImageElement | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [reference, setReference] = useState("100");
  const [unit, setUnit] = useState("cm");
  const [name, setName] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState("");
  const [hasPhoto, setHasPhoto] = useState(false);

  useEffect(() => {
    try {
      const data: unknown = JSON.parse(localStorage.getItem(STORAGE) || "[]");
      if (Array.isArray(data)) setEntries(data.filter((v): v is Entry =>
        v && typeof v.id === "string" && typeof v.name === "string" &&
        typeof v.distance === "number" && Number.isFinite(v.distance) &&
        typeof v.unit === "string" && typeof v.date === "string"));
    } catch { setError("No se pudo leer el historial de este dispositivo."); }
  }, []);

  useEffect(() => {
    const img = pictureRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    points.forEach((p, index) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(5, canvas.width / 120), 0, Math.PI * 2);
      ctx.fillStyle = index < 2 ? "#16a34a" : "#dc2626";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    for (let i = 0; i < points.length; i += 2) {
      if (!points[i + 1]) continue;
      ctx.beginPath();
      ctx.moveTo(points[i].x, points[i].y);
      ctx.lineTo(points[i + 1].x, points[i + 1].y);
      ctx.strokeStyle = i === 0 ? "#16a34a" : "#dc2626";
      ctx.lineWidth = Math.max(3, canvas.width / 160);
      ctx.stroke();
    }
  }, [points, hasPhoto]);

  async function loadPhoto(file?: File) {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) { setError("Selecciona una fotografía."); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    try {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("No se puede abrir la foto."));
        img.src = url;
      });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const scale = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      pictureRef.current = img;
      setPoints([]);
      setHasPhoto(true);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    } catch { setError("La fotografía no se pudo leer."); } finally { URL.revokeObjectURL(url); }
  }

  function mark(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!hasPhoto || points.length >= 4) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    setPoints(prev => [...prev, {
      x: (event.clientX - rect.left) * event.currentTarget.width / rect.width,
      y: (event.clientY - rect.top) * event.currentTarget.height / rect.height,
    }]);
  }

  const known = Number(reference.replace(",", "."));
  const ratio = points.length === 4 ? distance(points[2], points[3]) / distance(points[0], points[1]) : NaN;
  const result = known * ratio;
  const valid = Number.isFinite(known) && known > 0 && Number.isFinite(result) && result > 0;
  function save() {
    if (!valid) return;
    const next = [{ id: crypto.randomUUID(), name: name.trim() || "Medición", distance: result, unit, date: new Date().toISOString() }, ...entries];
    try { localStorage.setItem(STORAGE, JSON.stringify(next)); setEntries(next); setError("Medición guardada en este dispositivo."); }
    catch { setError("No se pudo guardar la medición."); }
  }
  function exportCsv() {
    const rows = [["Nombre", "Distancia", "Unidad", "Fecha"], ...entries.map(e => [e.name, String(e.distance), e.unit, e.date])];
    const csv = rows.map(row => row.map(v => '"' + v.replace(/"/g, '""') + '"').join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], {type:"text/csv;charset=utf-8"}));
    const link = document.createElement("a"); link.href = url; link.download = "mediciones360.csv"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const cls = "w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 dark:bg-slate-800 dark:text-white";
  return <section className="mx-auto max-w-3xl space-y-4 pb-10">
    <h1 className="text-2xl font-bold">Mediciones 360</h1>
    <p className="text-sm">Mide distancias sobre una foto con una referencia conocida. No requiere instalar otra aplicación.</p>
    <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">La medida es una estimación geométrica: referencia y objeto deben estar en el mismo plano, sin perspectiva apreciable. Para medidas exactas usa un instrumento calibrado. No se pueden obtener dimensiones reales de una foto sin escala conocida.</p>
    <label className="block rounded-xl border p-3 font-semibold">1. Sacar foto o elegir imagen
      <input className="mt-2 block w-full text-sm" aria-label="Fotografía para medir" type="file" accept="image/*" capture="environment" onChange={e => { void loadPhoto(e.target.files?.[0]); }} />
    </label>
    <label className="block font-semibold">2. Longitud real de un objeto visible en la foto
      <input className={cls + " mt-2"} type="text" inputMode="decimal" value={reference} onChange={e=>setReference(e.target.value)} aria-label="Longitud de referencia" />
    </label>
    <label className="block font-semibold">Unidad
      <select className={cls + " mt-2"} value={unit} onChange={e=>setUnit(e.target.value)}><option value="cm">Centímetros</option><option value="m">Metros</option><option value="mm">Milímetros</option></select>
    </label>
    <p className="text-sm font-semibold">3. Toca cuatro puntos: los dos extremos de la referencia (verde) y los dos de la medida deseada (rojo). {points.length}/4 puntos.</p>
    <canvas ref={canvasRef} onPointerDown={mark} aria-label="Fotografía para marcar extremos de la referencia y la medida" className="w-full h-auto rounded-xl border border-slate-400 touch-manipulation" style={{display:hasPhoto?"block":"none",cursor:"crosshair"}} />
    {!hasPhoto && <p className="rounded-xl border p-4 text-sm text-slate-500">La fotografía aparecerá aquí.</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" className="rounded-xl border px-4 py-3" disabled={!points.length} onClick={()=>setPoints(p=>p.slice(0,-1))}>Deshacer punto</button>
      <button type="button" className="rounded-xl border px-4 py-3" disabled={!points.length} onClick={()=>setPoints([])}>Repetir puntos</button>
    </div>
    {points.length===4 && (!valid ? <p role="alert">Revisa la referencia: debe ser mayor que cero y los dos puntos no pueden coincidir.</p> :
      <div className="rounded-xl border p-4"><p className="text-sm">Distancia estimada</p><p className="text-3xl font-bold" aria-live="polite">{result.toLocaleString("es-ES",{maximumFractionDigits:2})} {unit}</p></div>)}
    <label className="block">Nombre de la medición<input className={cls+" mt-2"} value={name} onChange={e=>setName(e.target.value)} maxLength={120} placeholder="Ej. anchura del cuadro" /></label>
    <button type="button" className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-40" disabled={!valid} onClick={save}>Guardar medición</button>
    {error && <p role="status" className="text-sm">{error}</p>}
    <div className="space-y-2"><h2 className="text-lg font-bold">Mediciones guardadas ({entries.length})</h2>
      <p className="text-xs text-slate-500">Historial local en este navegador. No se sincroniza aún entre dispositivos; exporta la copia para conservarlo.</p>
      <button type="button" onClick={exportCsv} disabled={!entries.length} className="rounded-xl border px-4 py-3 disabled:opacity-40">Exportar CSV</button>
      {entries.map(e=><div className="rounded-xl border p-3" key={e.id}><strong>{e.name}</strong> — {e.distance.toLocaleString("es-ES",{maximumFractionDigits:2})} {e.unit}<div className="text-xs text-slate-500">{new Date(e.date).toLocaleDateString("es-ES")}</div></div>)}
    </div>
  </section>;
}
