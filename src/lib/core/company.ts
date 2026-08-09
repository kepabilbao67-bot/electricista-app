/**
 * AUTÓNOMO360 — Company Profile Loader
 *
 * Carga el perfil de empresa desde variables de entorno.
 * Fallback al perfil hardcoded actual (S&H Eléctricas) para
 * mantener compatibilidad total con Electricista360.
 *
 * Orden de resolución:
 * 1. Variables de entorno COMPANY_* (si están definidas)
 * 2. Fallback hardcoded (backward compatible)
 *
 * En fases futuras se puede añadir lectura desde DB.
 */

import type { CompanyProfile } from "./types";

// Fallback: datos actuales de S&H Eléctricas (backward compat)
const DEFAULT_PROFILE: CompanyProfile = {
  tradeName: "S&H Eléctricas",
  legalName: "MARTIN OYARZABAL, IVAN",
  ownerName: "Iván Martín Oyarzabal",
  nif: "16063731W",
  addressLine1: "Lehendakari Aguirre 7B, 2.º derecha",
  addressLine2: "48640 Berango, Bizkaia",
  phone: "609 421 750",
  email: "sh.electricas@gmail.com",
};

/**
 * Carga el perfil de empresa.
 *
 * Si las env vars COMPANY_TRADE_NAME están definidas, las usa.
 * Si no, retorna el perfil por defecto (S&H Eléctricas).
 *
 * Esto permite que Electricista360 funcione sin cambio alguno,
 * mientras que Kepa360 o Pintor360 definen sus propias env vars.
 */
export function loadCompanyProfile(): CompanyProfile {
  const tradeName = process.env.COMPANY_TRADE_NAME?.trim();

  // Si no hay config de empresa en env, usar fallback
  if (!tradeName) return DEFAULT_PROFILE;

  return {
    tradeName,
    legalName: process.env.COMPANY_LEGAL_NAME?.trim() || tradeName,
    ownerName: process.env.COMPANY_OWNER_NAME?.trim() || tradeName,
    nif: process.env.COMPANY_NIF?.trim() || "",
    addressLine1: process.env.COMPANY_ADDRESS_1?.trim() || "",
    addressLine2: process.env.COMPANY_ADDRESS_2?.trim() || "",
    phone: process.env.COMPANY_PHONE?.trim() || "",
    email: process.env.COMPANY_EMAIL?.trim() || "",
    logo: process.env.COMPANY_LOGO?.trim() || undefined,
  };
}

/**
 * Perfil de empresa singleton (se evalúa una vez por instancia del servidor).
 */
export const COMPANY_PROFILE = loadCompanyProfile();
