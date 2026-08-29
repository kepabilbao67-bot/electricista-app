import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { POST } from "@/app/api/leads/route";
import { resetRateLimits } from "@/lib/security";
import { NextRequest } from "next/server";

describe("API /api/leads - Capa de Seguridad y Anti-Spam", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  test("1. Rechaza peticiones con campo honeypot poblado (_hp)", async () => {
    const req = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      body: JSON.stringify({
        name: "Bot Lead",
        email: "bot@spam.com",
        _hp: "automated-bot-text",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.match(json.error, /filtros de seguridad/);
  });

  test("2. Rechaza peticiones sin nombre con status 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      body: JSON.stringify({
        email: "usuario@ejemplo.com",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.match(json.error, /nombre es obligatorio/);
  });

  test("3. Bloquea peticiones cuando se supera el límite de tasa por IP", async () => {
    const ip = "198.51.100.99";

    // Enviar 15 peticiones permitidas
    for (let i = 0; i < 15; i++) {
      const req = new NextRequest("http://localhost:3000/api/leads", {
        method: "POST",
        body: JSON.stringify({ name: `Lead ${i}` }),
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": ip,
        },
      });
      const res = await POST(req);
      assert.notEqual(res.status, 429);
    }

    // La 16ª petición debe ser bloqueada por rate limit
    const overflowReq = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      body: JSON.stringify({ name: "Overflow Lead" }),
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": ip,
      },
    });

    const res = await POST(overflowReq);
    assert.equal(res.status, 429);
    const json = await res.json();
    assert.match(json.error, /Límite de tasa excedido/);
  });
});
