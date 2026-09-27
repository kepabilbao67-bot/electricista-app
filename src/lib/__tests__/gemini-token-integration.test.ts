import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { POST as tokenPost } from "@/app/api/asistente/gemini-live/token/route";
import { GeminiLiveClient } from "@/lib/assistant/gemini-live-client";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

class FakeSocket {
  readyState = 0;
  sent: string[] = [];
  closed = false;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  send(data: string) { this.sent.push(data); }
  close() { this.closed = true; this.readyState = 3; }
  open() { this.readyState = 1; this.onopen?.({} as Event); }
  message(data: object) { this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent); }
  error() { this.onerror?.({} as Event); }
  remoteClose() { this.readyState = 3; this.onclose?.({} as CloseEvent); }
}

function harness(options: { setupTimeoutMs?: number; maxReconnectAttempts?: number; reconnectBaseDelayMs?: number } = {}) {
  const sockets: FakeSocket[] = [];
  let tokenRequests = 0;
  const client = new GeminiLiveClient({
    ...options,
    fetchImpl: async () => {
      tokenRequests += 1;
      return new Response(JSON.stringify({
        token: `ephemeral-${tokenRequests}`,
        expiresAt: "2026-09-23T12:30:00.000Z",
        model: "gemini-3.8-live",
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
    webSocketFactory: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket as unknown as WebSocket;
    },
  });
  return { client, sockets, tokenRequests: () => tokenRequests };
}

async function nextTick() { await new Promise((resolve) => setTimeout(resolve, 0)); }

describe("Gemini Live P0.1", () => {
  test("token endpoint sin autenticación queda bloqueado", async () => {
    const response = await tokenPost(new NextRequest("http://localhost/api/asistente/gemini-live/token", { method: "POST" }));
    assert.equal(response.status, 401);
  });

  test("clave maestra solo en servidor y respuesta mínima", () => {
    const route = read("src/app/api/asistente/gemini-live/token/route.ts");
    const client = read("src/lib/assistant/gemini-live-client.ts");
    assert.match(route, /process\.env\.GEMINI_API_KEY/);
    assert.doesNotMatch(client, /GEMINI_API_KEY|NEXT_PUBLIC_GEMINI_API_KEY|AIza/);
    assert.doesNotMatch(route, /apiKey\s*:/);
    assert.match(route, /\{ token: data\.name, expiresAt: data\.expireTime \|\| expiresAt, model \}/);
    assert.doesNotMatch(route + client, /console\.(log|info|debug)/);
  });

  test("setup es el primer y único mensaje antes de SetupComplete", async () => {
    const h = harness();
    const connecting = h.client.connect();
    await nextTick();
    assert.equal(h.sockets.length, 1);
    assert.deepEqual(h.sockets[0].sent, []);
    h.sockets[0].open();
    assert.equal(h.client.getState(), "WAITING_SETUP");
    assert.equal(h.sockets[0].sent.length, 1);
    const first = JSON.parse(h.sockets[0].sent[0]);
    assert.equal(first.setup.model, "models/gemini-3.8-live");
    assert.deepEqual(first.setup.generationConfig.responseModalities, ["AUDIO"]);
    h.sockets[0].message({ setupComplete: {} });
    await connecting;
    assert.equal(h.client.getState(), "CONNECTED");
    assert.equal(h.sockets[0].sent.length, 1);
    h.client.close();
  });

  test("timeout de setup termina en ERROR para activar fallback", async () => {
    const h = harness({ setupTimeoutMs: 5, maxReconnectAttempts: 0 });
    const connecting = h.client.connect();
    await nextTick();
    h.sockets[0].open();
    await assert.rejects(connecting, /GEMINI_SETUP_TIMEOUT/);
    assert.equal(h.client.getState(), "ERROR");
  });

  test("error de socket termina en ERROR para activar fallback", async () => {
    const h = harness({ maxReconnectAttempts: 0 });
    const connecting = h.client.connect();
    await nextTick();
    h.sockets[0].error();
    await assert.rejects(connecting, /GEMINI_CONNECT_ERROR/);
    assert.equal(h.client.getState(), "ERROR");
  });

  test("close limpia socket, sesión y estado", async () => {
    const h = harness();
    const connecting = h.client.connect();
    await nextTick();
    h.sockets[0].open();
    h.sockets[0].message({ setupComplete: {} });
    await connecting;
    h.client.close();
    assert.equal(h.client.getState(), "IDLE");
    assert.equal(h.sockets[0].closed, true);
  });

  test("dos connect concurrentes crean un solo token y socket", async () => {
    const h = harness();
    const first = h.client.connect();
    const second = h.client.connect();
    await nextTick();
    assert.equal(h.tokenRequests(), 1);
    assert.equal(h.sockets.length, 1);
    h.sockets[0].open();
    h.sockets[0].message({ setupComplete: {} });
    await Promise.all([first, second]);
    h.client.close();
  });

  test("GoAway reanuda con handle y backoff limitado", async () => {
    const h = harness({ reconnectBaseDelayMs: 1, maxReconnectAttempts: 1 });
    const connecting = h.client.connect();
    await nextTick();
    h.sockets[0].open();
    h.sockets[0].message({ sessionResumptionUpdate: { resumable: true, newHandle: "resume-1" } });
    h.sockets[0].message({ setupComplete: {} });
    await connecting;
    h.sockets[0].message({ goAway: { timeLeft: "1s" } });
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(h.sockets.length, 2);
    h.sockets[1].open();
    const setup = JSON.parse(h.sockets[1].sent[0]);
    assert.equal(setup.setup.sessionResumption.handle, "resume-1");
    h.client.close();
  });

  test("cinco ciclos connect/close no acumulan sockets", async () => {
    const h = harness();
    for (let index = 0; index < 5; index += 1) {
      const connecting = h.client.connect();
      await nextTick();
      const socket = h.sockets[index];
      socket.open();
      socket.message({ setupComplete: {} });
      await connecting;
      h.client.close();
      assert.equal(socket.closed, true);
      assert.equal(h.client.getState(), "IDLE");
    }
    assert.equal(h.sockets.length, 5);
    assert.equal(h.tokenRequests(), 5);
  });

  test("flag OFF por defecto conserva el motor Voz360", () => {
    assert.match(read(".env.example"), /ENABLE_GEMINI_LIVE=false/);
    assert.match(read("src/app/asistente/page.tsx"), /fetch\("\/api\/asistente\/voice360"/);
  });

  /**
   * REGRESIÓN (defecto real, verificado contra la API en vivo)
   *
   * Gemini Live contesta en FRAME BINARIO y, en un navegador, `binaryType` es
   * "blob" por defecto. El cliente exigía `typeof raw === "string"` y descartaba
   * el mensaje, así que `setupComplete` no se detectaba nunca y la sesión se
   * quedaba colgada hasta el timeout. Aquí se comprueba que un frame binario
   * (ArrayBuffer, que es lo que entrega el navegador con binaryType="arraybuffer")
   * SÍ se decodifica y la sesión pasa a CONNECTED.
   */
  test("acepta setupComplete en FRAME BINARIO, no sólo en texto", async () => {
    const h = harness();
    const connecting = h.client.connect();
    await nextTick();
    h.sockets[0].open();
    assert.equal(h.client.getState(), "WAITING_SETUP");

    // Igual que el navegador: el mensaje llega como bytes, no como string.
    const bytes = new TextEncoder().encode(JSON.stringify({ setupComplete: {} }));
    h.sockets[0].onmessage?.({ data: bytes.buffer } as MessageEvent);

    await connecting;
    assert.equal(h.client.getState(), "CONNECTED", "un frame binario debe completar el setup");
    h.client.close();
    assert.equal(h.client.getState(), "IDLE");
  });

  test("pide binaryType=arraybuffer al abrir el socket", async () => {
    const h = harness();
    const connecting = h.client.connect();
    await nextTick();
    // El cliente debe pedir ArrayBuffer: con el "blob" por defecto del navegador
    // no podría decodificar el mensaje de forma síncrona.
    assert.equal((h.sockets[0] as unknown as { binaryType?: string }).binaryType, "arraybuffer");
    h.sockets[0].open();
    h.sockets[0].message({ setupComplete: {} });
    await connecting;
    h.client.close();
  });
});
