"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calculator,
  Camera,
  Hash,
  Plus,
  RotateCcw,
  Ruler,
  ScanLine,
  Save,
  Loader2,
  CheckCircle2,
  FolderOpen,
  Zap,
} from "lucide-react";
import {
  areaCirculo,
  areaRectangulo,
  distanceCm,
  perimetroRectangulo,
  scaleFromReference,
  volumenCilindro,
  volumenPrisma,
  type LengthUnit,
  type Point,
} from "@/lib/autonomo360/measurements";
import {
  buildWorkContextHref,
  getParteIdFromSearch,
  replaceParteIdInCurrentUrl,
} from "@/lib/measurements360/work-context";
import {
  validateCalculatorInput,
  type MeasurementCalcMode as CalcMode,
} from "@/lib/measurements360/validation";

const MODES: { value: CalcMode; label: string }[] = [
  { value: "perimeter", label: "Perímetro rectangular" },
  { value: "area", label: "Superficie rectangular" },
  { value: "volume", label: "Volumen rectangular" },
  { value: "circle", label: "Superficie circular" },
  { value: "cylinder", label: "Volumen cilíndrico" },
  { value: "sum", label: "Suma de longitudes" },
  { value: "cable", label: "Cable + reserva" },
];

const EMPTY_COUNTS: Record<string, number> = {
  "Puntos de luz": 0,
  "Bases / enchufes": 0,
  Interruptores: 0,
  "Cajas / registros": 0,
};

interface WorkOption {
  id: string;
  numero: string;
  cliente: string;
  direccion?: string | null;
}

interface SavedMeasurement {
  id: string;
  label: string;
  kind: string;
  value: number;
  unit: string;
  source: "calculator" | "camera" | "counter";
  parteId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

function safeNumber(value: string): number {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function fmt(value: number): string {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 3 }).format(value);
}

export default function Mediciones360Page() {
  const [mode, setMode] = useState<CalcMode>("perimeter");
  const [unit, setUnit] = useState<LengthUnit>("m");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [c, setC] = useState("");
  const [reserve, setReserve] = useState("10");
  const [counts, setCounts] = useState<Record<string, number>>(() => ({ ...EMPTY_COUNTS }));
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [referenceCm, setReferenceCm] = useState("10");
  const [referencePoints, setReferencePoints] = useState<Point[]>([]);
  const [measurePoints, setMeasurePoints] = useState<Point[]>([]);
  const [parts, setParts] = useState<WorkOption[]>([]);
  const [parteId, setParteId] = useState("");
  const [workContextReady, setWorkContextReady] = useState(false);
  const [recordLabel, setRecordLabel] = useState("");
  const [savedMeasurements, setSavedMeasurements] = useState<SavedMeasurement[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    setParteId(getParteIdFromSearch(window.location.search));
    setWorkContextReady(true);
  }, []);

  useEffect(() => {
    if (!workContextReady) return;
    replaceParteIdInCurrentUrl(parteId);
  }, [parteId, workContextReady]);

  const calc = useMemo(() => {
    const av = safeNumber(a);
    const bv = safeNumber(b);
    const cv = safeNumber(c);

    switch (mode) {
      case "perimeter":
        return { label: "Perímetro", value: perimetroRectangulo(av, bv), suffix: unit };
      case "area":
        return { label: "Superficie", value: areaRectangulo(av, bv), suffix: `${unit}²` };
      case "volume":
        return { label: "Volumen", value: volumenPrisma(av, bv, cv), suffix: `${unit}³` };
      case "circle":
        return { label: "Superficie", value: areaCirculo(av), suffix: `${unit}²` };
      case "cylinder":
        return { label: "Volumen", value: volumenCilindro(av, bv), suffix: `${unit}³` };
      case "sum":
        return { label: "Longitud total", value: av + bv + cv, suffix: unit };
      case "cable":
        return {
          label: "Cable recomendado",
          value: av * (1 + safeNumber(reserve) / 100),
          suffix: unit,
        };
    }
  }, [a, b, c, mode, reserve, unit]);

  const calcValidation = useMemo(
    () => validateCalculatorInput(mode, { a, b, c, reserve }),
    [a, b, c, mode, reserve],
  );

  const photoMeasurement = useMemo(() => {
    if (referencePoints.length !== 2 || measurePoints.length !== 2) return null;
    const knownCm = safeNumber(referenceCm);
    if (knownCm <= 0) return null;

    const refPx = distanceCm(referencePoints[0], referencePoints[1], 1);
    if (refPx <= 0) return null;

    const scale = scaleFromReference(refPx, knownCm);
    return distanceCm(measurePoints[0], measurePoints[1], scale);
  }, [measurePoints, referenceCm, referencePoints]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/trabajos?days=3650")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("No se pudieron cargar los partes."))))
      .then((payload) => {
        if (!cancelled && Array.isArray(payload.trabajos)) {
          setParts(payload.trabajos);
        }
      })
      .catch(() => {
        if (!cancelled) setParts([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ limit: "20" });
    if (parteId) params.set("parte_id", parteId);

    fetch(`/api/measurements360?${params.toString()}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("No se pudieron cargar las mediciones."))))
      .then((payload) => {
        if (!cancelled) {
          setSavedMeasurements(Array.isArray(payload.records) ? payload.records : []);
        }
      })
      .catch(() => {
        if (!cancelled) setSavedMeasurements([]);
      });

    return () => {
      cancelled = true;
    };
  }, [parteId]);

  const handleImagePoint = (event: React.MouseEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    const rect = image.getBoundingClientRect();
    const point = {
      x: ((event.clientX - rect.left) / rect.width) * image.naturalWidth,
      y: ((event.clientY - rect.top) / rect.height) * image.naturalHeight,
    };

    if (referencePoints.length < 2) {
      setReferencePoints([...referencePoints, point]);
      return;
    }
    if (measurePoints.length < 2) {
      setMeasurePoints([...measurePoints, point]);
      return;
    }
    setMeasurePoints([point]);
  };

  const resetPhotoPoints = () => {
    setReferencePoints([]);
    setMeasurePoints([]);
  };

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  const updateCount = (key: string, delta: number) => {
    setCounts((current) => ({ ...current, [key]: Math.max(0, current[key] + delta) }));
  };

  const totalCount = Object.values(counts).reduce((sum, value) => sum + value, 0);

  const reuseSavedMeasurement = (item: SavedMeasurement) => {
    if (item.source === "calculator") {
      if (!MODES.some((candidate) => candidate.value === item.kind)) {
        setSaveError(true);
        setSaveMessage("Este cálculo antiguo no se puede reutilizar con la versión actual.");
        return;
      }
      const metadata = item.metadata ?? {};
      const inputUnit = metadata.inputUnit;
      setMode(item.kind as CalcMode);
      if (inputUnit === "mm" || inputUnit === "cm" || inputUnit === "m") setUnit(inputUnit);
      const asText = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? String(value) : "";
      setA(asText(metadata.a));
      setB(asText(metadata.b));
      setC(asText(metadata.c));
      if (typeof metadata.reservePercent === "number" && Number.isFinite(metadata.reservePercent)) {
        setReserve(String(metadata.reservePercent));
      }
      setRecordLabel(item.label);
      setSaveError(false);
      setSaveMessage("Cálculo recuperado para reutilizar.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (item.source === "counter") {
      const rawCounts = item.metadata?.counts;
      if (!rawCounts || typeof rawCounts !== "object" || Array.isArray(rawCounts)) {
        setSaveError(true);
        setSaveMessage("Este conteo antiguo no contiene detalle recuperable.");
        return;
      }
      const source = rawCounts as Record<string, unknown>;
      const restored = Object.fromEntries(
        Object.keys(EMPTY_COUNTS).map((key) => {
          const value = Number(source[key]);
          return [key, Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0];
        }),
      ) as Record<string, number>;
      setCounts(restored);
      setRecordLabel(item.label);
      setSaveError(false);
      setSaveMessage("Conteo recuperado para reutilizar.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const pointStyle = (point: Point) => ({
    left: `${(point.x / Math.max(imageSize.width, 1)) * 100}%`,
    top: `${(point.y / Math.max(imageSize.height, 1)) * 100}%`,
  });

  const saveMeasurement = async (payload: {
    label: string;
    kind: string;
    value: number;
    unit: string;
    source: "calculator" | "camera" | "counter";
    metadata?: Record<string, unknown>;
  }) => {
    setSaving(true);
    setSaveMessage("");
    setSaveError(false);

    try {
      const response = await fetch("/api/measurements360", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          parte_id: parteId || null,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "No se pudo guardar la medición.");
      }

      setSavedMeasurements((current) => [body, ...current.filter((item) => item.id !== body.id)].slice(0, 20));
      setSaveMessage(parteId ? "Medición guardada en el parte." : "Medición guardada.");
      setSaveError(false);
      setRecordLabel("");
    } catch (error) {
      setSaveError(true);
      setSaveMessage(error instanceof Error ? error.message : "No se pudo guardar la medición.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-slate-950 p-5 text-white shadow-[0_20px_70px_-30px_rgba(34,211,238,0.65)] sm:p-7">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-blue-600/25 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-cyan-300">
              <ScanLine className="h-5 w-5" />
              <span className="text-xs font-black uppercase tracking-[0.22em]">Mediciones360</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Medir, calcular y contar en obra</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Calculadora profesional, conteo eléctrico y medición visual calibrada desde cámara. Diseñado para trabajar rápido desde móvil o PC.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <a
              className="btn-secondary justify-center"
              href={buildWorkContextHref("/luz360", parteId)}
            >
              <Zap className="h-4 w-4" /> Abrir Luz360
            </a>
            <div className="grid grid-cols-2 gap-2 text-center text-xs font-bold sm:grid-cols-3">
            <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-3 text-blue-200">Cálculo</div>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-emerald-200">Conteo</div>
            <div className="col-span-2 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-cyan-200 sm:col-span-1">Cámara</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 rounded-3xl border border-cyan-400/20 bg-white p-4 shadow-sm dark:bg-slate-900 sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:p-5">
        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
          Asociar a parte / obra
          <select className="input-field mt-1" value={parteId} onChange={(e) => setParteId(e.target.value)}>
            <option value="">Sin parte · medición general</option>
            {parts.map((part) => (
              <option key={part.id} value={part.id}>
                {part.numero} · {part.cliente}{part.direccion ? ` · ${part.direccion}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
          Nombre de la medición
          <input
            className="input-field mt-1"
            value={recordLabel}
            onChange={(e) => setRecordLabel(e.target.value)}
            placeholder="Ej. Salón · perímetro"
            maxLength={160}
          />
        </label>
        <div className="min-h-11 min-w-44 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold dark:border-slate-800 dark:bg-slate-950">
          {saveMessage ? (
            <span className={`flex items-center gap-2 ${saveError ? "text-red-500" : "text-emerald-500"}`}>
              {saveError ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} {saveMessage}
            </span>
          ) : (
            <span className="text-slate-500">Selecciona parte si procede</span>
          )}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-blue-600/10 p-3 text-blue-500"><Calculator className="h-6 w-6" /></div>
            <div>
              <h2 className="text-lg font-black">Calculadora profesional</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Resultados instantáneos y deterministas.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Operación
              <select className="input-field mt-1" value={mode} onChange={(e) => setMode(e.target.value as CalcMode)}>
                {MODES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Unidad
              <select className="input-field mt-1" value={unit} onChange={(e) => setUnit(e.target.value as LengthUnit)}>
                <option value="mm">mm</option>
                <option value="cm">cm</option>
                <option value="m">m</option>
              </select>
            </label>
          </div>

          <div className={`mt-4 grid gap-3 ${
            mode === "circle"
              ? "sm:grid-cols-1"
              : ["volume", "sum"].includes(mode)
                ? "sm:grid-cols-3"
                : "sm:grid-cols-2"
          }`}>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {mode === "circle" || mode === "cylinder" ? "Radio" : mode === "cable" ? "Longitud base" : "Medida A"}
              <input className="input-field mt-1" inputMode="decimal" value={a} onChange={(e) => setA(e.target.value)} placeholder="0" />
            </label>
            {mode !== "circle" ? (
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {mode === "cylinder" ? "Altura" : mode === "cable" ? "Reserva %" : "Medida B"}
                {mode === "cable"
                  ? <input className="input-field mt-1" inputMode="decimal" value={reserve} onChange={(e) => setReserve(e.target.value)} placeholder="10" />
                  : <input className="input-field mt-1" inputMode="decimal" value={b} onChange={(e) => setB(e.target.value)} placeholder="0" />}
              </label>
            ) : null}
            {["volume", "sum"].includes(mode) ? (
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Medida C
                <input className="input-field mt-1" inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} placeholder="0" />
              </label>
            ) : null}
          </div>

          <div className="mt-5 rounded-3xl border border-blue-400/20 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">{calc.label}</p>
            <p className="mt-2 text-4xl font-black text-white">{fmt(calc.value)} <span className="text-xl text-emerald-300">{calc.suffix}</span></p>
            {!calcValidation.ok ? (
              <p className="mt-3 flex items-center gap-2 text-xs font-bold text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0" /> {calcValidation.message}
              </p>
            ) : (
              <p className="mt-3 text-xs font-bold text-emerald-300">Listo para guardar.</p>
            )}
          </div>
          <button
            className="btn-primary mt-4 w-full justify-center"
            disabled={saving || !calcValidation.ok}
            onClick={() => saveMeasurement({
              label: recordLabel.trim() || calc.label,
              kind: mode,
              value: calc.value,
              unit: calc.suffix,
              source: "calculator",
              metadata: {
                inputUnit: unit,
                a: safeNumber(a),
                b: safeNumber(b),
                c: safeNumber(c),
                reservePercent: safeNumber(reserve),
              },
            })}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar cálculo
          </button>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-500"><Hash className="h-6 w-6" /></div>
              <div>
                <h2 className="text-lg font-black">Conteo eléctrico</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Puntos, mecanismos, cajas y registros.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:text-emerald-500 dark:border-slate-700"
                onClick={() => setCounts({ ...EMPTY_COUNTS })}
                disabled={totalCount === 0}
                title="Reiniciar conteo"
                aria-label="Reiniciar conteo"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <span className="rounded-2xl bg-emerald-500/10 px-4 py-2 text-2xl font-black text-emerald-500">{totalCount}</span>
            </div>
          </div>

          <div className="space-y-3">
            {Object.entries(counts).map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                <span className="text-sm font-bold">{label}</span>
                <div className="flex items-center gap-2">
                  <button className="h-10 w-10 rounded-xl bg-slate-100 text-lg font-black dark:bg-slate-800" onClick={() => updateCount(label, -1)}>-</button>
                  <span className="w-10 text-center text-xl font-black">{value}</span>
                  <button className="h-10 w-10 rounded-xl bg-emerald-500 text-lg font-black text-slate-950" onClick={() => updateCount(label, 1)}>+</button>
                </div>
              </div>
            ))}
          </div>
          <button
            className="btn-success mt-4 w-full justify-center"
            disabled={saving || totalCount === 0}
            onClick={() => saveMeasurement({
              label: recordLabel.trim() || "Conteo eléctrico",
              kind: "electrical-count",
              value: totalCount,
              unit: "ud",
              source: "counter",
              metadata: { counts },
            })}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar conteo
          </button>
        </section>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-500"><Camera className="h-6 w-6" /></div>
            <div>
              <h2 className="text-lg font-black">Cámara integral · medición visual</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Calibra con una referencia conocida y marca dos puntos a medir.</p>
            </div>
          </div>
          <label className="btn-primary cursor-pointer">
            <Camera className="h-4 w-4" /> Abrir cámara / foto
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                e.currentTarget.value = "";
                if (!file.type.startsWith("image/")) {
                  setSaveError(true);
                  setSaveMessage("Selecciona un archivo de imagen válido.");
                  return;
                }
                if (file.size > 12 * 1024 * 1024) {
                  setSaveError(true);
                  setSaveMessage("La imagen supera 12 MB. Usa una foto más ligera.");
                  return;
                }
                if (photoUrl) URL.revokeObjectURL(photoUrl);
                setPhotoUrl(URL.createObjectURL(file));
                resetPhotoPoints();
                setSaveMessage("");
                setSaveError(false);
              }}
            />
          </label>
        </div>

        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <div className="space-y-4">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Longitud real de referencia (cm)
              <input className="input-field mt-1" inputMode="decimal" value={referenceCm} onChange={(e) => setReferenceCm(e.target.value)} />
            </label>
            <ol className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <li><strong className="text-blue-500">1.</strong> Haz 2 clics sobre la referencia conocida.</li>
              <li><strong className="text-emerald-500">2.</strong> Haz 2 clics sobre la distancia que quieres medir.</li>
              <li><strong className="text-cyan-500">3.</strong> Lee el resultado calibrado.</li>
            </ol>
            <button className="btn-secondary w-full justify-center" onClick={resetPhotoPoints}><RotateCcw className="h-4 w-4" /> Reiniciar puntos</button>

            <div className="rounded-2xl border border-cyan-400/20 bg-slate-950 p-4 text-white">
              <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Medida visual</p>
              <p className="mt-2 text-3xl font-black">{photoMeasurement == null ? "—" : `${fmt(photoMeasurement)} cm`}</p>
            </div>
            <button
              className="btn-primary w-full justify-center"
              disabled={saving || photoMeasurement == null}
              onClick={() => {
                if (photoMeasurement == null) return;
                saveMeasurement({
                  label: recordLabel.trim() || "Medición visual",
                  kind: "camera-distance",
                  value: photoMeasurement,
                  unit: "cm",
                  source: "camera",
                  metadata: {
                    referenceCm: safeNumber(referenceCm),
                    referencePoints,
                    measurePoints,
                  },
                });
              }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar medida visual
            </button>

            <div className="flex gap-2 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>La cámara ofrece una estimación calibrada. Para precisión profesional, la referencia y el objeto deben estar en el mismo plano; valida medidas críticas con láser o cinta.</span>
            </div>
          </div>

          <div className="flex min-h-72 items-center justify-center overflow-hidden rounded-3xl border border-slate-800 bg-slate-950">
            {photoUrl ? (
              <div className="relative inline-block max-w-full">
                <img
                  src={photoUrl}
                  alt="Fotografía para medición"
                  className="block h-auto max-h-[620px] max-w-full cursor-crosshair"
                  onLoad={(e) => setImageSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
                  onClick={handleImagePoint}
                />
                {[...referencePoints.map((p) => ({ p, color: "bg-blue-500", ring: "ring-blue-300" })), ...measurePoints.map((p) => ({ p, color: "bg-emerald-400", ring: "ring-emerald-200" }))].map((item, index) => (
                  <span
                    key={index}
                    className={`pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full ${item.color} ring-4 ${item.ring}/40 shadow-lg`}
                    style={pointStyle(item.p)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center text-slate-400">
                <Ruler className="mb-4 h-12 w-12 text-cyan-400" />
                <p className="font-bold text-slate-200">Abre la cámara o selecciona una foto</p>
                <p className="mt-1 max-w-md text-xs">La imagen se procesa localmente en esta pantalla; no se sube automáticamente.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">Mediciones guardadas</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {parteId ? "Mostrando el historial del parte seleccionado." : "Últimas mediciones generales y de obra."}
            </p>
          </div>
          <span className="rounded-xl bg-cyan-500/10 px-3 py-2 text-sm font-black text-cyan-600 dark:text-cyan-300">
            {savedMeasurements.length}
          </span>
        </div>

        {savedMeasurements.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
            Todavía no hay mediciones guardadas en este filtro.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {savedMeasurements.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-black">{item.label}</h3>
                    <p className="mt-1 text-xs uppercase tracking-wider text-slate-400">{item.kind} · {item.source}</p>
                  </div>
                  <span className="shrink-0 rounded-xl bg-emerald-500/10 px-3 py-1 text-sm font-black text-emerald-600 dark:text-emerald-300">
                    {fmt(item.value)} {item.unit}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-slate-400">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString("es-ES") : ""}
                  </p>
                  {item.source !== "camera" ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 hover:border-cyan-400 hover:text-cyan-600 dark:border-slate-700 dark:text-slate-300"
                      onClick={() => reuseSavedMeasurement(item)}
                    >
                      <FolderOpen className="h-3.5 w-3.5" /> Reutilizar
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Ruler, title: "Medir", text: "Longitudes, perímetros, áreas y volúmenes", tone: "text-blue-500" },
          { icon: Plus, title: "Sumar", text: "Suma lineal y reserva automática de cable", tone: "text-emerald-500" },
          { icon: Zap, title: "Contar", text: "Puntos eléctricos y mecanismos en obra", tone: "text-cyan-500" },
        ].map(({ icon: Icon, title, text, tone }) => (
          <div key={title} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <Icon className={`h-5 w-5 ${tone}`} />
            <h3 className="mt-2 font-black">{title}</h3>
            <p className="mt-1 text-xs text-slate-500">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
