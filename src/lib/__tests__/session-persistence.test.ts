import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "../../app/api/session-login/route";
import { proxy } from "../../proxy";
import { useIsolatedTestDb } from "./test-db";

useIsolatedTestDb();

test("la sesión firmada dura 30 días y abre ruta protegida sin repetir contraseña", async () => {
  const keys = ["APP_BASIC_AUTH_USER", "APP_BASIC_AUTH_PASSWORD", "SESSION_SECRET"] as const;
  const before = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  try {
    process.env.APP_BASIC_AUTH_USER = "usuario-pruebas";
    process.env.APP_BASIC_AUTH_PASSWORD = "clave-pruebas-única";
    process.env.SESSION_SECRET = "solo-para-pruebas-locales-no-publicar-" + "x".repeat(32);
    const req = new NextRequest("http://localhost:3180/api/session-login", {
      method: "POST", headers: {"content-type":"application/json"},
      body: JSON.stringify({ username: "usuario-pruebas", password: "clave-pruebas-única" }),
    });
    const login = await POST(req);
    assert.equal(login.status, 200);
    const cookie = login.cookies.get("electricista360_session");
    assert.ok(cookie?.value);
    assert.equal(cookie.maxAge, 30 * 24 * 60 * 60);
    const authorized = await proxy(new NextRequest("http://localhost:3180/documentos", {
      headers: { cookie: "electricista360_session=" + cookie.value },
    }));
    assert.equal(authorized.status, 200);
    const denied = await proxy(new NextRequest("http://localhost:3180/api/catalog"));
    assert.equal(denied.status, 401);
  } finally {
    for (const key of keys) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
  }
});
