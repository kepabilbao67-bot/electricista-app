/**
 * AUTÓNOMO360 — Company Profile Loader (SaaS White-Label)
 *
 * Carga el perfil de empresa desde variables de entorno / AppConfig.
 * Fallback a perfil genérico configurable.
 *
 * Orden de resolución:
 * 1. Variables de entorno (NEXT_PUBLIC_COMPANY_* / COMPANY_*)
 * 2. Fallback genérico White-Label
 */

import type { CompanyProfile } from "./types";
import { getAppConfig } from "@/config/app-config";

export function loadCompanyProfile(): CompanyProfile {
  const config = getAppConfig();

  return {
    tradeName: config.company.tradeName,
    legalName: config.company.legalName,
    ownerName: config.company.ownerName,
    nif: config.company.nif,
    addressLine1: config.company.addressLine1,
    addressLine2: config.company.addressLine2,
    phone: config.company.phone,
    email: config.company.email,
    logo: config.company.logo,
  };
}

/**
 * Perfil de empresa singleton (se evalúa una vez por instancia del servidor).
 */
export const COMPANY_PROFILE = loadCompanyProfile();
