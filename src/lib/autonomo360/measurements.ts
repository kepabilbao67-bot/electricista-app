/**
 * MEDICIONES 360 — Modelo de datos y cálculos deterministas
 *
 * Módulo reutilizable para cualquier oficio/profesión.
 * Todas las funciones son puras y sin efectos secundarios.
 * Unidad base interna: milímetros (para enteros y evitar errores de coma flotante).
 */

// --- Unidades ---

export type LengthUnit = "mm" | "cm" | "m";
export type AreaUnit = "mm2" | "cm2" | "m2";
export type VolumeUnit = "mm3" | "cm3" | "m3";

// --- Conversiones de longitud ---

const MM_PER: Record<LengthUnit, number> = { mm: 1, cm: 10, m: 1000 };

/**
 * Convierte una longitud de una unidad a otra.
 */
export function convertLength(value: number, from: LengthUnit, to: LengthUnit): number {
  if (from === to) return value;
  const mm = value * MM_PER[from];
  return mm / MM_PER[to];
}

/**
 * Convierte a milímetros.
 */
export function toMm(value: number, unit: LengthUnit): number {
  return value * MM_PER[unit];
}

/**
 * Convierte desde milímetros.
 */
export function fromMm(mm: number, unit: LengthUnit): number {
  return mm / MM_PER[unit];
}

// --- Cálculos geométricos ---

/**
 * Perímetro de un rectángulo.
 * @param largo - longitud del lado mayor
 * @param ancho - longitud del lado menor
 * @returns perímetro en la misma unidad
 */
export function perimetroRectangulo(largo: number, ancho: number): number {
  if (largo < 0 || ancho < 0) throw new Error("Las dimensiones no pueden ser negativas.");
  return 2 * (largo + ancho);
}

/**
 * Área de un rectángulo.
 */
export function areaRectangulo(largo: number, ancho: number): number {
  if (largo < 0 || ancho < 0) throw new Error("Las dimensiones no pueden ser negativas.");
  return largo * ancho;
}

/**
 * Área de un triángulo (base × altura / 2).
 */
export function areaTriangulo(base: number, altura: number): number {
  if (base < 0 || altura < 0) throw new Error("Las dimensiones no pueden ser negativas.");
  return (base * altura) / 2;
}

/**
 * Área de un círculo.
 */
export function areaCirculo(radio: number): number {
  if (radio < 0) throw new Error("El radio no puede ser negativo.");
  return Math.PI * radio * radio;
}

/**
 * Volumen de un prisma rectangular (largo × ancho × alto).
 */
export function volumenPrisma(largo: number, ancho: number, alto: number): number {
  if (largo < 0 || ancho < 0 || alto < 0) throw new Error("Las dimensiones no pueden ser negativas.");
  return largo * ancho * alto;
}

/**
 * Volumen de un cilindro.
 */
export function volumenCilindro(radio: number, alto: number): number {
  if (radio < 0 || alto < 0) throw new Error("Las dimensiones no pueden ser negativas.");
  return Math.PI * radio * radio * alto;
}

// --- Pendiente y caída ---

/**
 * Calcula la pendiente en porcentaje.
 * @param desnivel - diferencia de altura (vertical)
 * @param distanciaHorizontal - distancia horizontal
 * @returns pendiente en % (ej: 2.5 significa 2.5%)
 */
export function pendientePorcentaje(desnivel: number, distanciaHorizontal: number): number {
  if (distanciaHorizontal === 0) throw new Error("La distancia horizontal no puede ser cero.");
  return (desnivel / distanciaHorizontal) * 100;
}

/**
 * Calcula la pendiente en grados.
 */
export function pendienteGrados(desnivel: number, distanciaHorizontal: number): number {
  if (distanciaHorizontal === 0) throw new Error("La distancia horizontal no puede ser cero.");
  return Math.atan(desnivel / distanciaHorizontal) * (180 / Math.PI);
}

/**
 * Caída por metro lineal dado un porcentaje de pendiente.
 * @param pendientePct - pendiente en % (ej: 2 = 2%)
 * @returns caída en la misma unidad que la distancia (por cada metro)
 */
export function caidaPorMetro(pendientePct: number): number {
  return pendientePct / 100;
}

// --- Modelo de medición persistible ---

export interface Measurement {
  id: string;
  /** Tipo de medición */
  type: "length" | "area" | "volume" | "angle" | "slope";
  /** Descripción libre */
  description: string;
  /** Valores numéricos capturados */
  values: MeasurementValues;
  /** Resultado calculado */
  result: number;
  /** Unidad del resultado */
  resultUnit: string;
  /** Asociaciones opcionales */
  clientId?: string;
  budgetId?: string;
  workOrderId?: string;
  /** Metadatos */
  createdAt: string;
  updatedAt: string;
  /** Notas adicionales */
  notes?: string;
  /** Referencia a fotografía (ruta o id, no el binario) */
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

// --- Conversiones de área y volumen ---

/**
 * Convierte un valor de área entre unidades.
 */
export function convertArea(value: number, from: AreaUnit, to: AreaUnit): number {
  const factors: Record<AreaUnit, number> = { mm2: 1, cm2: 100, m2: 1_000_000 };
  const baseMm2 = value * factors[from];
  return baseMm2 / factors[to];
}

/**
 * Convierte un valor de volumen entre unidades.
 */
export function convertVolume(value: number, from: VolumeUnit, to: VolumeUnit): number {
  const factors: Record<VolumeUnit, number> = { mm3: 1, cm3: 1000, m3: 1_000_000_000 };
  const baseMm3 = value * factors[from];
  return baseMm3 / factors[to];
}


// --- Medición visual calibrada (reutilizada desde Mediciones360) ---

export interface Point {
  x: number;
  y: number;
}

/**
 * Calcula la escala en cm/píxel usando una referencia de longitud conocida.
 * Requiere que la referencia y el objeto estén aproximadamente en el mismo plano.
 */
export function scaleFromReference(refPx: number, refRealCm: number): number {
  if (refPx <= 0) throw new Error("La referencia en píxeles debe ser mayor que cero.");
  if (refRealCm <= 0) throw new Error("La longitud real de referencia debe ser mayor que cero.");
  return refRealCm / refPx;
}

/** Calcula la distancia euclídea entre dos puntos y la expresa en centímetros. */
export function distanceCm(a: Point, b: Point, cmPerPx: number): number {
  if (cmPerPx <= 0) throw new Error("La escala debe ser mayor que cero.");
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy) * cmPerPx;
}

/**
 * Advierte de perspectiva significativa si lados opuestos de una referencia
 * cuadrilateral difieren más de un 5 %.
 */
export function perspectiveWarning(corners: [Point, Point, Point, Point]): boolean {
  const [tl, tr, br, bl] = corners;
  const side = (p1: Point, p2: Point) => Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const top = side(tl, tr);
  const bottom = side(bl, br);
  const left = side(tl, bl);
  const right = side(tr, br);
  const horizontalBase = Math.max(top, bottom);
  const verticalBase = Math.max(left, right);
  if (horizontalBase === 0 || verticalBase === 0) return true;
  return Math.abs(top - bottom) / horizontalBase > 0.05 || Math.abs(left - right) / verticalBase > 0.05;
}
