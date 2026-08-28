/**
 * AUTÓNOMO 360 — Configuración Centralizada SaaS White-Label
 * 
 * Permite personalizar el nombre de la app, datos fiscales, bancarios
 * y de contacto mediante variables de entorno o valores por defecto genéricos.
 */

export interface AppConfig {
  app: {
    name: string;
    shortName: string;
    description: string;
    version: string;
    themeColor: string;
  };
  company: {
    tradeName: string;
    legalName: string;
    ownerName: string;
    nif: string;
    addressLine1: string;
    addressLine2: string;
    phone: string;
    email: string;
    iban: string;
    bankName: string;
    logo?: string;
  };
  billing: {
    invoiceSeriesPrefix: string;
    budgetSeriesPrefix: string;
    workOrderSeriesPrefix: string;
    defaultTaxRate: number;
  };
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  app: {
    name: "Gestión Profesional 360",
    shortName: "Gestión 360",
    description: "Software de gestión integral para autónomos y pymes",
    version: "1.0.0",
    themeColor: "#2563eb",
  },
  company: {
    tradeName: "Mi Empresa",
    legalName: "Mi Empresa Servicios S.L.",
    ownerName: "Responsable del Servicio",
    nif: "B00000000",
    addressLine1: "Calle Principal 123",
    addressLine2: "28001 Madrid",
    phone: "+34 600 000 000",
    email: "contacto@miempresa.com",
    iban: "ES00 0000 0000 0000 0000 0000",
    bankName: "Entidad Bancaria",
  },
  billing: {
    invoiceSeriesPrefix: "FAC-",
    budgetSeriesPrefix: "PRES-",
    workOrderSeriesPrefix: "PT-",
    defaultTaxRate: 21,
  },
};

/**
 * Obtiene la configuración activa combinando variables de entorno
 * y valores por defecto genéricos.
 */
export function getAppConfig(): AppConfig {
  const getEnv = (key: string) => process.env[key]?.trim();

  return {
    app: {
      name:
        getEnv("NEXT_PUBLIC_APP_NAME") ||
        getEnv("APP_NAME") ||
        DEFAULT_APP_CONFIG.app.name,
      shortName:
        getEnv("NEXT_PUBLIC_APP_SHORT_NAME") ||
        getEnv("APP_SHORT_NAME") ||
        DEFAULT_APP_CONFIG.app.shortName,
      description:
        getEnv("NEXT_PUBLIC_APP_DESCRIPTION") ||
        getEnv("APP_DESCRIPTION") ||
        DEFAULT_APP_CONFIG.app.description,
      version:
        getEnv("NEXT_PUBLIC_APP_VERSION") ||
        getEnv("APP_VERSION") ||
        DEFAULT_APP_CONFIG.app.version,
      themeColor:
        getEnv("NEXT_PUBLIC_THEME_COLOR") ||
        getEnv("THEME_COLOR") ||
        DEFAULT_APP_CONFIG.app.themeColor,
    },
    company: {
      tradeName:
        getEnv("NEXT_PUBLIC_COMPANY_TRADE_NAME") ||
        getEnv("COMPANY_TRADE_NAME") ||
        DEFAULT_APP_CONFIG.company.tradeName,
      legalName:
        getEnv("NEXT_PUBLIC_COMPANY_LEGAL_NAME") ||
        getEnv("COMPANY_LEGAL_NAME") ||
        DEFAULT_APP_CONFIG.company.legalName,
      ownerName:
        getEnv("NEXT_PUBLIC_COMPANY_OWNER_NAME") ||
        getEnv("COMPANY_OWNER_NAME") ||
        DEFAULT_APP_CONFIG.company.ownerName,
      nif:
        getEnv("NEXT_PUBLIC_COMPANY_NIF") ||
        getEnv("COMPANY_NIF") ||
        DEFAULT_APP_CONFIG.company.nif,
      addressLine1:
        getEnv("NEXT_PUBLIC_COMPANY_ADDRESS_1") ||
        getEnv("COMPANY_ADDRESS_1") ||
        DEFAULT_APP_CONFIG.company.addressLine1,
      addressLine2:
        getEnv("NEXT_PUBLIC_COMPANY_ADDRESS_2") ||
        getEnv("COMPANY_ADDRESS_2") ||
        DEFAULT_APP_CONFIG.company.addressLine2,
      phone:
        getEnv("NEXT_PUBLIC_COMPANY_PHONE") ||
        getEnv("COMPANY_PHONE") ||
        DEFAULT_APP_CONFIG.company.phone,
      email:
        getEnv("NEXT_PUBLIC_COMPANY_EMAIL") ||
        getEnv("COMPANY_EMAIL") ||
        DEFAULT_APP_CONFIG.company.email,
      iban:
        getEnv("NEXT_PUBLIC_COMPANY_IBAN") ||
        getEnv("COMPANY_IBAN") ||
        DEFAULT_APP_CONFIG.company.iban,
      bankName:
        getEnv("NEXT_PUBLIC_COMPANY_BANK") ||
        getEnv("COMPANY_BANK") ||
        DEFAULT_APP_CONFIG.company.bankName,
      logo:
        getEnv("NEXT_PUBLIC_COMPANY_LOGO") ||
        getEnv("COMPANY_LOGO") ||
        undefined,
    },
    billing: {
      invoiceSeriesPrefix:
        getEnv("NEXT_PUBLIC_INVOICE_SERIES_PREFIX") ||
        getEnv("INVOICE_SERIES_PREFIX") ||
        DEFAULT_APP_CONFIG.billing.invoiceSeriesPrefix,
      budgetSeriesPrefix:
        getEnv("NEXT_PUBLIC_BUDGET_SERIES_PREFIX") ||
        getEnv("BUDGET_SERIES_PREFIX") ||
        DEFAULT_APP_CONFIG.billing.budgetSeriesPrefix,
      workOrderSeriesPrefix:
        getEnv("NEXT_PUBLIC_WORK_ORDER_SERIES_PREFIX") ||
        getEnv("WORK_ORDER_SERIES_PREFIX") ||
        DEFAULT_APP_CONFIG.billing.workOrderSeriesPrefix,
      defaultTaxRate:
        Number(getEnv("NEXT_PUBLIC_DEFAULT_TAX_RATE") || getEnv("DEFAULT_TAX_RATE")) ||
        DEFAULT_APP_CONFIG.billing.defaultTaxRate,
    },
  };
}

export const APP_CONFIG = getAppConfig();
