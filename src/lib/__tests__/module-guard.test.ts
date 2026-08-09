import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

/**
 * Tests del module-guard.
 *
 * No podemos testear notFound() directamente (es un throw de Next.js),
 * pero podemos verificar la lógica que decide si un módulo está activo
 * usando loadVerticalConfig() + isModuleActive().
 */

beforeEach(() => {
  delete process.env.APP_VERTICAL;
});

describe("module-guard: electricista (default)", () => {
  test("normativa está activa en electricista", async () => {
    delete process.env.APP_VERTICAL;
    const { loadVerticalConfig } = await import("../core/vertical-loader");
    const config = loadVerticalConfig();
    assert.ok(config.modules.includes("normativa"));
  });

  test("work_orders está activo en electricista", async () => {
    delete process.env.APP_VERTICAL;
    const { loadVerticalConfig } = await import("../core/vertical-loader");
    const config = loadVerticalConfig();
    assert.ok(config.modules.includes("work_orders"));
  });

  test("todos los módulos base están activos en electricista", async () => {
    delete process.env.APP_VERTICAL;
    const { loadVerticalConfig } = await import("../core/vertical-loader");
    const config = loadVerticalConfig();
    const required = ["dashboard", "clients", "crm", "invoices", "budgets", "export"];
    for (const m of required) {
      assert.ok(config.modules.includes(m as import("../core/types").ModuleId),
        `${m} debe estar activo en electricista`);
    }
  });
});

describe("module-guard: tecnologia (bloqueados)", () => {
  test("normativa NO está activa en tecnologia", async () => {
    process.env.APP_VERTICAL = "tecnologia";
    const { loadVerticalConfig } = await import("../core/vertical-loader");
    const config = loadVerticalConfig();
    assert.ok(!config.modules.includes("normativa"),
      "normativa no debe estar activa en tecnologia");
    delete process.env.APP_VERTICAL;
  });

  test("work_orders NO está activo en tecnologia", async () => {
    process.env.APP_VERTICAL = "tecnologia";
    const { loadVerticalConfig } = await import("../core/vertical-loader");
    const config = loadVerticalConfig();
    assert.ok(!config.modules.includes("work_orders"),
      "work_orders no debe estar activo en tecnologia");
    delete process.env.APP_VERTICAL;
  });

  test("módulos base siguen activos en tecnologia", async () => {
    process.env.APP_VERTICAL = "tecnologia";
    const { loadVerticalConfig } = await import("../core/vertical-loader");
    const config = loadVerticalConfig();
    const required = ["dashboard", "clients", "crm", "invoices", "budgets", "export"];
    for (const m of required) {
      assert.ok(config.modules.includes(m as import("../core/types").ModuleId),
        `${m} debe estar activo en tecnologia`);
    }
    delete process.env.APP_VERTICAL;
  });
});

describe("module-guard: lógica de bloqueo", () => {
  test("isModuleActive devuelve false para módulo ausente", async () => {
    const { isModuleActive } = await import("../core/modules");
    const techModules = [
      "dashboard", "assistant", "clients", "crm", "leads",
      "invoices", "budgets", "expenses", "communications",
      "schedule", "catalog", "export",
    ] as import("../core/types").ModuleId[];

    assert.equal(isModuleActive("normativa", techModules), false);
    assert.equal(isModuleActive("work_orders", techModules), false);
  });

  test("isModuleActive devuelve true para módulo presente", async () => {
    const { isModuleActive } = await import("../core/modules");
    const techModules = ["dashboard", "clients"] as import("../core/types").ModuleId[];
    assert.equal(isModuleActive("dashboard", techModules), true);
    assert.equal(isModuleActive("clients", techModules), true);
  });
});

describe("module-guard: coherencia guard ↔ navegación", () => {
  test("módulos bloqueados por guard tampoco aparecen en navegación (tecnologia)", async () => {
    process.env.APP_VERTICAL = "tecnologia";
    const { loadVerticalConfig } = await import("../core/vertical-loader");
    const { getActiveModules } = await import("../core/modules");
    const config = loadVerticalConfig();
    const navModules = getActiveModules(config.modules);
    const navHrefs = navModules.map((m) => m.href);

    // Los módulos que el guard bloquea no deben estar en la navegación
    assert.ok(!navHrefs.includes("/normativa"),
      "Guard bloquea normativa → no debe aparecer en nav");
    assert.ok(!navHrefs.includes("/partes-trabajo"),
      "Guard bloquea work_orders → no debe aparecer en nav");
    delete process.env.APP_VERTICAL;
  });

  test("guard y navegación usan exactamente la misma fuente (loadVerticalConfig)", async () => {
    // Ambos llaman loadVerticalConfig().modules — verificamos que es la misma referencia lógica
    delete process.env.APP_VERTICAL;
    const { loadVerticalConfig } = await import("../core/vertical-loader");
    const { getActiveModules } = await import("../core/modules");
    const config = loadVerticalConfig();
    const navModules = getActiveModules(config.modules);

    // La nav de electricista incluye normativa y partes-trabajo (guard los permite)
    assert.ok(navModules.some((m) => m.href === "/normativa"));
    assert.ok(navModules.some((m) => m.href === "/partes-trabajo"));
  });
});
