import type { LuxReading } from "./calculation";

export interface LuxPointPosition {
  left: number;
  top: number;
}

export function clampPercent(value: number, min = 4, max = 96): number {
  return Math.min(max, Math.max(min, value));
}

export function resolveLuxPointPosition(
  reading: LuxReading,
  index: number,
  total: number,
): LuxPointPosition {
  if (Number.isFinite(reading.x) && Number.isFinite(reading.y)) {
    return {
      left: clampPercent(Number(reading.x)),
      top: clampPercent(Number(reading.y), 6, 94),
    };
  }

  const columns = Math.max(2, Math.ceil(Math.sqrt(Math.max(total, 1))));
  const rows = Math.max(1, Math.ceil(total / columns));
  const row = Math.floor(index / columns);
  const column = index % columns;

  return {
    left: ((column + 1) / (columns + 1)) * 100,
    top: ((row + 1) / (rows + 1)) * 100,
  };
}
