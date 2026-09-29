"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Mic, Package, RotateCcw, Trash2 } from "lucide-react";
import VoiceDictation from "@/components/VoiceDictation";
import { showToast } from "@/components/Toast";
import type { FaltanteObra, PartidaFaltante } from "@/lib/faltantes-obra";

/**
 * ELECTRICISTA360 — FALTANTES DE OBRA (P0-3)
 *
 * Pantalla para apuntar, por voz, lo que falta para una obra concreta.
 *
 * Flujo real en obra:
 *   1. Se elige la obra (parte de trabajo REAL, guardado en la base de datos).
 *   2. Se dicta: "Apunta que para este trabajo me faltan 20 metros de cable, dos
 *      cajas, diez tornillos y silicona."
 *   3. Cuando se compra algo: "Ya tengo las cajas y los tornillos."
 *   4. Antes de volver a la obra: "¿Qué me falta para esta obra?"
 *
 * Todo se guarda en la base de datos asociado al `parte_id`, así que sobrevive a
 * salir, volver y refrescar. También hay un cuadro de texto para escribir la
 * misma frase (misma interpretación, misma API) cuando no se pueda hablar.
 */

const CLAVE_OBRA_SELECCIONADA = "electricista360:faltantes:obra";

interface ParteTrabajo {
  id: string;
  numero: string;
  cliente: string;
  fecha: string;
  estado: string;
}

interface RespuestaFaltantes {
  tipo: string;
  aplicado?: string;
  faltantes: FaltanteObra[];
  pendientes: PartidaFaltante[];
  respuesta: string;
  resumenPendientes: string[];
  error?: string;
}

export default function FaltantesObraPage() {
  const [partes, setPartes] = useState<ParteTrabajo[]>([]);
  const [parteId, setParteId] = useState("");
  const [faltantes, setFaltantes] = useState<FaltanteObra[]>([]);
  const [pendientes, setPendientes] = useState<PartidaFaltante[]>([]);
  const [respuesta, setRespuesta] = useState("");
  const [resumen, setResumen] = useState<string[]>([]);
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  // ── Obras disponibles (partes de trabajo reales) ────────────────────────────
  useEffect(() => {
    fetch("/api/partes-trabajo")
      .then((r) => (r.ok ? r.json() : []))
      .then((lista: ParteTrabajo[]) => {
        setPartes(Array.isArray(lista) ? lista : []);
        const guardada = (() => {
          try {
            return window.localStorage.getItem(CLAVE_OBRA_SELECCIONADA) ?? "";
          } catch {
            return "";
          }
        })();
        const valida = Array.isArray(lista) && lista.some((p) => p.id === guardada);
        if (valida) setParteId(guardada);
        else if (Array.isArray(lista) && lista.length > 0) setParteId(lista[0].id);
      })
      .catch(() => setError("No se pudieron cargar las obras."));
  }, []);

  const cargarFaltantes = useCallback(async (id: string) => {
    if (!id) return;
    try {
      const r = await fetch(`/api/faltantes-obra?parte_id=${encodeURIComponent(id)}`);
      const cuerpo = (await r.json()) as RespuestaFaltantes;
      if (!r.ok) throw new Error(cuerpo.error || "No se pudieron leer los faltantes");
      setFaltantes(cuerpo.faltantes);
      setPendientes(cuerpo.pendientes);
      setResumen(cuerpo.resumenPendientes);
      setRespuesta(cuerpo.respuesta);
      setError("");
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudieron leer los faltantes");
    }
  }, []);

  useEffect(() => {
    if (!parteId) return;
    try {
      window.localStorage.setItem(CLAVE_OBRA_SELECCIONADA, parteId);
    } catch {
      /* la selección es una comodidad, no un requisito */
    }
    void cargarFaltantes(parteId);
  }, [parteId, cargarFaltantes]);

  /** Envía el dictado (voz o teclado) a la API: una sola interpretación. */
  const enviarDictado = useCallback(
    async (dicho: string) => {
      const limpio = dicho.trim();
      if (!parteId) {
        setError("Selecciona primero la obra.");
        return;
      }
      if (!limpio) {
        setError("No se ha reconocido nada. Vuelve a pulsar el micrófono o escríbelo.");
        return;
      }
      setCargando(true);
      setError("");
      try {
        const r = await fetch("/api/faltantes-obra", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parte_id: parteId, texto: limpio }),
        });
        const cuerpo = (await r.json()) as RespuestaFaltantes;
        if (!r.ok) throw new Error(cuerpo.error || "No se pudo interpretar el dictado");
        setFaltantes(cuerpo.faltantes);
        setPendientes(cuerpo.pendientes);
        setResumen(cuerpo.resumenPendientes);
        setRespuesta(cuerpo.respuesta);
        setTexto("");
        if (cuerpo.tipo === "conseguido") {
          showToast("success", "Actualizado: material marcado como conseguido");
        } else if (cuerpo.tipo === "agregar") {
          showToast("success", "Faltantes apuntados en la obra");
        }
      } catch (causa) {
        setError(causa instanceof Error ? causa.message : "No se pudo interpretar el dictado");
      } finally {
        setCargando(false);
      }
    },
    [parteId]
  );

  /** Cambia el estado de una partida (pendiente <-> conseguido). */
  const cambiarEstado = useCallback(
    async (faltante: FaltanteObra) => {
      const nuevo = faltante.estado === "pendiente" ? "conseguido" : "pendiente";
      try {
        const r = await fetch("/api/faltantes-obra", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: faltante.id, estado: nuevo }),
        });
        const cuerpo = (await r.json()) as RespuestaFaltantes;
        if (!r.ok) throw new Error(cuerpo.error || "No se pudo cambiar el estado");
        setFaltantes(cuerpo.faltantes);
        setPendientes(cuerpo.pendientes);
        setResumen(cuerpo.resumenPendientes);
      } catch (causa) {
        setError(causa instanceof Error ? causa.message : "No se pudo cambiar el estado");
      }
    },
    []
  );

  const borrarPartida = useCallback(async (faltante: FaltanteObra) => {
    try {
      const r = await fetch(`/api/faltantes-obra?id=${encodeURIComponent(faltante.id)}`, {
        method: "DELETE",
      });
      const cuerpo = (await r.json()) as RespuestaFaltantes;
      if (!r.ok) throw new Error(cuerpo.error || "No se pudo borrar la partida");
      setFaltantes(cuerpo.faltantes);
      setPendientes(cuerpo.pendientes);
      setResumen(cuerpo.resumenPendientes);
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No se pudo borrar la partida");
    }
  }, []);

  const obraActual = useMemo(() => partes.find((p) => p.id === parteId) ?? null, [partes, parteId]);

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-16">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-400">Electricista 360</p>
        <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">FALTANTES DE OBRA</h1>
        <p className="mt-2 text-sm text-slate-300">
          Apunta por voz lo que falta para esta obra. Se guarda en el trabajo, así que puedes salir,
          volver y refrescar sin perder nada.
        </p>
      </header>

      {/* Obra asociada: los faltantes SIEMPRE pertenecen a un trabajo real */}
      <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 shadow-xl sm:p-5">
        <label htmlFor="obra" className="text-sm font-semibold text-slate-100">
          Obra (parte de trabajo)
        </label>
        {partes.length === 0 ? (
          <div className="mt-2 space-y-3">
            <p className="text-sm text-amber-200">
              Todavía no hay ninguna obra. Los faltantes se guardan siempre dentro de una obra real.
            </p>
            <Link
              href="/partes-trabajo/nuevo"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-500"
            >
              Crear obra / parte de trabajo
            </Link>
          </div>
        ) : (
          <>
            <select
              id="obra"
              value={parteId}
              onChange={(e) => setParteId(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-base text-white outline-none focus:border-blue-500"
            >
              {partes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.numero} · {p.cliente}
                  {p.fecha ? ` · ${p.fecha}` : ""}
                </option>
              ))}
            </select>
            {obraActual && (
              <p className="mt-1 text-xs text-slate-400">
                Obra seleccionada: <b className="text-slate-200">{obraActual.numero}</b> — {obraActual.cliente}
              </p>
            )}
          </>
        )}
      </section>

      {/* Dictado */}
      <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 shadow-xl sm:p-5">
        <label htmlFor="dictado" className="text-sm font-semibold text-slate-100">
          ¿Qué falta para esta obra?
        </label>
        <textarea
          id="dictado"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          disabled={cargando || partes.length === 0}
          placeholder="Ej.: Apunta que para este trabajo me faltan 20 metros de cable, dos cajas, diez tornillos y silicona."
          className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-base text-white outline-none placeholder:text-slate-500 focus:border-blue-500 disabled:opacity-60"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <VoiceDictation
            onTranscriptComplete={(t) => void enviarDictado(t)}
            disabled={cargando || partes.length === 0 || !parteId}
            className="min-h-12 px-5 py-3 text-base"
          />
          <button
            type="button"
            onClick={() => void enviarDictado(texto)}
            disabled={cargando || !texto.trim() || !parteId}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Mic className="h-5 w-5" />
            {cargando ? "Aplicando…" : "Aplicar"}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Frases que entiende: «me faltan 20 metros de cable, dos cajas, diez tornillos y silicona» ·
          «ya tengo las cajas y los tornillos» · «¿qué me falta para esta obra?»
        </p>
      </section>

      {error && (
        <p role="alert" className="rounded-xl border border-rose-800 bg-rose-950/60 p-3 text-sm text-rose-200">
          {error}
        </p>
      )}

      {/* Respuesta de "¿qué me falta?" — SOLO lo pendiente */}
      <section className="rounded-2xl border border-emerald-700/70 bg-emerald-950/40 p-4 shadow-xl sm:p-5">
        <h2 className="flex items-center gap-2 text-base font-bold text-emerald-100">
          <Package className="h-5 w-5" /> ¿Qué me falta para esta obra?
        </h2>
        {resumen.length === 0 ? (
          <p className="mt-2 text-sm text-emerald-200/80">
            No hay nada pendiente en esta obra.
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {resumen.map((linea) => (
              <li key={linea} className="text-lg font-semibold text-white">
                {linea}
              </li>
            ))}
          </ul>
        )}
        {respuesta && <p className="mt-2 text-sm text-emerald-200/80">{respuesta}</p>}
      </section>

      {/* Lista completa, con estados */}
      <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 shadow-xl sm:p-5">
        <h2 className="text-base font-bold text-slate-100">
          Materiales apuntados ({faltantes.length}) · pendientes: {pendientes.length}
        </h2>
        {faltantes.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">
            Todavía no hay nada apuntado para esta obra.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-400">
                  <th className="border-b border-slate-700 py-2 pr-3">Material</th>
                  <th className="border-b border-slate-700 py-2 pr-3">Cantidad</th>
                  <th className="border-b border-slate-700 py-2 pr-3">Unidad</th>
                  <th className="border-b border-slate-700 py-2 pr-3">Estado</th>
                  <th className="border-b border-slate-700 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {faltantes.map((f) => (
                  <tr key={f.id} className="align-middle">
                    <td className="border-b border-slate-800 py-2 pr-3 font-semibold text-white">{f.producto}</td>
                    <td className="border-b border-slate-800 py-2 pr-3 text-slate-200">{f.cantidad}</td>
                    <td className="border-b border-slate-800 py-2 pr-3 text-slate-300">{f.unidad}</td>
                    <td className="border-b border-slate-800 py-2 pr-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          f.estado === "pendiente"
                            ? "bg-amber-400/15 text-amber-200"
                            : "bg-emerald-500/15 text-emerald-200"
                        }`}
                      >
                        {f.estado}
                      </span>
                    </td>
                    <td className="border-b border-slate-800 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void cambiarEstado(f)}
                          className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-600 px-3 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                          title={f.estado === "pendiente" ? "Marcar como conseguido" : "Volver a pendiente"}
                        >
                          {f.estado === "pendiente" ? <Check className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                          {f.estado === "pendiente" ? "Conseguido" : "Pendiente"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void borrarPartida(f)}
                          className="inline-flex min-h-10 items-center rounded-lg border border-rose-800 px-3 text-xs font-semibold text-rose-200 hover:bg-rose-950"
                          title="Borrar la partida"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
