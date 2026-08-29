import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { POST, GET } from "@/app/api/feedback/route";
import { resetRateLimits } from "@/lib/security";
import { NextRequest } from "next/server";

describe("API /api/feedback - Módulo de Ayuda y Sugerencias", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  test("1. Rechaza payload vacío o incompleto con status 400", async () => {
    resetRateLimits();
    const req = new NextRequest("http://localhost:3000/api/feedback", {
      method: "POST",
      body: JSON.stringify({}),
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "198.51.100.101",
      },
    });

    const res = await POST(req);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.ok(json.error);
  });

  test("2. Rechaza peticiones con campo honeypot poblado (_hp)", async () => {
    resetRateLimits();
    const req = new NextRequest("http://localhost:3000/api/feedback", {
      method: "POST",
      body: JSON.stringify({
        type: "sugerencia",
        subject: "Spam Bot Subject",
        message: "Spam Bot Message Content",
        _hp: "bot_filled_honeypot",
      }),
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "198.51.100.102",
      },
    });

    const res = await POST(req);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.match(json.error, /filtros de seguridad/);
  });

  test("3. Bloquea peticiones cuando se supera el límite de tasa (429)", async () => {
    resetRateLimits();
    const ip = "198.51.100.103";

    for (let i = 0; i < 15; i++) {
      const req = new NextRequest("http://localhost:3000/api/feedback", {
        method: "POST",
        body: JSON.stringify({
          type: "sugerencia",
          subject: `Sugerencia ${i}`,
          message: `Mensaje de prueba número ${i} para validar rate limit`,
        }),
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": ip,
        },
      });
      const res = await POST(req);
      assert.notEqual(res.status, 429);
    }

    const overflowReq = new NextRequest("http://localhost:3000/api/feedback", {
      method: "POST",
      body: JSON.stringify({
        type: "sugerencia",
        subject: "Overflow Suggestion",
        message: "Este mensaje debe ser bloqueado por exceder límite",
      }),
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

  test("4. Sanitiza tags HTML en asunto y mensaje", async () => {
    resetRateLimits();
    const req = new NextRequest("http://localhost:3000/api/feedback", {
      method: "POST",
      body: JSON.stringify({
        type: "sugerencia",
        subject: "<script>alert('xss')</script>Mejora en presupuestos",
        message: "<b>Texto en negrita</b> que debe limpiarse de etiquetas peligrosas",
        email: "test@ejemplo.com",
      }),
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "198.51.100.104",
      },
    });

    const res = await POST(req);
    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(!json.feedback.subject.includes("<script>"));
    assert.ok(!json.feedback.message.includes("<b>"));
  });

  test("5. Persiste y recupera feedback a través de GET /api/feedback", async () => {
    resetRateLimits();
    const uniqueSubject = `Sugerencia Test ${Date.now()}`;
    const reqPost = new NextRequest("http://localhost:3000/api/feedback", {
      method: "POST",
      body: JSON.stringify({
        type: "duda",
        subject: uniqueSubject,
        message: "Consulta detallada sobre el funcionamiento de TicketBAI en Álava",
      }),
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "198.51.100.105",
      },
    });

    const postRes = await POST(reqPost);
    assert.equal(postRes.status, 201);

    const getRes = await GET();
    assert.equal(getRes.status, 200);
    const list = await getRes.json();
    assert.ok(Array.isArray(list));
    const found = list.find((item: any) => item.subject === uniqueSubject);
    assert.ok(found);
    assert.equal(found.type, "duda");
    assert.equal(found.status, "recibido");
  });
});
