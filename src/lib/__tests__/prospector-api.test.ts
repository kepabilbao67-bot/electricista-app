import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { POST } from "@/app/api/prospector/route";
import { resetRateLimits } from "@/lib/security";
import { NextRequest } from "next/server";

describe("API /api/prospector - Endpoint de Prospección B2B", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  test("Rechaza peticiones con JSON inválido con status 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/prospector", {
      method: "POST",
      body: "not-a-json",
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.match(json.error, /JSON válido/);
  });

  test("Rechaza peticiones sin sector con status 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/prospector", {
      method: "POST",
      body: JSON.stringify({ location: "Bizkaia" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.match(json.error, /sector.*obligatorio/);
  });

  test("Rechaza peticiones sin location con status 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/prospector", {
      method: "POST",
      body: JSON.stringify({ sector: "Electricistas" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.match(json.error, /location.*obligatorio/);
  });

  test("Rechaza limit inválido con status 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/prospector", {
      method: "POST",
      body: JSON.stringify({ sector: "Electricistas", location: "Bizkaia", limit: -5 }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.match(json.error, /limit.*entero positivo/);
  });

  test("Rechaza peticiones con campo honeypot poblado (_hp)", async () => {
    const req = new NextRequest("http://localhost:3000/api/prospector", {
      method: "POST",
      body: JSON.stringify({
        sector: "Electricistas",
        location: "Bizkaia",
        _hp: "bot-payload",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.match(json.error, /filtros de seguridad/);
  });
});
