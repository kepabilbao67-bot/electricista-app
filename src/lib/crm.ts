export const CRM_STAGES = [
  "nuevo",
  "contactado",
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
  nuevo: "Nuevo",
  contactado: "Contactado",
  visita: "Visita",
  presupuesto: "Presupuesto",
  aceptado: "Aceptado",
  trabajo: "Trabajo",
  facturado: "Facturado",
  cobrado: "Cobrado",
};
