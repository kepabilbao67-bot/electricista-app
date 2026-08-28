import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getActiveModules, isModuleActive, MODULE_REGISTRY } from "../core/modules";
import { loadCompanyProfile } from "../core/company";
import type { ModuleId, VerticalConfig, CatalogProvider } from "../core/types";

// --- Company Profile ---

describe("core/company: loadCompanyProfile", () => {
  test("sin env vars retorna perfil White-Label genérico", () => {
    delete process.env.COMPANY_TRADE_NAME;
    delete process.env.NEXT_PUBLIC_COMPANY_TRADE_NAME;
    const profile = loadCompanyProfile();
    assert.equal(profile.tradeName, "Mi Empresa");
    assert.equal(profile.nif, "B00000000");
    assert.ok(profile.phone.length > 0);
  });

  test("con COMPANY_TRADE_NAME usa env vars", () => {
    process.env.COMPANY_TRADE_NAME = "TestCorp";
    process.env.COMPANY_NIF = "12345678A";
    process.env.COMPANY_PHONE = "666000111";
    process.env.COMPANY_EMAIL = "test@test.com";
    const profile = loadCompanyProfile();
    assert.equal(profile.tradeName, "TestCorp");
    assert.equal(profile.nif, "12345678A");
    assert.equal(profile.phone, "666000111");
    // Cleanup
    delete process.env.COMPANY_TRADE_NAME;
    delete process.env.COMPANY_NIF;
    delete process.env.COMPANY_PHONE;
    delete process.env.COMPANY_EMAIL;
  });

  test("COMPANY_TRADE_NAME vacío usa fallback genérico", () => {
    process.env.COMPANY_TRADE_NAME = "   ";
    const profile = loadCompanyProfile();
    assert.equal(profile.tradeName, "Mi Empresa");
    delete process.env.COMPANY_TRADE_NAME;
  });
});

// --- Modules ---

describe("core/modules: MODULE_REGISTRY", () => {
  test("contiene al menos 13 módulos", () => {
    assert.ok(MODULE_REGISTRY.length >= 13);
  });

  test("dashboard es el primer módulo", () => {
    assert.equal(MODULE_REGISTRY[0].id, "dashboard");
    assert.equal(MODULE_REGISTRY[0].href, "/");
  });

  test("todos los módulos tienen href, label e iconKey", () => {
    for (const m of MODULE_REGISTRY) {
      assert.ok(m.href.startsWith("/") || m.href === "/", `${m.id} href inválido`);
      assert.ok(m.label.length > 0, `${m.id} label vacío`);
      assert.ok(m.iconKey.length > 0, `${m.id} iconKey vacío`);
    }
  });

  test("no hay IDs duplicados", () => {
    const ids = MODULE_REGISTRY.map((m) => m.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe("core/modules: getActiveModules", () => {
  test("filtra correctamente", () => {
    const active: ModuleId[] = ["dashboard", "clients", "crm"];
    const result = getActiveModules(active);
    assert.equal(result.length, 3);
    assert.equal(result[0].id, "dashboard");
    assert.equal(result[1].id, "clients");
    assert.equal(result[2].id, "crm");
  });

  test("mantiene el orden del registry", () => {
    const active: ModuleId[] = ["export", "dashboard", "invoices"];
    const result = getActiveModules(active);
    // dashboard va antes que invoices, invoices antes que export
    assert.equal(result[0].id, "dashboard");
    assert.equal(result[1].id, "invoices");
    assert.equal(result[2].id, "export");
  });

  test("array vacío devuelve array vacío", () => {
    const result = getActiveModules([]);
    assert.equal(result.length, 0);
  });

  test("IDs inexistentes se ignoran", () => {
    const result = getActiveModules(["dashboard", "nonexistent" as ModuleId]);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "dashboard");
  });
});

describe("core/modules: isModuleActive", () => {
  test("devuelve true para módulo activo", () => {
    assert.equal(isModuleActive("dashboard", ["dashboard", "clients"]), true);
  });

  test("devuelve false para módulo inactivo", () => {
    assert.equal(isModuleActive("normativa", ["dashboard", "clients"]), false);
  });
});

// --- VerticalConfig contract ---

describe("core/types: VerticalConfig contrato", () => {
  test("se puede implementar correctamente", () => {
    const mockCatalog: CatalogProvider = {
      getItems: () => [{ id: "1", name: "Test", unit: "hora", unitPrice: 50, costPrice: 30, category: "general" }],
      getCategories: () => ["general"],
      getUnits: () => [{ value: "hora", label: "Hora" }],
    };

    const config: VerticalConfig = {
      id: "test_vertical",
      brand: {
        tradeName: "Test360",
        shortName: "T360",
        description: "Vertical de prueba",
        themeColor: "#000000",
        iconKey: "wrench",
        initials: "T3",
      },
      modules: ["dashboard", "clients", "crm"],
      catalog: mockCatalog,
    };

    assert.equal(config.id, "test_vertical");
    assert.equal(config.brand.tradeName, "Test360");
    assert.equal(config.modules.length, 3);
    assert.equal(config.catalog.getItems().length, 1);
    assert.equal(config.knowledge, undefined);
  });

  test("knowledge es opcional", () => {
    const config: VerticalConfig = {
      id: "minimal",
      brand: { tradeName: "Min", shortName: "M", description: "", themeColor: "#fff", iconKey: "x", initials: "M" },
      modules: ["dashboard"],
      catalog: { getItems: () => [], getCategories: () => [], getUnits: () => [] },
    };
    assert.equal(config.knowledge, undefined);
  });
});
