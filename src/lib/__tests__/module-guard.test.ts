import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("module-guard: Electricista360 standalone", () => {
  test("módulos eléctricos críticos están activos", async () => {
    process.env.APP_VERTICAL = "tecnologia";
    const { loadVerticalConfig } = await import("../core/vertical-loader");
    const config = loadVerticalConfig();

    assert.equal(config.id, "electricista");
    for (const moduleId of [
      "dashboard",
      "clients",
      "crm",
      "invoices",
      "budgets",
      "work_orders",
      "jobs",
      "catalog",
      "normativa",
      "export",
    ]) {
      assert.ok(
        config.modules.includes(moduleId as import("../core/types").ModuleId),
        `${moduleId} debe estar activo en Electricista360`
      );
    }
    delete process.env.APP_VERTICAL;
  });

  test("guard y navegación consumen la misma configuración", async () => {
    const { loadVerticalConfig } = await import("../core/vertical-loader");
    const { getActiveModules } = await import("../core/modules");
    const config = loadVerticalConfig();
    const navModules = getActiveModules(config.modules);

    assert.ok(navModules.some((m) => m.href === "/normativa"));
    assert.ok(navModules.some((m) => m.href === "/partes-trabajo"));
    assert.ok(navModules.some((m) => m.href === "/trabajos"));
  });
});

describe("module-guard: utilidad base", () => {
  test("isModuleActive devuelve false para módulo ausente", async () => {
    const { isModuleActive } = await import("../core/modules");
    const modules = ["dashboard", "clients"] as import("../core/types").ModuleId[];
    assert.equal(isModuleActive("normativa", modules), false);
  });

  test("isModuleActive devuelve true para módulo presente", async () => {
    const { isModuleActive } = await import("../core/modules");
    const modules = ["dashboard", "clients"] as import("../core/types").ModuleId[];
    assert.equal(isModuleActive("dashboard", modules), true);
    assert.equal(isModuleActive("clients", modules), true);
  });
});
