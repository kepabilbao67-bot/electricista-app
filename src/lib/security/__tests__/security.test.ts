import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit, resetRateLimits } from "../rate-limiter";
import { validateHoneypot } from "../honeypot";
import { getClientIp } from "../client-ip";
import { NextRequest } from "next/server";

describe("Autónomo 360 - Capa de Seguridad Anti-Spam y Rate Limiting", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  test("1. checkRateLimit permite solicitudes por debajo del límite y bloquea al exceder", () => {
    const ip = "192.168.1.50";
    const maxReq = 3;
    const windowMs = 5000;

    assert.equal(checkRateLimit(ip, maxReq, windowMs).allowed, true);
    assert.equal(checkRateLimit(ip, maxReq, windowMs).allowed, true);
    assert.equal(checkRateLimit(ip, maxReq, windowMs).allowed, true);

    const blockedResult = checkRateLimit(ip, maxReq, windowMs);
    assert.equal(blockedResult.allowed, false);
    assert.ok(typeof blockedResult.retryAfter === "number");
    assert.ok(blockedResult.retryAfter! > 0);
  });

  test("2. checkRateLimit aísla límites por dirección IP", () => {
    const ipA = "10.0.0.1";
    const ipB = "10.0.0.2";
    const maxReq = 2;

    assert.equal(checkRateLimit(ipA, maxReq).allowed, true);
    assert.equal(checkRateLimit(ipA, maxReq).allowed, true);
    assert.equal(checkRateLimit(ipA, maxReq).allowed, false);

    // ipB debe seguir estando permitida
    assert.equal(checkRateLimit(ipB, maxReq).allowed, true);
  });

  test("3. validateHoneypot detecta campo trampa rellenado por bots", () => {
    assert.deepEqual(validateHoneypot("bot-value"), {
      isSpam: true,
      reason: "Honeypot field triggered",
    });

    assert.deepEqual(validateHoneypot(""), {
      isSpam: false,
    });

    assert.deepEqual(validateHoneypot(undefined), {
      isSpam: false,
    });
  });

  test("4. validateHoneypot detecta envíos inhumanamente rápidos", () => {
    const now = Date.now();
    // Envío hace solo 100ms (umbral mínimo 800ms)
    const result = validateHoneypot("", now - 100, 800);
    assert.equal(result.isSpam, true);
    assert.equal(result.reason, "Form submitted unnaturally fast");

    // Envío legítimo tras 2 segundos
    const legitimateResult = validateHoneypot("", now - 2000, 800);
    assert.equal(legitimateResult.isSpam, false);
  });

  test("5. getClientIp extrae cabeceras x-forwarded-for y x-real-ip", () => {
    const reqForwarded = new NextRequest("http://localhost/api/test", {
      headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18" },
    });
    assert.equal(getClientIp(reqForwarded), "203.0.113.195");

    const reqRealIp = new NextRequest("http://localhost/api/test", {
      headers: { "x-real-ip": "198.51.100.4" },
    });
    assert.equal(getClientIp(reqRealIp), "198.51.100.4");

    const reqDefault = new NextRequest("http://localhost/api/test");
    assert.equal(getClientIp(reqDefault), "127.0.0.1");
  });

  // --- CASOS DE BORDE (EDGE CASES) ---

  test("6. [Borde] validateHoneypot detecta inyecciones de scripts o payloads complejos en honeypot", () => {
    const maliciousPayloads = [
      "<script>alert(1)</script>",
      "   spaces_with_text   ",
      12345,
      { malicious: true },
      ["bot", "data"],
    ];

    for (const payload of maliciousPayloads) {
      const res = validateHoneypot(payload as any);
      assert.equal(res.isSpam, true, `Payload debe ser detectado como spam: ${JSON.stringify(payload)}`);
    }
  });

  test("7. [Borde] validateHoneypot maneja timestamps futuros o inválidos con robustez", () => {
    const futureTimestamp = Date.now() + 100000;
    // Si el timestamp está en el futuro, no es un comportamiento humano válido
    const futureResult = validateHoneypot("", futureTimestamp, 800);
    assert.equal(futureResult.isSpam, true);

    // Timestamps no numéricos o NaN no deben romper la ejecución
    const nanResult = validateHoneypot("", "invalid-date" as any, 800);
    assert.equal(nanResult.isSpam, false);
  });

  test("8. [Borde] checkRateLimit maneja IPs vacías o con espacios asignando fallback seguro", () => {
    const emptyIp = "   ";
    assert.equal(checkRateLimit(emptyIp, 2).allowed, true);
    assert.equal(checkRateLimit(emptyIp, 2).allowed, true);
    assert.equal(checkRateLimit(emptyIp, 2).allowed, false);
  });
});
