"use client";

import type { LuxReading, LuxResult } from "@/lib/luz360/calculation";

interface LuxReportProps {
  part: { numero: string; cliente: string } | null;
  zone: string;
  profileLabel: string;
  minLux: number;
  readings: LuxReading[];
  result: LuxResult;
  method: "manual-luxmeter" | "phone-orientative" | "bluetooth-luxmeter";
}

function fmt(value: number, digits = 0) {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: digits }).format(value);
}

export function LuxReport({
  part,
  zone,
  profileLabel,
  minLux,
  readings,
  result,
  method,
}: LuxReportProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:border-black print:shadow-none">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-500">Informe Luz360</p>
          <h2 className="mt-1 text-xl font-black">Resumen de iluminación</h2>
        </div>
        <span className={`rounded-xl px-3 py-2 text-xs font-black ${result.totalReadings === 0 ? "bg-slate-100 text-slate-500" : result.passed ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
          {result.totalReadings === 0 ? "SIN MEDICIONES" : result.passed ? "OBJETIVO CUMPLIDO" : "PUNTOS POR REVISAR"}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Parte / obra", part ? `${part.numero} · ${part.cliente}` : "Sin parte asociado"],
          ["Zona", zone.trim() || "Sin nombre"],
          ["Perfil", profileLabel],
          ["Objetivo", `${minLux} lx`],
          ["Método", method === "phone-orientative" ? "Sensor móvil · orientativo" : method === "bluetooth-luxmeter" ? "Luxómetro Bluetooth" : "Luxómetro manual"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
            <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
            <p className="mt-1 text-sm font-black">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-950">
            <tr>
              <th className="p-3">Punto</th>
              <th className="p-3">Lux</th>
              <th className="p-3">Posición</th>
              <th className="p-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {readings.map((reading, index) => (
              <tr key={reading.id} className="border-t border-slate-200 dark:border-slate-800">
                <td className="p-3 font-bold">P{index + 1}</td>
                <td className="p-3">{fmt(reading.lux)} lx</td>
                <td className="p-3">
                  {reading.x != null && reading.y != null
                    ? `${reading.x.toFixed(1)}% · ${reading.y.toFixed(1)}%`
                    : "Rejilla automática"}
                </td>
                <td className={`p-3 font-black ${reading.lux >= minLux ? "text-emerald-600" : "text-red-600"}`}>
                  {reading.lux >= minLux ? "OK" : "DEFICIENTE"}
                </td>
              </tr>
            ))}
            {readings.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-slate-400">Aún no hay lecturas.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950"><span className="text-xs text-slate-500">Media</span><p className="font-black">{fmt(result.averageLux)} lx</p></div>
        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950"><span className="text-xs text-slate-500">Mínimo</span><p className="font-black">{fmt(result.minLux)} lx</p></div>
        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950"><span className="text-xs text-slate-500">Uniformidad</span><p className="font-black">{result.totalReadings ? result.uniformity.toFixed(3) : "—"}</p></div>
        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950"><span className="text-xs text-slate-500">Cumplimiento</span><p className="font-black">{fmt(result.compliancePercentage)}%</p></div>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        {method === "phone-orientative"
          ? "Incluye lectura orientativa del sensor del móvil; no debe utilizarse como medición certificada. "
          : method === "bluetooth-luxmeter"
            ? "Lecturas registradas mediante luxómetro Bluetooth. "
            : "Lecturas registradas mediante luxómetro manual. "}
        El resultado indica el cumplimiento del objetivo configurado en esta sesión y no sustituye la verificación de la normativa aplicable ni la calibración del instrumento.
      </p>
    </section>
  );
}
