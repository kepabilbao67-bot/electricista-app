import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { interpretVoiceOrder } from "@/lib/voice-order-service";
import { POST as handleInterpretar } from "@/app/api/pedidos-voz/interpretar/route";
import { POST as handleSaveOrder } from "@/app/api/pedidos-voz/route";
import { createClient } from "@libsql/client";
import { initializeDatabase, setDbClientForTesting, resetDbClient } from "@/lib/db";

describe("COM360-V3 — Pedidos-Voz → Voice360 Canónico Integration Suite", () => {

  test("1. Pedido simple por voz cuantificado", async () => {
    const res = await interpretVoiceOrder("Pedir 5 magnetotérmicos de 16A para mañana", {
      referenceDate: new Date(2026, 8, 16, 10, 0, 0),
      config: { enabled: false }
    });
    assert.equal(res.success, true);
    assert.equal(res.status, "PENDING_APPROVAL");
    assert.equal(res.items.length, 1);
    assert.equal(res.items[0].quantity, 5);
    assert.equal(res.neededDate, "2026-09-17");
    assert.equal(res.neededDateLabel, "mañana");
  });

  test("2. Jerga eléctrica normalizada mediante adapter ('magneto', 'manguera', 'dife')", async () => {
    const res = await interpretVoiceOrder("Necesito 3 magnetos de 20A y 50 metros de manguera para hoy", {
      referenceDate: new Date(2026, 8, 16, 10, 0, 0),
      config: { enabled: false }
    });
    assert.equal(res.success, true);
    assert.equal(res.items.length, 2);
    assert.ok(res.items[0].product.toLowerCase().includes("magnetotérmico"));
    assert.ok(res.items[1].product.toLowerCase().includes("cable manguera"));
  });

  test("3. Material SOKOEL resuelto con catálogo y pricing orientativo", async () => {
    const res = await interpretVoiceOrder("Pide 4 bases de enchufe schuko para el viernes", {
      config: { enabled: false }
    });
    assert.equal(res.success, true);
    assert.ok(res.items.length >= 1);
    const schukoItem = res.items[0];
    assert.ok(schukoItem.catalog_item);
    assert.equal(schukoItem.catalog_item.category, "Mecanismos");
    assert.ok(schukoItem.catalog_item.unit_price > 0);
    assert.ok(res.safeDraft.estimatedCostTotal > 0);
  });

  test("4. Material no encontrado en catálogo no rompe y se conserva como texto libre", async () => {
    const res = await interpretVoiceOrder("Necesito 2 taladros percutores especiales de 800W", {
      config: { enabled: false }
    });
    assert.equal(res.success, true);
    assert.equal(res.items.length, 1);
    assert.ok(res.items[0].product.toLowerCase().includes("taladros percutores"));
    assert.equal(res.items[0].catalog_item, undefined);
    assert.equal(res.safeDraft.hasUnresolvedItems, true);
  });

  test("5. Múltiples materiales combinados en una sola locución", async () => {
    const res = await interpretVoiceOrder("3 diferenciales de 40A, 100 metros de tubo y 10 downlights led para pasado mañana", {
      referenceDate: new Date(2026, 8, 16, 10, 0, 0),
      config: { enabled: false }
    });
    assert.equal(res.success, true);
    assert.equal(res.items.length, 3);
    assert.equal(res.neededDateLabel, "pasado mañana");
    assert.equal(res.neededDate, "2026-09-18");
  });

  test("6. Tenant A/B aislados en llamadas a Voice360", async () => {
    let capturedTenant = "";
    const mockFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      capturedTenant = (init?.headers as any)?.["x-tenant-id"];
      return new Response(
        JSON.stringify({ success: true, action: "order_draft", summary: "Order OK" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as typeof fetch;

    try {
      const res = await interpretVoiceOrder("2 magnetotérmicos de 16A", {
        tenantId: "tenant-electricista-premium-99",
        config: { baseUrl: "http://mock-voice360:3088", enabled: true }
      });
      assert.equal(capturedTenant, "tenant-electricista-premium-99");
      assert.equal(res.voice360_active, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("7. Fallback seguro cuando Voice360 está deshabilitado", async () => {
    const res = await interpretVoiceOrder("5 magnetotérmicos de 16A", {
      config: { enabled: false }
    });
    assert.equal(res.success, true);
    assert.equal(res.voice360_active, false);
    assert.equal(res.status, "PENDING_APPROVAL");
  });

  test("8. Timeout / Error de conexión con Voice360 no rompe la experiencia del usuario", async () => {
    const mockFetchFail = async (): Promise<Response> => {
      throw new Error("Connection timeout / ECONNREFUSED");
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetchFail as typeof fetch;

    try {
      const res = await interpretVoiceOrder("5 magnetotérmicos de 16A", {
        config: { baseUrl: "http://unreachable-host:9999", enabled: true, timeoutMs: 100 }
      });
      assert.equal(res.success, true);
      assert.equal(res.voice360_active, false);
      assert.equal(res.status, "PENDING_APPROVAL");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("9. Human Gate estricto: pendingAction requiere confirmación y NO auto-envía a proveedor", async () => {
    const res = await interpretVoiceOrder("10 diferenciales de 40A para hoy", {
      config: { enabled: false }
    });
    assert.equal(res.status, "PENDING_APPROVAL");
    assert.ok(res.pendingAction);
    assert.equal(res.pendingAction.requires_human_approval, true);
    assert.equal(res.pendingAction.auto_send_supplier, false);
  });

  test("10. Seguridad: Token claro nunca se persiste ni se expone", async () => {
    const res = await interpretVoiceOrder("5 magnetos de 16A", {
      config: { enabled: false }
    });
    const serialized = JSON.stringify(res);
    assert.equal(serialized.includes("secret_token"), false);
    assert.equal(serialized.includes("bearer_token"), false);
  });

  test("11. Compatibilidad total de API endpoints: /api/pedidos-voz/interpretar y /api/pedidos-voz", async () => {
    const testDb = createClient({ url: "file::memory:" });
    await initializeDatabase(testDb);
    setDbClientForTesting(testDb);

    try {
      // 1. Interpretar
      const reqInterpretar = new NextRequest("http://localhost:3000/api/pedidos-voz/interpretar", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": "tenant-test-api" },
        body: JSON.stringify({ text: "3 magnetotérmicos de 16A para mañana" }),
      });
      const resInterpretar = await handleInterpretar(reqInterpretar);
      assert.equal(resInterpretar.status, 200);
      const jsonInterpretar = await resInterpretar.json();
      assert.equal(jsonInterpretar.success, true);
      assert.equal(jsonInterpretar.status, "PENDING_APPROVAL");

      // 2. Guardar pedido confirmado
      const reqSave = new NextRequest("http://localhost:3000/api/pedidos-voz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalText: jsonInterpretar.originalText,
          neededDate: jsonInterpretar.neededDate,
          observations: "Urgente obra centro",
          items: jsonInterpretar.items.map((i: any) => ({
            product: i.product,
            quantity: i.quantity,
            unit: i.unit,
            observations: i.observations || "",
          })),
        }),
      });
      const resSave = await handleSaveOrder(reqSave);
      assert.equal(resSave.status, 201);
      const jsonSave = await resSave.json();
      assert.ok(jsonSave.id);
      assert.equal(jsonSave.status, "confirmed");
    } finally {
      resetDbClient();
      testDb.close();
    }
  });

  test("12. Cero duplicación: Core Voice360 y confirmation tickets NO existen como copias en Electricista360", () => {
    const voice360Core = path.join(process.cwd(), "src/lib/assistant/voice360.ts");
    const ticketsCore = path.join(process.cwd(), "src/lib/assistant/confirmation-tickets.ts");

    assert.equal(fs.existsSync(voice360Core), false, "voice360.ts NO debe existir en Electricista360");
    assert.equal(fs.existsSync(ticketsCore), false, "confirmation-tickets.ts NO debe existir en Electricista360");
  });

});
