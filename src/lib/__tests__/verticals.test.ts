import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

beforeEach(() => {
  delete process.env.APP_VERTICAL;
});

describe("Electricista360 standalone: identidad", () => {
  test("la identidad es siempre electricista", async () => {
    const { getVertical } = await import("../core/vertical-loader");
    assert.equal(getVertical(), "electricista");
  });

  test("APP_VERTICAL no puede convertir Electricista360 en otra vertical", async () => {
    process.env.APP_VERTICAL = "barymont";
    const { getVertical, loadVerticalConfig } = await import("../core/vertical-loader");
    assert.equal(getVertical(), "electricista");
    assert.equal(loadVerticalConfig().id, "electricista");
  });

  test("una APP_VERTICAL desconocida tampoco altera la identidad", async () => {
    process.env.APP_VERTICAL = "fontaneria";
    const { getVertical, loadVerticalConfig } = await import("../core/vertical-loader");
    assert.equal(getVertical(), "electricista");
    assert.equal(loadVerticalConfig().id, "electricista");
  });
});

describe("Electricista360: configuración sectorial", () => {
  test("tiene brand eléctrico completo", async () => {
    const { electricistaConfig } = await import("../verticals/electricista/config");
    assert.equal(electricistaConfig.id, "electricista");
    assert.equal(electricistaConfig.brand.iconKey, "zap");
    assert.ok(electricistaConfig.brand.initials.length > 0);
    assert.ok(electricistaConfig.brand.themeColor.startsWith("#"));
  });

  test("catálogo devuelve items, categorías y unidades eléctricas", async () => {
    const { electricistaConfig } = await import("../verticals/electricista/config");
    const items = electricistaConfig.catalog.getItems();
    const categories = electricistaConfig.catalog.getCategories();
    const units = electricistaConfig.catalog.getUnits();

    assert.ok(items.length > 0);
    assert.ok(categories.includes("Material eléctrico"));
    assert.ok(categories.includes("Protecciones"));
    assert.ok(units.some((u) => u.value === "metro"));
    assert.ok(units.some((u) => u.value === "punto"));
  });

  test("incluye los módulos esenciales del electricista", async () => {
    const { electricistaConfig } = await import("../verticals/electricista/config");
    const expected = [
      "dashboard",
      "clients",
      "crm",
      "invoices",
      "budgets",
      "work_orders",
      "jobs",
      "expenses",
      "catalog",
      "normativa",
      "settings",
    ];

    for (const moduleId of expected) {
      assert.ok(
        electricistaConfig.modules.includes(moduleId as import("../core/types").ModuleId),
        `Módulo ${moduleId} debe estar activo en Electricista360`
      );
    }
  });

  test("no contiene datos personales hardcoded", async () => {
    const { electricistaConfig } = await import("../verticals/electricista/config");
    const json = JSON.stringify(electricistaConfig);
    assert.ok(!json.includes("16063731W"), "No debe contener NIF personal");
    assert.ok(!json.includes("609 421 750"), "No debe contener teléfono personal");
    assert.ok(!json.includes("sh.electricas@gmail"), "No debe contener email personal");
  });
});
