/**
 * AUTÓNOMO360 - CRM & Commercial Pipeline
 *
 * Soporte unificado para flujos comerciales y CRM:
 * - Vertical Barymont (Prospección financiera, reuniones, propuestas, seguimiento y cierre)
 * - Vertical Electricista / General (Visitas técnicas, presupuestos y facturación)
 */

export const CRM_STAGES = [
  // Estados comerciales Barymont / General
  "nuevo",
  "contactado",
  "reunion",
  "seguimiento",
  "interesado",
  "doc_pendiente",
  "propuesta",
  "negociacion",
  "cliente",
  "no_interesado",
  "perdido",
  // Compatibilidad con estados de oficio (electricista/general)
  "visita",
  "presupuesto",
  "aceptado",
  "trabajo",
  "facturado",
  "cobrado",
] as const;

export type CrmStage = (typeof CRM_STAGES)[number];

export function isCrmStage(value: unknown): value is CrmStage {
  return typeof value === "string" && CRM_STAGES.includes(value as CrmStage);
}

export const CRM_STAGE_LABELS: Record<CrmStage, string> = {
  nuevo: "Nuevo / Lead",
  contactado: "Contactado",
  reunion: "Reunión",
  seguimiento: "En seguimiento",
  interesado: "Interesado",
  doc_pendiente: "Doc. pendiente",
  propuesta: "Propuesta enviada",
  negociacion: "Negociación",
  cliente: "Cliente / Ganado",
  no_interesado: "No interesado",
  perdido: "Perdido",
  // Oficios
  visita: "Visita técnica",
  presupuesto: "Presupuesto",
  aceptado: "Aceptado",
  trabajo: "Trabajo en curso",
  facturado: "Facturado",
  cobrado: "Cobrado",
};

export const CRM_STAGE_BADGES: Record<
  CrmStage,
  { bg: string; text: string; border: string; label: string }
> = {
  nuevo: {
    bg: "bg-blue-500/10 dark:bg-blue-500/20",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/30",
    label: "Nuevo",
  },
  contactado: {
    bg: "bg-cyan-500/10 dark:bg-cyan-500/20",
    text: "text-cyan-600 dark:text-cyan-400",
    border: "border-cyan-500/30",
    label: "Contactado",
  },
  reunion: {
    bg: "bg-indigo-500/10 dark:bg-indigo-500/20",
    text: "text-indigo-600 dark:text-indigo-400",
    border: "border-indigo-500/30",
    label: "Reunión",
  },
  seguimiento: {
    bg: "bg-amber-500/10 dark:bg-amber-500/20",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/30",
    label: "En seguimiento",
  },
  interesado: {
    bg: "bg-teal-500/10 dark:bg-teal-500/20",
    text: "text-teal-600 dark:text-teal-400",
    border: "border-teal-500/30",
    label: "Interesado",
  },
  doc_pendiente: {
    bg: "bg-orange-500/10 dark:bg-orange-500/20",
    text: "text-orange-600 dark:text-orange-400",
    border: "border-orange-500/30",
    label: "Doc. pendiente",
  },
  propuesta: {
    bg: "bg-purple-500/10 dark:bg-purple-500/20",
    text: "text-purple-600 dark:text-purple-400",
    border: "border-purple-500/30",
    label: "Propuesta",
  },
  negociacion: {
    bg: "bg-fuchsia-500/10 dark:bg-fuchsia-500/20",
    text: "text-fuchsia-600 dark:text-fuchsia-400",
    border: "border-fuchsia-500/30",
    label: "Negociación",
  },
  cliente: {
    bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/30",
    label: "Cliente",
  },
  no_interesado: {
    bg: "bg-slate-500/10 dark:bg-slate-500/20",
    text: "text-slate-600 dark:text-slate-400",
    border: "border-slate-500/30",
    label: "No interesado",
  },
  perdido: {
    bg: "bg-rose-500/10 dark:bg-rose-500/20",
    text: "text-rose-600 dark:text-rose-400",
    border: "border-rose-500/30",
    label: "Perdido",
  },
  visita: {
    bg: "bg-amber-500/10",
    text: "text-amber-600",
    border: "border-amber-500/30",
    label: "Visita",
  },
  presupuesto: {
    bg: "bg-purple-500/10",
    text: "text-purple-600",
    border: "border-purple-500/30",
    label: "Presupuesto",
  },
  aceptado: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-600",
    border: "border-emerald-500/30",
    label: "Aceptado",
  },
  trabajo: {
    bg: "bg-blue-500/10",
    text: "text-blue-600",
    border: "border-blue-500/30",
    label: "Trabajo",
  },
  facturado: {
    bg: "bg-cyan-500/10",
    text: "text-cyan-600",
    border: "border-cyan-500/30",
    label: "Facturado",
  },
  cobrado: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-600",
    border: "border-emerald-500/30",
    label: "Cobrado",
  },
};

/**
 * Pipeline comercial principal estructurado para Barymont / Ventas consultivas
 */
export const BARYMONT_PIPELINE_STAGES: readonly CrmStage[] = [
  "nuevo",
  "contactado",
  "reunion",
  "seguimiento",
  "doc_pendiente",
  "propuesta",
  "negociacion",
  "cliente",
  "perdido",
] as const;

/**
 * Probabilidad de cierre predeterminada por etapa (%)
 */
export const STAGE_PROBABILITIES: Record<CrmStage, number> = {
  nuevo: 10,
  contactado: 20,
  reunion: 40,
  seguimiento: 50,
  interesado: 60,
  doc_pendiente: 70,
  propuesta: 80,
  negociacion: 90,
  cliente: 100,
  no_interesado: 0,
  perdido: 0,
  visita: 35,
  presupuesto: 60,
  aceptado: 90,
  trabajo: 95,
  facturado: 99,
  cobrado: 100,
};

export type CrmActivityType =
  | "llamada"
  | "reunion"
  | "mensaje"
  | "email"
  | "tarea"
  | "nota"
  | "documento";

export const CRM_ACTIVITY_LABELS: Record<CrmActivityType, string> = {
  llamada: "Llamada telefónica",
  reunion: "Reunión / Cita",
  mensaje: "WhatsApp / Mensaje",
  email: "Correo electrónico",
  tarea: "Tarea realizada",
  nota: "Nota comercial",
  documento: "Documentación",
};

/**
 * Métricas escalares que consume el Centro Comercial (home y /crm).
 *
 * GET /api/comercial entrega colecciones (`pendingDocs`, `todayTasks`,
 * `upcomingMeetings`, ...) y KPIs agrupados en `kpis`. Las páginas necesitan
 * números: convertir la respuesta con `normalizeCommercialMetrics()` es
 * obligatorio, porque React no puede renderizar un objeto ni un array de
 * objetos como hijo (provocaba el error de boundary en la home).
 */
export interface CommercialMetrics {
  totalClients: number;
  openOpportunities: number;
  pipelineValue: number;
  pendingTasks: number;
  todayTasks: number;
  overdueFollowUps: number;
  hotOpportunities: number;
  pendingDocs: number;
  upcomingMeetings: number;
  closedWonCount: number;
}

function toCount(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Convierte la respuesta cruda de GET /api/comercial en `CommercialMetrics`.
 * Es tolerante a payloads inesperados: nunca devuelve objetos ni arrays, así
 * que ninguna vista puede romper el render por un cambio de forma de la API.
 */
export function normalizeCommercialMetrics(raw: unknown): CommercialMetrics {
  const source = (raw ?? {}) as Record<string, unknown>;
  const kpis = (source.kpis ?? {}) as Record<string, unknown>;
  const pendingDocs = (source.pendingDocs ?? {}) as Record<string, unknown>;

  return {
    totalClients: toCount(kpis.totalClients),
    openOpportunities: toCount(kpis.openOpportunities),
    pipelineValue: toCount(kpis.openOpportunitiesValue),
    pendingTasks: toCount(source.todayTasks),
    todayTasks: toCount(source.todayTasks),
    overdueFollowUps: toCount(source.overdueFollowUps),
    hotOpportunities: toCount(source.hotOpportunities),
    pendingDocs: toCount(pendingDocs.clients) + toCount(pendingDocs.opportunities),
    upcomingMeetings: toCount(source.upcomingMeetings),
    closedWonCount: toCount(kpis.closedWonCount),
  };
}

/**
 * Valor ponderado del pipeline usando la probabilidad real de cada
 * oportunidad y, si no la trae, la probabilidad por defecto de su etapa.
 */
export function weightedPipelineValue(
  opportunities: ReadonlyArray<{
    stage?: string | null;
    estimated_value?: unknown;
    probability?: unknown;
  }>
): number {
  return opportunities.reduce((acc, opportunity) => {
    const value = Number(opportunity?.estimated_value ?? 0) || 0;
    const explicit = Number(opportunity?.probability);
    const fallback = STAGE_PROBABILITIES[opportunity?.stage as CrmStage] ?? 0;
    const probability = Number.isFinite(explicit) && explicit > 0 ? explicit : fallback;
    return acc + value * (probability / 100);
  }, 0);
}
