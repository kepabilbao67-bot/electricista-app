"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Mic, RefreshCw, RotateCcw } from "lucide-react";
import VoiceDictation from "@/components/VoiceDictation";

interface Parte {
  id: string;
  numero: string;
  cliente: string;
  estado: string;
}

interface Faltante {
  id: string;
  product: string;
  quantity: number;
  unit: string;
  status: "pendiente" | "conseguido";
  parte_id: string | null;
}

export default function FaltantesObraPage() {
  const [partes, setPartes] = useState<Parte[]>([]);
  const [parteId, setParteId] = useState("");
  const [items, setItems] = useState<Faltante[]>([]);
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadPartes() {
    const response = await fetch("/api/partes-trabajo", { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudieron cargar las obras");
    const data = (await response.json()) as Parte[];
    setPartes(data);
    setParteId((current) => current || data[0]?.id || "");
  }

  async function loadItems(id = parteId) {
    if (!id) {
      setItems([]);
      return;
    }
    const response = await fetch(`/api/faltantes-obra?parte_id=${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudieron cargar los faltantes");
    setItems(data.items || []);
  }

  useEffect(() => {
    void loadPartes().catch((cause) =>
      setError(cause instanceof Error ? cause.message : "Error cargando obras")
    );
  }, []);

  useEffect(() => {
    if (!parteId) return;
    void loadItems(parteId).catch((cause) =>
      setError(cause instanceof Error ? cause.message : "Error cargando faltantes")
    );
  }, [parteId]);

  const pending = useMemo(
    () => items.filter((item) => item.status === "pendiente"),
    [items]
  );

  async function process(transcript = text) {
    const input = transcript.trim();
    if (!input || !parteId) {
      setError(!parteId ? "Selecciona una obra o parte de trabajo" : "Di o escribe lo que falta");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/faltantes-obra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, parte_id: parteId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo procesar la orden");
      setItems(data.items || []);
      setAnswer(data.answer || "Hecho");
      setText("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo procesar la orden");
    } finally {
      setLoading(false);
    }
  }

  async function toggle(item: Faltante) {
    const next = item.status === "pendiente" ? "conseguido" : "pendiente";
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/faltantes-obra", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: item.id, status: next }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo actualizar");
      await loadItems();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo actualizar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-12">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300">
          Electricista 360
        </p>
        <h1 className="mt-1 text-3xl font-black text-white">Faltantes de obra</h1>
        <p className="mt-2 text-sm text-slate-300">
          Dicta lo que falta. Se guarda en la obra y no desaparece al salir o refrescar.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 sm:p-5">
        <label className="text-sm font-semibold text-slate-100">Obra / parte de trabajo</label>
        <select
          value={parteId}
          onChange={(event) => setParteId(event.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-white"
        >
          <option value="">Selecciona una obra</option>
          {partes.map((parte) => (
            <option key={parte.id} value={parte.id}>
              {parte.numero} · {parte.cliente}
            </option>
          ))}
        </select>
      </section>

      <section className="rounded-2xl border border-indigo-700/70 bg-slate-900 p-4 sm:p-5">
        <p className="text-sm text-slate-300">
          Ejemplo: “Apunta que para este trabajo me faltan 20 metros de cable, dos cajas,
          diez tornillos y silicona.”
        </p>

        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          placeholder="Di o escribe lo que falta..."
          className="mt-3 w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-base text-white outline-none focus:border-indigo-500"
        />

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <VoiceDictation
            onTranscriptComplete={(transcript) => {
              setText(transcript);
              void process(transcript);
            }}
            disabled={loading || !parteId}
            className="min-h-14 w-full justify-center px-5 py-3 text-base"
          />
          <button
            type="button"
            onClick={() => void process()}
            disabled={loading || !parteId || !text.trim()}
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            <Mic className="h-5 w-5" />
            {loading ? "Procesando..." : "Guardar por voz/texto"}
          </button>
        </div>

        {answer && (
          <div className="mt-4 rounded-xl border border-emerald-700 bg-emerald-950/40 p-3 text-sm text-emerald-100">
            {answer}
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-xl border border-rose-700 bg-rose-950/40 p-3 text-sm text-rose-100">
            {error}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Pendientes</p>
            <h2 className="text-xl font-bold text-white">{pending.length} materiales</h2>
          </div>
          <button
            type="button"
            onClick={() => void loadItems()}
            disabled={!parteId || loading}
            className="rounded-xl border border-slate-600 p-2.5 text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            aria-label="Actualizar"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-700 p-5 text-center text-sm text-slate-400">
              No hay materiales apuntados para esta obra.
            </p>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void toggle(item)}
                disabled={loading}
                className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-left hover:border-slate-500 disabled:opacity-60"
              >
                <div>
                  <p className="font-bold text-white">
                    {item.product}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {item.quantity} {item.unit}
                  </p>
                </div>
                {item.status === "conseguido" ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" /> conseguido
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-300">
                    <RotateCcw className="h-4 w-4" /> pendiente
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
