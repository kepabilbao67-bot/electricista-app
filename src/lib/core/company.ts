/**
 * AUTÓNOMO360 — Company Profile Loader (SaaS White-Label)
 *
 * Carga el perfil de empresa con prioridad:
 * 1. Base de datos (tabla company_settings)
 * 2. Variables de entorno (NEXT_PUBLIC_COMPANY_* / COMPANY_*)
 * 3. Fallback genérico White-Label
 */

import type { Client } from "@libsql/client";
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
    iban: config.company.iban,
    bankName: config.company.bankName,
  };
}

/**
 * Consulta la configuración de empresa guardada en la base de datos
 * y hace fallback ordenado a los valores predeterminados de la app.
 */
export async function getCompanyProfileFromDb(db: Client): Promise<CompanyProfile> {
  const fallback = loadCompanyProfile();

  try {
    const result = await db.execute({
      sql: "SELECT * FROM company_settings WHERE id = 'default' LIMIT 1",
      args: [],
    });

    if (result.rows.length === 0) {
      return fallback;
    }

    const row = result.rows[0];
    return {
      tradeName: (row.trade_name as string)?.trim() || fallback.tradeName,
      legalName: (row.legal_name as string)?.trim() || fallback.legalName,
      ownerName: (row.owner_name as string)?.trim() || fallback.ownerName,
      nif: (row.nif as string)?.trim() || fallback.nif,
      addressLine1: (row.address_line1 as string)?.trim() || fallback.addressLine1,
      addressLine2: (row.address_line2 as string)?.trim() || fallback.addressLine2,
      phone: (row.phone as string)?.trim() || fallback.phone,
      email: (row.email as string)?.trim() || fallback.email,
      logo: fallback.logo,
      iban: (row.iban as string)?.trim() || fallback.iban,
      bankName: (row.bank_name as string)?.trim() || fallback.bankName,
    };
  } catch {
    return fallback;
  }
}

/**
 * Perfil de empresa singleton inicial (evaluado al inicio).
 */
export const COMPANY_PROFILE = loadCompanyProfile();
