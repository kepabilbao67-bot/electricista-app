"use client";

import { useMemo, type MouseEvent } from "react";
import type { LuxReading } from "@/lib/luz360/calculation";
import { resolveLuxPointPosition } from "@/lib/luz360/heatmap";

interface LuxHeatmapProps {
  readings: LuxReading[];
  targetLux: number;
  nextPoint?: { x: number; y: number } | null;
  onSelectPoint?: (point: { x: number; y: number }) => void;
}

function tone(lux: number, target: number) {
  const ratio = target > 0 ? lux / target : 1;
  if (ratio >= 1) return "bg-emerald-400 text-slate-950";
  if (ratio >= 0.8) return "bg-amber-400 text-slate-950";
  return "bg-red-500 text-white";
}

export function LuxHeatmap({
  readings,
  targetLux,
  nextPoint = null,
  onSelectPoint,
}: LuxHeatmapProps) {
  const maxLux = useMemo(
    () => Math.max(1, ...readings.map((reading) => reading.lux)),
    [readings],
  );

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!onSelectPoint) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 100;
    const y = ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 100;
    onSelectPoint({
      x: Math.round(Math.min(96, Math.max(4, x)) * 10) / 10,
      y: Math.round(Math.min(94, Math.max(6, y)) * 10) / 10,
    });
  };

  return (
    <div
      className="relative min-h-[360px] overflow-hidden rounded-3xl border border-slate-800 bg-slate-950"
      onClick={handleClick}
      role={onSelectPoint ? "button" : undefined}
      tabIndex={onSelectPoint ? 0 : undefined}
      title={onSelectPoint ? "Toca para colocar el siguiente punto de medición" : undefined}
    >
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(148,163,184,.22) 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />

      {readings.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-slate-500">
          Toca la estancia para colocar el primer punto y después introduce los lux.
        </div>
      ) : null}

      {readings.map((reading, index) => {
        const position = resolveLuxPointPosition(reading, index, readings.length);
        const intensity = Math.min(1, Math.max(0.15, reading.lux / maxLux));
        return (
          <div
            key={reading.id}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${position.left}%`, top: `${position.top}%` }}
          >
            <div
              className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
              style={{ background: `rgba(34,211,238,${0.08 + intensity * 0.2})` }}
            />
            <div className={`relative flex h-12 min-w-12 items-center justify-center rounded-full border-2 border-slate-950 px-2 text-xs font-black shadow-lg ${tone(reading.lux, targetLux)}`}>
              {Math.round(reading.lux)}
            </div>
            <div className="mt-1 text-center text-[10px] font-bold text-slate-400">P{index + 1}</div>
          </div>
        );
      })}

      {nextPoint ? (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${nextPoint.x}%`, top: `${nextPoint.y}%` }}
        >
          <div className="h-8 w-8 animate-pulse rounded-full border-4 border-cyan-300 bg-cyan-400/20 shadow-[0_0_28px_rgba(34,211,238,.8)]" />
          <div className="mt-1 -translate-x-2 text-[10px] font-black text-cyan-300">SIGUIENTE</div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-wrap justify-between gap-2 rounded-2xl border border-white/10 bg-black/70 px-4 py-3 text-[11px] text-slate-300 backdrop-blur">
        <span>Verde ≥ objetivo · ámbar ≥80% · rojo &lt;80%</span>
        <span className="font-bold text-cyan-300">Objetivo {targetLux} lx</span>
      </div>
    </div>
  );
}
