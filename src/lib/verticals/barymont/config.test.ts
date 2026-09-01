import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { barymontConfig } from "./config";
import type { ModuleId, CatalogItem } from "../../core/types";

describe("Barymont — Configuración Vertical (config.test.ts)", () => {
  test("1. Tiene id exactamente 'barymont'", () => {
    assert.equal(barymontConfig.id, "barymont");
  });

  test("2. Utiliza 'Barymont' como nombre predeterminado cuando no existen variables de branding", () => {
    assert.equal(barymontConfig.brand.tradeName, "Barymont");
    assert.equal(barymontConfig.brand.shortName, "Barymont");
    assert.equal(barymontConfig.brand.initials, "BM");
    assert.equal(barymontConfig.brand.iconKey, "trending-up");
  });

  test("3. Tiene descripción enfocada en planificación financiera y gestión comercial", () => {
    assert.ok(barymontConfig.brand.description.length > 0);
    assert.match(barymontConfig.brand.description, /planificación financiera/i);
  });

  test("4. Incluye los módulos comerciales esperados", () => {
    const expectedModules: ModuleId[] = [
      "dashboard",
      "clients",
      "crm",
      "leads",
      "schedule",
      "communications",
      "assistant",
      "budgets",
      "invoices",
      "expenses",
      "catalog",
      "help",
      "export",
      "settings",
    ];

    for (const mod of expectedModules) {
      assert.ok(
        barymontConfig.modules.includes(mod),
        `El módulo comercial '${mod}' debe estar incluido en barymontConfig.modules`
      );
    }
  });

  test("5. No incluye 'normativa' ni 'work_orders' (específicos de oficios técnicos)", () => {
    assert.equal(barymontConfig.modules.includes("normativa" as ModuleId), false);
    assert.equal(barymontConfig.modules.includes("work_orders" as ModuleId), false);
  });

  test("6. No contiene módulos duplicados", () => {
    const uniqueModules = new Set(barymontConfig.modules);
    assert.equal(
      uniqueModules.size,
      barymontConfig.modules.length,
      "La lista de módulos no debe contener duplicados"
    );
  });

  test("7. Devuelve al menos 8 elementos de catálogo financiero", () => {
    const items = barymontConfig.catalog.getItems();
    assert.ok(items.length >= 8, "El catálogo de Barymont debe tener al menos 8 elementos");
  });

  test("8. Todos los IDs de catálogo son únicos", () => {
    const items = barymontConfig.catalog.getItems();
    const ids = items.map((i: CatalogItem) => i.id);
    const uniqueIds = new Set(ids);
    assert.equal(uniqueIds.size, ids.length, "Todos los IDs de items de catálogo deben ser únicos");
  });

  test("9. Todos los nombres y descripciones están presentes", () => {
    const items = barymontConfig.catalog.getItems();
    for (const item of items) {
      assert.ok(
        typeof item.name === "string" && item.name.trim().length > 0,
        `Item ${item.id} debe tener nombre`
      );
      assert.ok(
        typeof item.description === "string" && item.description.trim().length > 0,
        `Item ${item.id} debe tener descripción`
      );
    }
  });

  test("10. Todas las unidades utilizadas existen en getUnits()", () => {
    const availableUnits = new Set(barymontConfig.catalog.getUnits().map((u) => u.value));
    const items = barymontConfig.catalog.getItems();
    for (const item of items) {
      assert.ok(
        availableUnits.has(item.unit),
        `La unidad '${item.unit}' del item ${item.id} debe existir en getUnits()`
      );
    }
  });

  test("11. Todas las categorías utilizadas existen en getCategories()", () => {
    const availableCategories = new Set(barymontConfig.catalog.getCategories());
    const items = barymontConfig.catalog.getItems();
    for (const item of items) {
      assert.ok(
        availableCategories.has(item.category),
        `La categoría '${item.category}' del item ${item.id} debe existir en getCategories()`
      );
    }
  });

  test("12. Knowledge provider tiene topics y suggestion chips", () => {
    assert.ok(barymontConfig.knowledge, "Knowledge provider debe estar definido");
    const topics = barymontConfig.knowledge!.getTopics();
    assert.ok(topics.length >= 4, "Debe tener al menos 4 topics");
    const chips = barymontConfig.knowledge!.getSuggestionChips();
    assert.ok(chips.length >= 3, "Debe tener sugerencias rápidas");
  });

  test("13. No contiene términos exclusivos de electricistas", () => {
    const forbiddenKeywords = [
      "rebt",
      "magnetotérmico",
      "cuadro eléctrico",
      "punto de luz",
      "tubo corrugado",
      "diferencial",
    ];

    const fullEvaluatedStructure = {
      id: barymontConfig.id,
      brand: barymontConfig.brand,
      modules: barymontConfig.modules,
      catalogItems: barymontConfig.catalog.getItems(),
      catalogCategories: barymontConfig.catalog.getCategories(),
      catalogUnits: barymontConfig.catalog.getUnits(),
    };

    const evaluatedString = JSON.stringify(fullEvaluatedStructure).toLowerCase();

    for (const kw of forbiddenKeywords) {
      assert.equal(
        evaluatedString.includes(kw.toLowerCase()),
        false,
        `barymontConfig no debe contener el término técnico: "${kw}"`
      );
    }
  });

  test("14. No modifica ni importa la configuración del vertical electricista", () => {
    assert.notEqual(barymontConfig.id, "electricista");
    assert.notEqual(barymontConfig.brand.iconKey, "zap");

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
        `src/lib/verticals/barymont/config.ts no debe importar ni referenciar: "${ref}"`
      );
    }
  });
});
