import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getActiveModules, MODULE_REGISTRY } from "../core/modules";

const EXPECTED_NAV_ELECTRICISTA = [
  { href: "/", label: "Dashboard" },
  { href: "/asistente", label: "Asistente 360" },
  { href: "/clientes", label: "Clientes" },
  { href: "/crm", label: "CRM" },
  { href: "/leads", label: "Leads" },
  { href: "/facturas", label: "Facturas" },
  { href: "/presupuestos", label: "Presupuestos" },
  { href: "/partes-trabajo", label: "Partes de trabajo" },
  { href: "/trabajos", label: "Centro de Trabajos" },
  { href: "/gastos", label: "Gastos" },
  { href: "/comunicaciones", label: "Comunicaciones" },
  { href: "/agenda", label: "Agenda" },
  { href: "/catalogo", label: "Servicios" },
  { href: "/normativa", label: "Normativa" },
  { href: "/ayuda", label: "Ayuda y Sugerencias" },
  { href: "/exportar", label: "Exportar" },
  { href: "/configuracion", label: "Configuración" },
];

describe("navigation: Electricista360 standalone", () => {
  test("genera exactamente la navegación eléctrica esperada", async () => {
    process.env.APP_VERTICAL = "general";
    const { loadVerticalConfig } = await import("../core/vertical-loader");
    const config = loadVerticalConfig();
    const navItems = getActiveModules(config.modules).map((m) => ({
      href: m.href,
      label: m.label,
    }));

    assert.deepEqual(navItems, EXPECTED_NAV_ELECTRICISTA);
    delete process.env.APP_VERTICAL;
  });

  test("cada módulo activo tiene iconKey", async () => {
    const { loadVerticalConfig } = await import("../core/vertical-loader");
    const modules = getActiveModules(loadVerticalConfig().modules);
    for (const module of modules) {
      assert.ok(module.iconKey.length > 0, `Módulo ${module.id} tiene iconKey vacío`);
    }
  });
});

describe("MODULE_REGISTRY", () => {
  test("no tiene rutas ni IDs duplicados", () => {
    const hrefs = MODULE_REGISTRY.map((m) => m.href);
    const ids = MODULE_REGISTRY.map((m) => m.id);
    assert.equal(new Set(hrefs).size, hrefs.length, "No debe haber rutas duplicadas");
    assert.equal(new Set(ids).size, ids.length, "No debe haber IDs duplicados");
  });

  test("contiene todos los módulos declarados por Electricista360", async () => {
    const { electricistaConfig } = await import("../verticals/electricista/config");
    const registryIds = new Set(MODULE_REGISTRY.map((m) => m.id));
    for (const moduleId of electricistaConfig.modules) {
      assert.ok(registryIds.has(moduleId), `Módulo ${moduleId} no está en MODULE_REGISTRY`);
    }
  });
});
