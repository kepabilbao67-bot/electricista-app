import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getActiveModules, MODULE_REGISTRY } from "../core/modules";

/**
 * Tests de navegación: verifican que la conversión de módulos activos
 * a navItems produce exactamente la misma navegación que tenía
 * Electricista360 antes del refactor.
 */

// Navegación original hardcoded de Electricista360 (referencia)
const ORIGINAL_NAV_ELECTRICISTA = [
  { href: "/", label: "Dashboard" },
  { href: "/asistente", label: "Asistente 360" },
  { href: "/clientes", label: "Clientes" },
  { href: "/crm", label: "CRM" },
  { href: "/leads", label: "Leads" },
  { href: "/facturas", label: "Facturas" },
  { href: "/presupuestos", label: "Presupuestos" },
  { href: "/partes-trabajo", label: "Partes de trabajo" },
  { href: "/gastos", label: "Gastos" },
  { href: "/comunicaciones", label: "Comunicaciones" },
  { href: "/agenda", label: "Agenda" },
  { href: "/catalogo", label: "Servicios" },
  { href: "/normativa", label: "Normativa" },
  { href: "/ayuda", label: "Ayuda y Sugerencias" },
  { href: "/exportar", label: "Exportar" },
  { href: "/configuracion", label: "Configuración" },
];

describe("navigation: electricista (backward compat)", () => {
  beforeEach(() => {
    delete process.env.APP_VERTICAL;
  });

  test("módulos electricista generan misma nav que antes", async () => {
    const { loadVerticalConfig } = await import("../core/vertical-loader");
    const config = loadVerticalConfig();
    const modules = getActiveModules(config.modules);
    const navItems = modules.map((m) => ({ href: m.href, label: m.label }));

    assert.equal(navItems.length, ORIGINAL_NAV_ELECTRICISTA.length,
      `Esperados ${ORIGINAL_NAV_ELECTRICISTA.length} items, got ${navItems.length}`);

    for (let i = 0; i < ORIGINAL_NAV_ELECTRICISTA.length; i++) {
      assert.equal(navItems[i].href, ORIGINAL_NAV_ELECTRICISTA[i].href,
        `Item ${i} href: esperado ${ORIGINAL_NAV_ELECTRICISTA[i].href}, got ${navItems[i].href}`);
      assert.equal(navItems[i].label, ORIGINAL_NAV_ELECTRICISTA[i].label,
        `Item ${i} label: esperado ${ORIGINAL_NAV_ELECTRICISTA[i].label}, got ${navItems[i].label}`);
    }
  });

  test("cada módulo tiene un iconKey válido (no vacío)", async () => {
    const { loadVerticalConfig } = await import("../core/vertical-loader");
    const config = loadVerticalConfig();
    const modules = getActiveModules(config.modules);
    for (const m of modules) {
      assert.ok(m.iconKey.length > 0, `Módulo ${m.id} tiene iconKey vacío`);
    }
  });
});

describe("navigation: tecnologia (sin normativa ni partes)", () => {
  test("tecnologia no muestra normativa ni partes-trabajo", async () => {
    process.env.APP_VERTICAL = "tecnologia";
    const { loadVerticalConfig } = await import("../core/vertical-loader");
    const config = loadVerticalConfig();
    const modules = getActiveModules(config.modules);
    const hrefs = modules.map((m) => m.href);

    assert.ok(!hrefs.includes("/normativa"), "Tecnologia no debe tener /normativa");
    assert.ok(!hrefs.includes("/partes-trabajo"), "Tecnologia no debe tener /partes-trabajo");
    assert.ok(hrefs.includes("/"), "Debe tener dashboard");
    assert.ok(hrefs.includes("/clientes"), "Debe tener clientes");
    assert.ok(hrefs.includes("/crm"), "Debe tener CRM");
    delete process.env.APP_VERTICAL;
  });

  test("tecnologia tiene menos items que electricista", async () => {
    process.env.APP_VERTICAL = "tecnologia";
    const { loadVerticalConfig } = await import("../core/vertical-loader");
    const configTech = loadVerticalConfig();
    delete process.env.APP_VERTICAL;
    const configElec = loadVerticalConfig();

    const navTech = getActiveModules(configTech.modules);
    const navElec = getActiveModules(configElec.modules);

    assert.ok(navTech.length < navElec.length,
      `Tech (${navTech.length}) debe tener menos items que Elec (${navElec.length})`);
  });
});

describe("navigation: MODULE_REGISTRY es fuente única de verdad", () => {
  test("no hay rutas duplicadas en el registry", () => {
    const hrefs = MODULE_REGISTRY.map((m) => m.href);
    const unique = new Set(hrefs);
    assert.equal(unique.size, hrefs.length, "No debe haber rutas duplicadas");
  });

  test("no hay IDs duplicados en el registry", () => {
    const ids = MODULE_REGISTRY.map((m) => m.id);
    const unique = new Set(ids);
    assert.equal(unique.size, ids.length, "No debe haber IDs duplicados");
  });

  test("todos los módulos de electricista existen en el registry", async () => {
    const { electricistaConfig } = await import("../verticals/electricista/config");
    const registryIds = new Set(MODULE_REGISTRY.map((m) => m.id));
    for (const moduleId of electricistaConfig.modules) {
      assert.ok(registryIds.has(moduleId), `Módulo ${moduleId} no está en MODULE_REGISTRY`);
    }
  });
});
