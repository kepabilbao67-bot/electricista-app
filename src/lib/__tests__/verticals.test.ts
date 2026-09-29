import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

beforeEach(() => {
  delete process.env.APP_VERTICAL;
});

// --- vertical-loader ---

describe("core/vertical-loader: getVertical", () => {
  test("sin APP_VERTICAL devuelve electricista", async () => {
    delete process.env.APP_VERTICAL;
    const { getVertical } = await import("../core/vertical-loader");
    assert.equal(getVertical(), "electricista");
  });

  test("APP_VERTICAL=electricista devuelve electricista", async () => {
    process.env.APP_VERTICAL = "electricista";
    const { getVertical } = await import("../core/vertical-loader");
    assert.equal(getVertical(), "electricista");
  });

  test("APP_VERTICAL=tecnologia devuelve tecnologia", async () => {
    process.env.APP_VERTICAL = "tecnologia";
    const { getVertical } = await import("../core/vertical-loader");
    assert.equal(getVertical(), "tecnologia");
  });

  test("APP_VERTICAL inválida lanza error", async () => {
    process.env.APP_VERTICAL = "fontaneria";
    const { getVertical } = await import("../core/vertical-loader");
    assert.throws(() => getVertical(), /APP_VERTICAL inválida/);
  });
});

describe("core/vertical-loader: loadVerticalConfig", () => {
  test("sin APP_VERTICAL carga electricista config", async () => {
    delete process.env.APP_VERTICAL;
    const { loadVerticalConfig } = await import("../core/vertical-loader");
    const config = loadVerticalConfig();
    assert.equal(config.id, "electricista");
    assert.ok(config.brand.tradeName.length > 0);
    assert.ok(config.modules.includes("dashboard"));
    assert.ok(config.modules.includes("work_orders"));
    assert.ok(config.modules.includes("normativa"));
    assert.ok(config.modules.includes("settings"));
  });

  test("tecnologia no incluye work_orders ni normativa", async () => {
    process.env.APP_VERTICAL = "tecnologia";
    const { loadVerticalConfig } = await import("../core/vertical-loader");
    const config = loadVerticalConfig();
    assert.equal(config.id, "tecnologia");
    assert.equal(config.brand.tradeName, "Kepa360");
    assert.ok(!config.modules.includes("work_orders"));
    assert.ok(!config.modules.includes("normativa"));
  });
});

// --- electricista config ---

describe("verticals/electricista: config", () => {
  test("tiene brand completo", async () => {
    const { electricistaConfig } = await import("../verticals/electricista/config");
    assert.equal(electricistaConfig.brand.iconKey, "zap");
    assert.ok(electricistaConfig.brand.initials.length > 0);
    assert.ok(electricistaConfig.brand.themeColor.startsWith("#"));
  });

  test("catalog devuelve items", async () => {
    const { electricistaConfig } = await import("../verticals/electricista/config");
    const items = electricistaConfig.catalog.getItems();
    assert.ok(items.length > 0);
    assert.ok(items[0].id.length > 0);
  });

  test("catalog devuelve categorías", async () => {
    const { electricistaConfig } = await import("../verticals/electricista/config");
    const cats = electricistaConfig.catalog.getCategories();
    assert.ok(cats.includes("Material eléctrico"));
    assert.ok(cats.includes("Protecciones"));
  });

  test("catalog devuelve unidades", async () => {
    const { electricistaConfig } = await import("../verticals/electricista/config");
    const units = electricistaConfig.catalog.getUnits();
    assert.ok(units.some((u) => u.value === "metro"));
    assert.ok(units.some((u) => u.value === "punto"));
  });

  test("modules incluye todos los módulos esperados para electricista", async () => {
    const { electricistaConfig } = await import("../verticals/electricista/config");
    const expected = ["dashboard", "clients", "crm", "invoices", "budgets", "work_orders", "normativa", "export"];
    for (const m of expected) {
      assert.ok(
        electricistaConfig.modules.includes(m as import("../core/types").ModuleId),
        `Módulo ${m} debe estar activo en electricista`
      );
    }
  });

  test("no contiene datos personales en config", async () => {
    const { electricistaConfig } = await import("../verticals/electricista/config");
    const json = JSON.stringify(electricistaConfig);
    // Brand puede contener S&H Eléctricas como tradeName (público), pero no NIF/teléfono
    assert.ok(!json.includes("16063731W"), "No debe contener NIF");
    assert.ok(!json.includes("609 421 750"), "No debe contener teléfono");
    assert.ok(!json.includes("sh.electricas@gmail"), "No debe contener email");
  });
});
