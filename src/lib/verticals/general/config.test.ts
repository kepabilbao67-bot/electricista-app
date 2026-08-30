import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { generalConfig } from "./config";
import type { ModuleId, CatalogItem } from "../../core/types";

describe("Autónomo360 — Configuración Vertical General (config.test.ts)", () => {
  test("1. Tiene id exactamente 'general'", () => {
    assert.equal(generalConfig.id, "general");
  });

  test("2. Utiliza 'Autónomo360' como nombre predeterminado cuando no existen variables de branding", () => {
    assert.equal(generalConfig.brand.tradeName, "Autónomo360");
    assert.equal(generalConfig.brand.shortName, "Autónomo360");
    assert.equal(generalConfig.brand.initials, "A360");
    assert.equal(generalConfig.brand.iconKey, "briefcase");
  });

  test("3. Tiene descripción neutral para cualquier autónomo o pequeña empresa", () => {
    assert.ok(generalConfig.brand.description.length > 0);
    assert.match(generalConfig.brand.description, /autónomos y pequeñas empresas/i);
  });

  test("4. Incluye los módulos generales esperados", () => {
    const expectedModules: ModuleId[] = [
      "dashboard",
      "clients",
      "crm",
      "leads",
      "invoices",
      "budgets",
      "jobs",
      "work_orders",
      "expenses",
      "schedule",
      "catalog",
      "communications",
      "assistant",
      "help",
      "export",
      "settings",
    ];

    for (const mod of expectedModules) {
      assert.ok(
        generalConfig.modules.includes(mod),
        `El módulo general '${mod}' debe estar incluido en generalConfig.modules`
      );
    }
  });

  test("5. No incluye 'normativa' ni 'measurements'", () => {
    assert.equal(generalConfig.modules.includes("normativa" as ModuleId), false);
    assert.equal(generalConfig.modules.includes("measurements" as ModuleId), false);
  });

  test("6. No contiene módulos duplicados", () => {
    const uniqueModules = new Set(generalConfig.modules);
    assert.equal(uniqueModules.size, generalConfig.modules.length, "La lista de módulos no debe contener duplicados");
  });

  test("7. Devuelve exactamente 11 elementos de catálogo", () => {
    const items = generalConfig.catalog.getItems();
    assert.equal(items.length, 11, "El catálogo neutro inicial debe tener exactamente 11 elementos");
  });

  test("8. Todos los IDs de catálogo son únicos", () => {
    const items = generalConfig.catalog.getItems();
    const ids = items.map((i: CatalogItem) => i.id);
    const uniqueIds = new Set(ids);
    assert.equal(uniqueIds.size, ids.length, "Todos los IDs de items de catálogo deben ser únicos");
  });

  test("9. Todos los nombres y descripciones están presentes", () => {
    const items = generalConfig.catalog.getItems();
    for (const item of items) {
      assert.ok(typeof item.name === "string" && item.name.trim().length > 0, `Item ${item.id} debe tener nombre`);
      assert.ok(
        typeof item.description === "string" && item.description.trim().length > 0,
        `Item ${item.id} debe tener descripción`
      );
    }
  });

  test("10. Todos los precios son números finitos y no negativos", () => {
    const items = generalConfig.catalog.getItems();
    for (const item of items) {
      assert.ok(Number.isFinite(item.unitPrice) && item.unitPrice >= 0, `unitPrice inválido en item ${item.id}`);
      assert.ok(Number.isFinite(item.costPrice) && item.costPrice >= 0, `costPrice inválido en item ${item.id}`);
    }
  });

  test("11. Todas las unidades utilizadas existen en getUnits()", () => {
    const availableUnits = new Set(generalConfig.catalog.getUnits().map((u) => u.value));
    const items = generalConfig.catalog.getItems();
    for (const item of items) {
      assert.ok(
        availableUnits.has(item.unit),
        `La unidad '${item.unit}' del item ${item.id} debe existir en getUnits()`
      );
    }
  });

  test("12. Todas las categorías utilizadas existen en getCategories()", () => {
    const availableCategories = new Set(generalConfig.catalog.getCategories());
    const items = generalConfig.catalog.getItems();
    for (const item of items) {
      assert.ok(
        availableCategories.has(item.category),
        `La categoría '${item.category}' del item ${item.id} debe existir en getCategories()`
      );
    }
  });

  test("13. No contiene términos exclusivos de electricistas (inspeccionando valores reales del catálogo)", () => {
    const forbiddenKeywords = [
      "rebt",
      "eléctrico",
      "electrico",
      "eléctrica",
      "electrica",
      "electricista",
      "magnetotérmico",
      "magnetotermico",
      "circuito",
      "cableado",
      "cuadro eléctrico",
      "cuadro electrico",
      "roza",
      "diferencial",
    ];

    const fullEvaluatedStructure = {
      id: generalConfig.id,
      brand: generalConfig.brand,
      modules: generalConfig.modules,
      catalogItems: generalConfig.catalog.getItems(),
      catalogCategories: generalConfig.catalog.getCategories(),
      catalogUnits: generalConfig.catalog.getUnits(),
    };

    const evaluatedString = JSON.stringify(fullEvaluatedStructure).toLowerCase();

    for (const kw of forbiddenKeywords) {
      assert.equal(
        evaluatedString.includes(kw.toLowerCase()),
        false,
        `generalConfig (incluyendo getItems, getCategories y getUnits) no debe contener el término de electricistas: "${kw}"`
      );
    }
  });

  test("14. No modifica ni importa la configuración del vertical electricista (inspección de código fuente y tipos)", () => {
    // 1. Comprobación funcional
    assert.notEqual(generalConfig.id, "electricista");
    assert.notEqual(generalConfig.brand.iconKey, "zap");
    assert.equal(generalConfig.modules.includes("normativa" as ModuleId), false);
    assert.equal(generalConfig.modules.includes("measurements" as ModuleId), false);

    // 2. Comprobación estática del código fuente de config.ts
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const configSourcePath = path.join(currentDir, "config.ts");
    const sourceContent = fs.readFileSync(configSourcePath, "utf8");

    const forbiddenReferences = [
      "../electricista",
      "verticals/electricista",
      "electricista/config",
      "electricistaConfig",
    ];

    for (const ref of forbiddenReferences) {
      assert.equal(
        sourceContent.includes(ref),
        false,
        `src/lib/verticals/general/config.ts no debe importar ni referenciar: "${ref}"`
      );
    }
  });

  test("15. Mantiene el catálogo determinista entre llamadas consecutivas", () => {
    const call1 = generalConfig.catalog.getItems();
    const call2 = generalConfig.catalog.getItems();
    assert.deepEqual(call1, call2, "Las llamadas consecutivas a getItems() deben retornar datos idénticos");

    const cat1 = generalConfig.catalog.getCategories();
    const cat2 = generalConfig.catalog.getCategories();
    assert.deepEqual(cat1, cat2, "Las llamadas consecutivas a getCategories() deben retornar datos idénticos");

    const units1 = generalConfig.catalog.getUnits();
    const units2 = generalConfig.catalog.getUnits();
    assert.deepEqual(units1, units2, "Las llamadas consecutivas a getUnits() deben retornar datos idénticos");
  });
});
