import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { electricistaDomainAdapter } from "@/lib/assistant/electricista-adapter";
import { parseVoiceOrder } from "@/lib/voice-order-parser";
import { Voice360Client, processElectricistaVoice } from "@/lib/assistant/voice360-client";
import { POST as handleVoice360Route } from "@/app/api/asistente/voice360/route";

describe("COM360-V2.1 — Electricista360 Voice360 Adapter & Client (Zero Core Duplication)", () => {

  test("1. Adapter eléctrico normaliza jerga técnica de electricista", async () => {
    assert.ok(electricistaDomainAdapter.normalizeInput);
    const normalized = await Promise.resolve(electricistaDomainAdapter.normalizeInput!("Pon un magneto de 16A y una manguera de 3x2.5"));
    assert.ok(normalized.includes("magnetotérmico"));
    assert.ok(normalized.includes("cable manguera"));
  });

  test("2. Adapter eléctrico enriquece contexto con proveedor SOKOEL", async () => {
    assert.ok(electricistaDomainAdapter.enrichContext);
    const ctx = await Promise.resolve(electricistaDomainAdapter.enrichContext!("tenant-elec-1", "Necesito material de sokoel"));
    assert.equal(ctx.vertical, "electricista");
    assert.equal(ctx.supplierName, "SOKOEL");
    assert.equal(ctx.supplierCatalogAvailable, true);
    assert.equal(ctx.isSupplierIntent, true);
    assert.equal(ctx.tenantId, "tenant-elec-1");
  });

  test("3. Adapter eléctrico resuelve materiales de catálogo SOKOEL", async () => {
    assert.ok(electricistaDomainAdapter.resolveCatalogItem);
    const results = await Promise.resolve(electricistaDomainAdapter.resolveCatalogItem!("schuko", "tenant-elec-1"));
    assert.ok(Array.isArray(results));
    assert.ok(results.length > 0);
    assert.ok(results[0].name.toLowerCase().includes("schuko") || results[0].supplier_reference?.includes("schuko") || results[0].category === "Mecanismos");
    assert.ok(results[0].unit_price > 0);
  });

  test("4. Adapter eléctrico post-procesa resultados con prefijo vertical", async () => {
    assert.ok(electricistaDomainAdapter.postProcessResult);
    const sampleResult: any = {
      success: true,
      action: "budget_draft",
      summary: "Borrador preparado",
      intent: "budget_draft",
    };
    const processed = await Promise.resolve(electricistaDomainAdapter.postProcessResult!(sampleResult));
    assert.equal(processed.intent, "electricista:budget_draft");
  });

  test("5. Parser de pedidos de material por voz (pedidos-voz) sigue funcionando", () => {
    const text = "Pide 5 interruptores diferenciales de 40A y 100 metros de cable manguera para mañana";
    const order = parseVoiceOrder(text);
    assert.ok(order);
    assert.ok(order.items.length >= 1);
  });

  test("6. Voice360Client envía request correcto con tenant y contexto hacia core canónico", async () => {
    let capturedUrl = "";
    let capturedBody: any = null;
    let capturedHeaders: any = null;

    const mockFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      capturedUrl = url.toString();
      capturedHeaders = init?.headers;
      capturedBody = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({
          success: true,
          action: "budget_draft",
          summary: "Borrador de presupuesto para Juan",
          intent: "budget_draft",
          budget: { client_name: "Juan", lines: [] },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as typeof fetch;

    try {
      const client = new Voice360Client({ baseUrl: "http://test-voice360:3088", enabled: true });
      const res = await client.process({
        tenantId: "tenant-electricista-100",
        input: "Presupuesto para Juan",
        requestId: "req-12345",
        channel: "whatsapp",
        context: { vertical: "electricista", supplier: "SOKOEL" },
      });

      assert.equal(capturedUrl, "http://test-voice360:3088/api/asistente/voice360");
      assert.equal(capturedHeaders["x-tenant-id"], "tenant-electricista-100");
      assert.equal(capturedBody.tenantId, "tenant-electricista-100");
      assert.equal(capturedBody.input, "Presupuesto para Juan");
      assert.equal(capturedBody.context.supplier, "SOKOEL");
      assert.equal(res.success, true);
      assert.equal(res.action, "budget_draft");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("7. Fallback controlado: Voice360Client cuando VOICE360_ENABLED=false", async () => {
    const client = new Voice360Client({ enabled: false });
    const res = await client.process({
      tenantId: "tenant-1",
      input: "Hola",
    });
    assert.equal(res.success, false);
    assert.equal(res.error, "VOICE360_DISABLED");
  });

  test("8. Manejo de error/timeout de red controlado sin lanzar excepciones no capturadas", async () => {
    const mockFetchFail = async (): Promise<Response> => {
      throw new Error("Connection refused (ECONNREFUSED)");
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetchFail as typeof fetch;

    try {
      const client = new Voice360Client({ baseUrl: "http://invalid-host:9999", enabled: true });
      const res = await client.process({
        tenantId: "tenant-1",
        input: "Test input",
      });
      assert.equal(res.success, false);
      assert.equal(res.error, "VOICE360_CONNECTION_ERROR");
      assert.ok(res.summary.includes("No se pudo conectar"));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("9. Pipeline processElectricistaVoice aplica normalización + adapter + client de extremo a extremo", async () => {
    let receivedInput = "";
    const mockFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const b = JSON.parse(init?.body as string);
      receivedInput = b.input;
      return new Response(
        JSON.stringify({
          success: true,
          action: "budget_draft",
          summary: "Presupuesto creado",
          intent: "budget_draft",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as typeof fetch;

    try {
      const res = await processElectricistaVoice("Pon un magneto de 20A", {
        tenantId: "tenant-elec-42",
        config: { baseUrl: "http://test-voice360:3088", enabled: true }
      });

      assert.ok(receivedInput.includes("magnetotérmico"));
      assert.equal(res.success, true);
      assert.equal(res.intent, "electricista:budget_draft");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("10. Seguridad: confirmation_required / pending_action NUNCA se auto-ejecuta en Electricista", async () => {
    const mockPendingResponse = async (): Promise<Response> => {
      return new Response(
        JSON.stringify({
          success: true,
          action: "confirmation_required",
          summary: "Acción sensible requiere confirmación",
          ticket: {
            token: "temp-token-test",
            action: "delete_database",
            summary: "Borrar registros",
            expires_at: "2026-12-31T23:59:59Z"
          },
          pending_action: {
            action: "delete_database",
            payload: { force: true }
          }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockPendingResponse as typeof fetch;

    try {
      const res = await processElectricistaVoice("Borra los datos", {
        tenantId: "tenant-elec-42",
        config: { baseUrl: "http://test-voice360:3088", enabled: true }
      });

      assert.equal(res.action, "confirmation_required");
      assert.ok(res.pending_action);
      assert.equal(res.pending_action.action, "delete_database");
      // Verify no auto-execution occurred
      assert.notEqual(res.action, "deleted");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("11. Verificación estructural: NO existe código duplicado del core voice360 ni confirmation tickets en Electricista360", () => {
    const voice360Path = path.join(process.cwd(), "src/lib/assistant/voice360.ts");
    const ticketsPath = path.join(process.cwd(), "src/lib/assistant/confirmation-tickets.ts");
    const oldVoiceTest = path.join(process.cwd(), "src/lib/__tests__/voice360.test.ts");

    assert.equal(fs.existsSync(voice360Path), false, "voice360.ts core NO debe existir en Electricista360");
    assert.equal(fs.existsSync(ticketsPath), false, "confirmation-tickets.ts NO debe existir en Electricista360");
    assert.equal(fs.existsSync(oldVoiceTest), false, "voice360.test.ts duplicado NO debe existir en Electricista360");
  });

  test("12. Compatibilidad de endpoint HTTP existente /api/asistente/voice360", async () => {
    const mockFetch = async (): Promise<Response> => {
      return new Response(
        JSON.stringify({
          success: true,
          action: "budget_draft",
          summary: "Presupuesto OK",
          intent: "budget_draft",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as typeof fetch;

    try {
      const req = new NextRequest("http://localhost:3000/api/asistente/voice360", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": "tenant-http-elec",
        },
        body: JSON.stringify({
          input: "Presupuesto para Juan por cuadro eléctrico",
        }),
      });

      const res = await handleVoice360Route(req);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.intent, "electricista:budget_draft");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

});
