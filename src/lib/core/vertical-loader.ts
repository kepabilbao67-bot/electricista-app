/**
 * AUTÓNOMO360 - Vertical Loader
 *
 * Lee APP_VERTICAL del entorno y carga la configuración correspondiente.
 * Si no está definida o es "electricista" → vertical electricista.
 * Si es "barymont" → vertical Barymont (asesoramiento financiero / CRM comercial).
 * Si es "general" → vertical General (núcleo neutral multi-oficio).
 * Si es un valor no soportado → error explícito.
 *
 * Este módulo es server-only (lee process.env).
 */

import type { Vertical, VerticalConfig } from "./types";
import { electricistaConfig } from "../verticals/electricista/config";
import { generalConfig } from "../verticals/general/config";
import { barymontConfig } from "../verticals/barymont/config";

const VALID_VERTICALS: ReadonlySet<string> = new Set([
  "electricista",
  "tecnologia",
  "general",
  "barymont",
]);

/**
 * Obtiene el identificador de vertical activa.
 */
export function getVertical(): Vertical {
  const raw = process.env.APP_VERTICAL?.trim();
  if (!raw) return "electricista";
  if (!VALID_VERTICALS.has(raw)) {
    throw new Error(
      `APP_VERTICAL inválida: "${raw}". Valores permitidos: ${Array.from(VALID_VERTICALS).join(", ")}.`
    );
  }
  return raw as Vertical;
}

/**
 * Carga la configuración completa de la vertical activa.
 */
export function loadVerticalConfig(): VerticalConfig {
  const vertical = getVertical();

  switch (vertical) {
    case "electricista":
      return electricistaConfig;
    case "barymont":
      return barymontConfig;
    case "general":
      return generalConfig;
    case "tecnologia":
      return {
        ...electricistaConfig,
        id: "tecnologia",
        brand: {
          tradeName: "Kepa360",
          shortName: "Kepa360",
          description: "Gestión profesional de servicios tecnológicos",
          themeColor: "#0f172a",
          iconKey: "cpu",
          initials: "K3",
        },
        modules: [
          "dashboard",
          "assistant",
          "clients",
          "crm",
          "leads",
          "invoices",
          "budgets",
          "expenses",
          "communications",
          "schedule",
          "catalog",
          "export",
        ],
      };
    default:
      return electricistaConfig;
  }
}
