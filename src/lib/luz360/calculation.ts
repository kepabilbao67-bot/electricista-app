export interface LuxReading {
  id: string;
  lux: number;
  label?: string;
  x?: number;
  y?: number;
  method?: "manual-luxmeter" | "phone-orientative" | "bluetooth-luxmeter";
}

export interface LuxProfile {
  id: string;
  label: string;
  minLux: number;
  minUniformity?: number;
}

export interface LuxResult {
  totalReadings: number;
  averageLux: number;
  minLux: number;
  maxLux: number;
  uniformity: number;
  deficientPoints: number;
  compliancePercentage: number;
  passed: boolean;
}

export const LUX_PROFILES: readonly LuxProfile[] = [
  { id: "circulation-occasional", label: "Circulación ocasional", minLux: 25 },
  { id: "circulation-habitual", label: "Circulación habitual", minLux: 50 },
  { id: "simple-occasional", label: "Uso ocasional · exigencia simple", minLux: 50 },
  { id: "simple-habitual", label: "Uso habitual · exigencia simple", minLux: 100 },
  { id: "moderate", label: "Exigencia visual moderada", minLux: 200 },
  { id: "high", label: "Exigencia visual alta", minLux: 500 },
  { id: "very-high", label: "Exigencia visual muy alta", minLux: 1000 },
  { id: "office", label: "Oficina / trabajo con pantalla", minLux: 500 },
  { id: "warehouse", label: "Almacén", minLux: 150 },
  { id: "workshop", label: "Taller", minLux: 300 },
] as const;

export function calculateLuxSession(
  readings: LuxReading[],
  profile: Pick<LuxProfile, "minLux" | "minUniformity">,
): LuxResult {
  const values = readings
    .map((reading) => reading.lux)
    .filter((lux) => Number.isFinite(lux) && lux >= 0);

  if (values.length === 0) {
    return {
      totalReadings: 0,
      averageLux: 0,
      minLux: 0,
      maxLux: 0,
      uniformity: 0,
      deficientPoints: 0,
      compliancePercentage: 0,
      passed: false,
    };
  }

  const minLux = Math.min(...values);
  const maxLux = Math.max(...values);
  const averageLux = values.reduce((sum, value) => sum + value, 0) / values.length;
  const uniformity = averageLux > 0 ? minLux / averageLux : 0;
  const deficientPoints = values.filter((lux) => lux < profile.minLux).length;
  const compliancePercentage = ((values.length - deficientPoints) / values.length) * 100;
  const uniformityOk = profile.minUniformity == null || uniformity >= profile.minUniformity;

  return {
    totalReadings: values.length,
    averageLux: Number(averageLux.toFixed(2)),
    minLux,
    maxLux,
    uniformity: Number(uniformity.toFixed(3)),
    deficientPoints,
    compliancePercentage: Number(compliancePercentage.toFixed(2)),
    passed: averageLux >= profile.minLux && deficientPoints === 0 && uniformityOk,
  };
}
