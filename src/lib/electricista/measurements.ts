/**
 * ELECTRICISTA360 — Mediciones
 * Cálculos deterministas y sin efectos secundarios.
 */

export type LengthUnit = "mm" | "cm" | "m";
export type AreaUnit = "mm2" | "cm2" | "m2";
export type VolumeUnit = "mm3" | "cm3" | "m3";

const MM_PER: Record<LengthUnit, number> = { mm: 1, cm: 10, m: 1000 };

export function convertLength(value: number, from: LengthUnit, to: LengthUnit): number {
  if (from === to) return value;
  return (value * MM_PER[from]) / MM_PER[to];
}
export function toMm(value: number, unit: LengthUnit): number { return value * MM_PER[unit]; }
export function fromMm(mm: number, unit: LengthUnit): number { return mm / MM_PER[unit]; }

export function perimetroRectangulo(largo: number, ancho: number): number {
  if (largo < 0 || ancho < 0) throw new Error("Las dimensiones no pueden ser negativas.");
  return 2 * (largo + ancho);
}
export function areaRectangulo(largo: number, ancho: number): number {
  if (largo < 0 || ancho < 0) throw new Error("Las dimensiones no pueden ser negativas.");
  return largo * ancho;
}
export function areaTriangulo(base: number, altura: number): number {
  if (base < 0 || altura < 0) throw new Error("Las dimensiones no pueden ser negativas.");
  return (base * altura) / 2;
}
export function areaCirculo(radio: number): number {
  if (radio < 0) throw new Error("El radio no puede ser negativo.");
  return Math.PI * radio * radio;
}
export function volumenPrisma(largo: number, ancho: number, alto: number): number {
  if (largo < 0 || ancho < 0 || alto < 0) throw new Error("Las dimensiones no pueden ser negativas.");
  return largo * ancho * alto;
}
export function volumenCilindro(radio: number, alto: number): number {
  if (radio < 0 || alto < 0) throw new Error("Las dimensiones no pueden ser negativas.");
  return Math.PI * radio * radio * alto;
}
export function pendientePorcentaje(desnivel: number, distanciaHorizontal: number): number {
  if (distanciaHorizontal === 0) throw new Error("La distancia horizontal no puede ser cero.");
  return (desnivel / distanciaHorizontal) * 100;
}
export function pendienteGrados(desnivel: number, distanciaHorizontal: number): number {
  if (distanciaHorizontal === 0) throw new Error("La distancia horizontal no puede ser cero.");
  return Math.atan(desnivel / distanciaHorizontal) * (180 / Math.PI);
}
export function caidaPorMetro(pendientePct: number): number { return pendientePct / 100; }

export interface Measurement {
  id: string;
  type: "length" | "area" | "volume" | "angle" | "slope";
  description: string;
  values: MeasurementValues;
  result: number;
  resultUnit: string;
  clientId?: string;
  budgetId?: string;
  workOrderId?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  photoRef?: string;
}

export interface MeasurementValues {
  largo?: number;
  ancho?: number;
  alto?: number;
  profundidad?: number;
  radio?: number;
  base?: number;
  altura?: number;
  desnivel?: number;
  distanciaHorizontal?: number;
  angulo?: number;
  unit?: LengthUnit;
}

export function convertArea(value: number, from: AreaUnit, to: AreaUnit): number {
  const factors: Record<AreaUnit, number> = { mm2: 1, cm2: 100, m2: 1_000_000 };
  return (value * factors[from]) / factors[to];
}
export function convertVolume(value: number, from: VolumeUnit, to: VolumeUnit): number {
  const factors: Record<VolumeUnit, number> = { mm3: 1, cm3: 1000, m3: 1_000_000_000 };
  return (value * factors[from]) / factors[to];
}
