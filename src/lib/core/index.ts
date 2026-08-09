/**
 * AUTÓNOMO360 — Core exports
 *
 * Punto de entrada del núcleo común.
 */

export type {
  Vertical,
  CompanyProfile,
  VerticalBrand,
  ModuleId,
  CatalogItem,
  CatalogProvider,
  KnowledgeProvider,
  VerticalConfig,
} from "./types";

export { loadCompanyProfile, COMPANY_PROFILE } from "./company";

export type { ModuleDefinition } from "./modules";
export { MODULE_REGISTRY, getActiveModules, isModuleActive } from "./modules";

export { getVertical, loadVerticalConfig } from "./vertical-loader";
