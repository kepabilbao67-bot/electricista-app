"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  Gauge,
  Grid3X3,
  Loader2,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Ruler,
  Save,
  Sun,
  Trash2,
} from "lucide-react";
import {
  calculateLuxSession,
  LUX_PROFILES,
  type LuxReading,
} from "@/lib/luz360/calculation";
import { runLuz360Plugins, type Luz360MeasurementMethod } from "@/lib/luz360/plugin";
import { LuxHeatmap } from "@/components/luz360/LuxHeatmap";
import { LuxReport } from "@/components/luz360/LuxReport";
import { PhoneLuxSensor } from "@/components/luz360/PhoneLuxSensor";
import {
  buildWorkContextHref,
  getParteIdFromSearch,
  replaceParteIdInCurrentUrl,
} from "@/lib/measurements360/work-context";

interface WorkOption {
  id: string;
  numero: string;
  cliente: string;
  direccion?: string | null;
}

interface SavedLuxSession {
  id: string;
  label: string;
  kind: string;
  value: number;
  unit: string;
  parteId?: string | null;
  createdAt: string;
  metadata?: {
    zone?: string;
    profileId?: string;
    profileLabel?: string;
    minLux?: number;
    method?: Luz360MeasurementMethod;
    readings?: LuxReading[];
    result?: ReturnType<typeof calculateLuxSession>;
  } | null;
}

function parseLux(value: string): number | null {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function fmt(value: number, digits = 0): string {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: digits }).format(value);
}

export default function Luz360Page() {
  const [parts, setParts] = useState<WorkOption[]>([]);
  const [parteId, setParteId] = useState("");
  const [workContextReady, setWorkContextReady] = useState(false);
  const [zone, setZone] = useState("");
  const [profileId, setProfileId] = useState(LUX_PROFILES[5].id);
  const [luxInput, setLuxInput] = useState("");
  const [measurementMethod, setMeasurementMethod] = useState<Luz360MeasurementMethod>("manual-luxmeter");
  const [readings, setReadings] = useState<LuxReading[]>([]);
  const [nextPoint, setNextPoint] = useState<{ x: number; y: number } | null>(null);
  const [history, setHistory] = useState<SavedLuxSession[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    setParteId(getParteIdFromSearch(window.location.search));
    setWorkContextReady(true);
  }, []);

  useEffect(() => {
    if (!workContextReady) return;
    replaceParteIdInCurrentUrl(parteId);
  }, [parteId, workContextReady]);

  const profile = useMemo(
    () => LUX_PROFILES.find((item) => item.id === profileId) ?? LUX_PROFILES[0],
    [profileId],
  );
  const result = useMemo(() => calculateLuxSession(readings, profile), [profile, readings]);
  const effectiveMethod = useMemo<Luz360MeasurementMethod>(
    () => readings.some((reading) => reading.method === "phone-orientative") ? "phone-orientative" : "manual-luxmeter",
    [readings],
  );
  const sessionGate = useMemo(
    () => runLuz360Plugins({ readings, minLux: profile.minLux, method: effectiveMethod }),
    [effectiveMethod, profile.minLux, readings],
  );
  const selectedPart = useMemo(() => parts.find((part) => part.id === parteId) ?? null, [parteId, parts]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/trabajos?days=3650")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error())))
      .then((payload) => {
        if (!cancelled) setParts(Array.isArray(payload.trabajos) ? payload.trabajos : []);
      })
      .catch(() => {
        if (!cancelled) setParts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadHistory = async () => {
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (parteId) params.set("parte_id", parteId);
      const response = await fetch(`/api/measurements360?${params.toString()}`);
      if (!response.ok) throw new Error();
      const payload = await response.json();
      const records = Array.isArray(payload.records) ? payload.records : [];
      setHistory(records.filter((item: SavedLuxSession) => item.kind === "luz360-session").slice(0, 12));
    } catch {
      setHistory([]);
    }
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parteId]);

  const addReading = () => {
    const lux = parseLux(luxInput);
    if (lux == null) {
      setIsError(true);
      setMessage("Introduce un valor de lux válido.");
      return;
    }
    setReadings((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        lux,
        label: `Punto ${current.length + 1}`,
        method: measurementMethod,
        ...(nextPoint ? { x: nextPoint.x, y: nextPoint.y } : {}),
      },
    ]);
    setLuxInput("");
    setMeasurementMethod("manual-luxmeter");
    setNextPoint(null);
    setMessage("");
    setIsError(false);
  };

  const resetSession = () => {
    setReadings([]);
    setNextPoint(null);
    setLuxInput("");
    setMeasurementMethod("manual-luxmeter");
    setMessage("");
    setIsError(false);
  };

  const saveSession = async () => {
    if (!sessionGate.ok) {
      setIsError(true);
      setMessage(sessionGate.errors.map((issue) => issue.message).join(" "));
      return;
    }

    setSaving(true);
    setMessage("");
    setIsError(false);
    try {
      const response = await fetch("/api/measurements360", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: zone.trim() || "Sesión Luz360",
          kind: "luz360-session",
          value: result.averageLux,
          unit: "lx",
          source: "calculator",
          parte_id: parteId || null,
          notes: `Luz360 · ${profile.label} · objetivo mínimo ${profile.minLux} lx`,
          metadata: {
            sourceProject: "CampoLux 360",
            method: effectiveMethod,
            zone: zone.trim() || null,
            profileId: profile.id,
            profileLabel: profile.label,
            minLux: profile.minLux,
            minUniformity: profile.minUniformity ?? null,
            readings,
            result,
            pluginWarnings: sessionGate.warnings.map((issue) => issue.message),
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo guardar la sesión.");
      setMessage("Sesión Luz360 guardada.");
      setIsError(false);
      await loadHistory();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la sesión.");
    } finally {
      setSaving(false);
    }
  };

  const loadSavedSession = (item: SavedLuxSession) => {
    const savedReadings = item.metadata?.readings;
    if (!Array.isArray(savedReadings) || savedReadings.length === 0) {
      setIsError(true);
      setMessage("Esta sesión guardada no contiene puntos recuperables.");
      return;
    }

    if (readings.length > 0 && !window.confirm("La sesión actual se sustituirá por la guardada. ¿Continuar?")) {
      return;
    }

    const savedProfileId = item.metadata?.profileId;
    if (savedProfileId && LUX_PROFILES.some((candidate) => candidate.id === savedProfileId)) {
      setProfileId(savedProfileId);
    }
    setZone(item.metadata?.zone || item.label || "");
    setParteId(item.parteId || "");
    setReadings(savedReadings);
    setNextPoint(null);
    setLuxInput("");
    setMeasurementMethod(
      item.metadata?.method === "phone-orientative" ? "phone-orientative" : "manual-luxmeter",
    );
    setIsError(false);
    setMessage("Sesión recuperada para revisión.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-amber-400/20 bg-slate-950 p-5 text-white shadow-[0_20px_70px_-30px_rgba(251,191,36,0.55)] sm:p-7">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-amber-300">
              <Sun className="h-6 w-6" />
              <span className="text-xs font-black uppercase tracking-[0.22em]">Luz360 · CampoLux</span>
            </div>
            <h1 className="text-3xl font-black sm:text-4xl">Medición profesional de iluminación</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Registra lecturas de luxómetro, analiza uniformidad y detecta puntos deficientes dentro de cada obra.
            </p>
          </div>
          <div className="flex flex-col gap-2 print:hidden">
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">
              Entrada manual profesional. El sensor del móvil no se presenta como medición certificada.
            </div>
            <a
              className="btn-secondary justify-center"
              href={buildWorkContextHref("/mediciones360", parteId)}
            >
              <Ruler className="h-4 w-4" /> Abrir Mediciones360
            </a>
            <button
              type="button"
              className="btn-secondary justify-center"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" /> Imprimir / guardar PDF
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-3 sm:p-5">
        <label className="text-xs font-bold text-slate-500">
          Parte / obra
          <select className="input-field mt-1" value={parteId} onChange={(e) => setParteId(e.target.value)}>
            <option value="">Sin parte asociado</option>
            {parts.map((part) => (
              <option key={part.id} value={part.id}>
                {part.numero} · {part.cliente}{part.direccion ? ` · ${part.direccion}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-500">
          Zona / estancia
          <input
            className="input-field mt-1"
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            placeholder="Ej. Taller · bancada 1"
            maxLength={160}
          />
        </label>
        <label className="text-xs font-bold text-slate-500">
          Perfil de referencia
          <select className="input-field mt-1" value={profileId} onChange={(e) => setProfileId(e.target.value)}>
            {LUX_PROFILES.map((item) => (
              <option key={item.id} value={item.id}>{item.label} · {item.minLux} lx</option>
            ))}
          </select>
        </label>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-500"><Gauge className="h-6 w-6" /></div>
            <div>
              <h2 className="font-black">Captura rápida</h2>
              <p className="text-xs text-slate-500">Introduce la lectura del luxómetro y pulsa añadir.</p>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              className="input-field text-lg font-black"
              inputMode="decimal"
              value={luxInput}
              onChange={(e) => {
                setLuxInput(e.target.value);
                setMeasurementMethod("manual-luxmeter");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") addReading();
              }}
              placeholder="500"
              aria-label="Lectura en lux"
            />
            <button className="btn-primary shrink-0" onClick={addReading}>
              <Plus className="h-4 w-4" /> Añadir
            </button>
          </div>

          <PhoneLuxSensor
            onReading={(lux) => {
              setLuxInput(String(lux));
              setMeasurementMethod("phone-orientative");
              setIsError(false);
              setMessage("Lectura del sensor móvil preparada como orientativa.");
            }}
          />

          <div className="mt-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Objetivo de referencia</p>
            <p className="mt-1 text-3xl font-black text-amber-500">{profile.minLux} lx</p>
            <p className="mt-1 text-xs text-slate-500">Perfil: {profile.label}</p>
          </div>

          <div className="mt-4 flex gap-2">
            <button className="btn-secondary flex-1 justify-center" onClick={resetSession}>
              <RotateCcw className="h-4 w-4" /> Nueva sesión
            </button>
            <button className="btn-success flex-1 justify-center" disabled={saving || !sessionGate.ok} onClick={saveSession}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
            </button>
          </div>

          {readings.length > 0 && sessionGate.warnings.length > 0 ? (
            <div className="mt-4 space-y-1 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-200">
              {sessionGate.warnings.map((issue) => (
                <p key={issue.plugin} className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{issue.message}</span>
                </p>
              ))}
            </div>
          ) : null}

          {message ? (
            <div className={`mt-4 flex gap-2 rounded-2xl border p-3 text-xs ${isError ? "border-red-400/30 bg-red-500/10 text-red-500" : "border-emerald-400/30 bg-emerald-500/10 text-emerald-500"}`}>
              {isError ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
              <span>{message}</span>
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-500"><Grid3X3 className="h-6 w-6" /></div>
            <div>
              <h2 className="font-black">Mapa de puntos y resultado</h2>
              <p className="text-xs text-slate-500">Verde = alcanza objetivo; rojo = punto deficiente.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Media", `${fmt(result.averageLux)} lx`],
              ["Mínimo", `${fmt(result.minLux)} lx`],
              ["Máximo", `${fmt(result.maxLux)} lx`],
              ["Uniformidad", result.totalReadings ? result.uniformity.toFixed(2) : "—"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
                <p className="mt-1 text-xl font-black">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <LuxHeatmap
              readings={readings}
              targetLux={profile.minLux}
              nextPoint={nextPoint}
              onSelectPoint={setNextPoint}
            />
            <p className="mt-2 text-xs text-slate-500">
              Toca el plano para colocar el siguiente punto. Si no colocas uno, Luz360 lo distribuye automáticamente.
            </p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {readings.map((reading, index) => {
              const ok = reading.lux >= profile.minLux;
              return (
                <div
                  key={reading.id}
                  className={`group relative rounded-2xl border p-3 text-center ${ok ? "border-emerald-400/30 bg-emerald-500/10" : "border-red-400/30 bg-red-500/10"}`}
                >
                  <p className="text-[10px] font-bold uppercase text-slate-500">
                    P{index + 1}{reading.x != null && reading.y != null ? " · ubicado" : ""}
                  </p>
                  <p className={`mt-1 text-xl font-black ${ok ? "text-emerald-500" : "text-red-500"}`}>
                    {fmt(reading.lux)} lx
                  </p>
                  <div className="absolute right-1 top-1 flex gap-1">
                    <button
                      className="rounded-lg p-1 text-slate-400 opacity-80 hover:bg-black/10 hover:text-cyan-500"
                      onClick={() => {
                        const entered = window.prompt(`Editar P${index + 1} (lux)`, String(reading.lux));
                        if (entered === null) return;
                        const lux = parseLux(entered);
                        if (lux == null) {
                          setIsError(true);
                          setMessage("Introduce un valor de lux válido.");
                          return;
                        }
                        setReadings((current) => current.map((item) => item.id === reading.id ? { ...item, lux } : item));
                        setIsError(false);
                        setMessage(`Punto P${index + 1} actualizado.`);
                      }}
                      title="Editar lectura"
                      aria-label={`Editar lectura P${index + 1}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="rounded-lg p-1 text-slate-400 opacity-80 hover:bg-black/10 hover:text-red-500"
                      onClick={() => setReadings((current) => current.filter((item) => item.id !== reading.id))}
                      title="Eliminar punto"
                      aria-label={`Eliminar punto P${index + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className={`mt-4 rounded-2xl border p-4 ${result.totalReadings === 0 ? "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950" : result.passed ? "border-emerald-400/30 bg-emerald-500/10" : "border-amber-400/30 bg-amber-500/10"}`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">Cumplimiento de puntos</p>
                <p className="mt-1 text-2xl font-black">{fmt(result.compliancePercentage)}%</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Deficientes</p>
                <p className="text-2xl font-black">{result.deficientPoints}</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <LuxReport
        part={selectedPart ? { numero: selectedPart.numero, cliente: selectedPart.cliente } : null}
        zone={zone}
        profileLabel={profile.label}
        minLux={profile.minLux}
        readings={readings}
        result={result}
        method={effectiveMethod}
      />

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4">
          <h2 className="font-black">Historial Luz360</h2>
          <p className="text-xs text-slate-500">Sesiones guardadas {parteId ? "para el parte seleccionado" : "recientemente"}.</p>
        </div>
        {history.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400 dark:border-slate-700">
            Todavía no hay sesiones Luz360 guardadas en este filtro.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {history.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-black">{item.metadata?.zone || item.label}</h3>
                    <p className="mt-1 text-xs text-slate-500">{item.metadata?.profileLabel || "Perfil Luz360"}</p>
                  </div>
                  <span className="shrink-0 rounded-xl bg-cyan-500/10 px-3 py-1 text-sm font-black text-cyan-500">
                    {fmt(item.value)} lx
                  </span>
                </div>
                <div className="mt-3 flex justify-between text-[11px] text-slate-400">
                  <span>{item.metadata?.readings?.length || 0} puntos</span>
                  <span>{item.createdAt ? new Date(item.createdAt).toLocaleString("es-ES") : ""}</span>
                </div>
                <button
                  type="button"
                  className="btn-secondary mt-3 w-full justify-center"
                  onClick={() => loadSavedSession(item)}
                >
                  <FolderOpen className="h-4 w-4" /> Recuperar sesión
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="flex gap-2 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Los perfiles incluidos son referencias de trabajo heredadas de CampoLux 360. Para informes oficiales, confirma la normativa aplicable y utiliza un luxómetro calibrado.
        </span>
      </div>
    </div>
  );
}
