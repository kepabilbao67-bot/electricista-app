import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

const originalAppVertical = process.env.APP_VERTICAL;

function resetEnv() {
  if (originalAppVertical === undefined) {
    delete process.env.APP_VERTICAL;
  } else {
    process.env.APP_VERTICAL = originalAppVertical;
  }
}

beforeEach(resetEnv);
afterEach(resetEnv);

describe("Vertical Barymont (Pedro Barymont 360) - Loader y Configuración", () => {
  test("1. APP_VERTICAL=barymont es reconocido por getVertical()", async () => {
    process.env.APP_VERTICAL = "barymont";
    const { getVertical } = await import("../core/vertical-loader");
    assert.equal(getVertical(), "barymont");
  });

  test("2. loadVerticalConfig() con barymont devuelve branding e identidad correctos", async () => {
    process.env.APP_VERTICAL = "barymont";
    const { loadVerticalConfig } = await import("../core/vertical-loader");
    const config = loadVerticalConfig();
    assert.equal(config.id, "barymont");
    assert.equal(config.brand.tradeName, "Pedro Barymont 360");
    assert.equal(config.brand.shortName, "Barymont360");
    assert.equal(config.brand.initials, "PB");
    assert.equal(config.brand.iconKey, "briefcase");
    assert.equal(config.brand.themeColor, "#047857");
  });

  test("3. Módulos activos para barymont incluyen CRM, leads, comunicaciones y no incluyen normativa eléctrica ni partes", async () => {
    process.env.APP_VERTICAL = "barymont";
    const { loadVerticalConfig } = await import("../core/vertical-loader");
    const config = loadVerticalConfig();

    // Módulos requeridos
    assert.ok(config.modules.includes("dashboard"));
    assert.ok(config.modules.includes("assistant"));
    assert.ok(config.modules.includes("clients"));
    assert.ok(config.modules.includes("crm"));
    assert.ok(config.modules.includes("leads"));
    assert.ok(config.modules.includes("communications"));
    assert.ok(config.modules.includes("chats"));
    assert.ok(config.modules.includes("schedule"));
    assert.ok(config.modules.includes("invoices"));
    assert.ok(config.modules.includes("budgets"));
    assert.ok(config.modules.includes("expenses"));
    assert.ok(config.modules.includes("catalog"));
    assert.ok(config.modules.includes("help"));
    assert.ok(config.modules.includes("export"));
    assert.ok(config.modules.includes("settings"));

    // Módulos excluidos (sectoriales electricista)
    assert.equal(config.modules.includes("normativa" as import("../core/types").ModuleId), false);
    assert.equal(config.modules.includes("work_orders" as import("../core/types").ModuleId), false);
    assert.equal(config.modules.includes("measurements" as import("../core/types").ModuleId), false);
  });

  test("4. Catálogo de Barymont contiene servicios financieros y aseguradores especializados", async () => {
    process.env.APP_VERTICAL = "barymont";
    const { loadVerticalConfig } = await import("../core/vertical-loader");
    const config = loadVerticalConfig();
    const items = config.catalog.getItems();

    assert.ok(items.length >= 8);
    const categories = config.catalog.getCategories();
    assert.ok(categories.includes("Planificación Financiera"));
    assert.ok(categories.includes("Seguros y Protección"));
    assert.ok(categories.includes("Ahorro e Inversión"));

    const itemNames = items.map((i) => i.name.toLowerCase());
    assert.ok(itemNames.some((n) => n.includes("planificación financiera")));
    assert.ok(itemNames.some((n) => n.includes("seguros")));
    assert.ok(itemNames.some((n) => n.includes("ahorro")));

    // Sin términos eléctricos
    assert.equal(itemNames.some((n) => n.includes("cuadro eléctrico") || n.includes("rebt")), false);
  });

  test("5. Aislamiento estricto: no modifica la carga de electricista ni general", async () => {
    // Electricista
    delete process.env.APP_VERTICAL;
    const { loadVerticalConfig } = await import("../core/vertical-loader");
    const elecConfig = loadVerticalConfig();
    assert.equal(elecConfig.id, "electricista");
    assert.ok(elecConfig.modules.includes("normativa"));

    // General
    process.env.APP_VERTICAL = "general";
    const genConfig = loadVerticalConfig();
    assert.equal(genConfig.id, "general");
    assert.equal(genConfig.brand.tradeName, "Autónomo360");
  });
});
