/**
 * AUTÓNOMO360 - Company Profile Loader (SaaS White-Label)
 *
 * Carga el perfil de empresa con prioridad:
 * 1. Base de datos (tabla company_settings)
 * 2. Variables de entorno (NEXT_PUBLIC_COMPANY_* / COMPANY_*)
 * 3. Fallback genérico White-Label
 */

import type { Client } from "@libsql/client";
import type { CompanyProfile, FiscalTerritory } from "./types";
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
    fiscalTerritory: "common",
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
      fiscalTerritory: ((row.fiscal_territory as string)?.trim() as FiscalTerritory) || fallback.fiscalTerritory,
    };
  } catch {
    return fallback;
  }
}

export interface StrictBizkaiaFiscalProfile {
  nif: string;
  legalName: string;
  fiscalTerritory: FiscalTerritory;
}

export type FiscalResolutionResult =
  | { success: true; profile: StrictBizkaiaFiscalProfile }
  | { success: false; status: 400 | 403 | 500; error: string };

/**
 * Resuelve y valida el perfil fiscal estricto para TicketBAI Bizkaia (Batuz).
 * Garantiza que:
 * - El territorio sea exclusivamente 'bizkaia' (devuelve 403 si es 'common', 'araba' o 'gipuzkoa').
 * - El NIF de la empresa activa esté presente (devuelve 400 si falta).
 * - La razón social fiscal (legal_name) esté presente expresamente (devuelve 400 si falta; no sustituye por trade_name).
 * - No expone detalles ni trazas internas en caso de error de BD (devuelve 500 seguro).
 * - NO utiliza fallbacks estáticos por defecto.
 */
export async function getStrictBizkaiaFiscalProfile(
  db: Client,
  companyId: string = "default"
): Promise<FiscalResolutionResult> {
  try {
    const result = await db.execute({
      sql: "SELECT nif, legal_name, fiscal_territory FROM company_settings WHERE id = ? LIMIT 1",
      args: [companyId],
    });

    if (result.rows.length === 0) {
      return {
        success: false,
        status: 403,
        error: "TicketBAI/Batuz solo está habilitado para empresas configuradas en Bizkaia.",
      };
    }

    const row = result.rows[0];
    const territory = ((row.fiscal_territory as string)?.trim() || "common") as FiscalTerritory;

    if (territory !== "bizkaia") {
      if (territory === "araba" || territory === "gipuzkoa") {
        return {
          success: false,
          status: 403,
          error: `Esta implementación corresponde a Bizkaia/Batuz. TicketBAI para ${territory} no está disponible en esta versión.`,
        };
      }
      return {
        success: false,
        status: 403,
        error: "TicketBAI/Batuz solo está habilitado para empresas configuradas en Bizkaia.",
      };
    }

    const nif = (row.nif as string)?.trim();
    const legalName = (row.legal_name as string)?.trim();

    if (!nif) {
      return {
        success: false,
        status: 400,
        error: "Falta el NIF de la empresa emisora para generar TicketBAI (Bizkaia/Batuz).",
      };
    }

    if (!legalName) {
      return {
        success: false,
        status: 400,
        error: "Falta la razón social de la empresa emisora para generar TicketBAI (Bizkaia/Batuz).",
      };
    }

    return {
      success: true,
      profile: {
        nif,
        legalName,
        fiscalTerritory: "bizkaia",
      },
    };
  } catch (err) {
    console.error("Error seguro al verificar la configuración fiscal de la empresa:", err);
    return {
      success: false,
      status: 500,
      error: "No se pudo verificar la configuración fiscal de la empresa.",
    };
  }
}

/**
 * Perfil de empresa singleton inicial (evaluado al inicio).
 */
export const COMPANY_PROFILE = loadCompanyProfile();
