import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST as recover } from "../../app/api/password-recovery/route";
import { POST as login } from "../../app/api/session-login/route";
import { proxy } from "../../proxy";
import { useIsolatedTestDb } from "./test-db";

useIsolatedTestDb();

const post = (url: string, data: object) => new NextRequest(url, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data),
});

test("recuperación: correo autorizado, enlace único, nueva clave y revocación de sesión", async () => {
  const entries = ["APP_BASIC_AUTH_USER", "APP_BASIC_AUTH_PASSWORD", "SESSION_SECRET",
    "AUTH_RECOVERY_EMAIL", "APP_PUBLIC_URL", "RESEND_FROM_EMAIL", "RESEND_API_KEY"] as const;
  const old = Object.fromEntries(entries.map(k => [k, process.env[k]]));
  const originalFetch = globalThis.fetch;
  let sent: string | undefined;
  try {
    process.env.APP_BASIC_AUTH_USER = "qa-electricista";
    process.env.APP_BASIC_AUTH_PASSWORD = "antigua-pruebas-sin-secreto";
    process.env.SESSION_SECRET = "secret-prueba-unicamente-".repeat(3);
    process.env.AUTH_RECOVERY_EMAIL = "qa-ejemplo@example.com";
    process.env.APP_PUBLIC_URL = "https://electricista.example.com";
    process.env.RESEND_FROM_EMAIL = "qa@example.com";
    process.env.RESEND_API_KEY = "simulado-no-real";
    globalThis.fetch = async (_url, init) => {
      const mail = JSON.parse(String(init?.body));
      sent = mail.text;
      return new Response(JSON.stringify({ id: "test-mail" }), { status: 200 });
    };
    const initial = await login(post("http://localhost/api/session-login", {
      username: "qa-electricista", password: "antigua-pruebas-sin-secreto",
    }));
    assert.equal(initial.status, 200);
    const oldCookie = initial.cookies.get("electricista360_session")?.value;
    assert.ok(oldCookie);
    const wrong = await recover(post("http://localhost/api/password-recovery", {
      action: "request", email: "wrong@example.com",
    }));
    assert.equal(wrong.status, 200);
    assert.equal(sent, undefined);
    const requested = await recover(post("http://localhost/api/password-recovery", {
      action: "request", email: "qa-ejemplo@example.com",
    }));
    assert.equal(requested.status, 200);
    assert.ok(sent);
    const token = String(sent ?? "").match(/#token=([A-Za-z0-9_-]+)/)?.[1];
    assert.ok(token);
    const reset = await recover(post("http://localhost/api/password-recovery", {
      action: "confirm", token, password: "NuevaContraseñaSegura2026!",
    }));
    assert.equal(reset.status, 200, await reset.clone().text());
    const replay = await recover(post("http://localhost/api/password-recovery", {
      action: "confirm", token, password: "OtraContraseñaSegura2026!",
    }));
    assert.equal(replay.status, 400);
    const oldLogin = await login(post("http://localhost/api/session-login", {
      username: "qa-electricista", password: "antigua-pruebas-sin-secreto",
    }));
    assert.equal(oldLogin.status, 401);
    const newLogin = await login(post("http://localhost/api/session-login", {
      username: "qa-electricista", password: "NuevaContraseñaSegura2026!",
    }));
    assert.equal(newLogin.status, 200);
    const previousSession = await proxy(new NextRequest("http://localhost/documentos", {
      headers: { cookie: "electricista360_session=" + oldCookie },
    }));
    assert.equal(previousSession.status, 307);
    const currentCookie = newLogin.cookies.get("electricista360_session")?.value;
    const newSession = await proxy(new NextRequest("http://localhost/documentos", {
      headers: { cookie: "electricista360_session=" + currentCookie },
    }));
    assert.equal(newSession.status, 200);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of entries) {
      if (old[key] === undefined) delete process.env[key];
      else process.env[key] = old[key];
    }
  }
});
