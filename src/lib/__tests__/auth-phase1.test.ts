/**
 * ELECTRICISTA360 — AUTH FASE 1 · Pruebas de autenticación y sesión
 *
 * Cubre los requisitos obligatorios de la Fase 1:
 *   - sin sesión → privado rechazado
 *   - login incorrecto → rechazado
 *   - login correcto → sesión creada
 *   - cookie con flags correctos
 *   - API privada sin sesión → nunca 200
 *   - API privada con sesión → permitida
 *   - tenant incorrecto → rechazado
 *   - logout → la sesión deja de ser válida
 *   - endpoint de diagnóstico /api/health/db sin secreto → fail-closed (nunca 200)
 *   - Basic Auth ya no bloquea globalmente la app
 *
 * AISLAMIENTO: se usa una base de datos en memoria. NUNCA se toca
 * `electricista.db` ni Turso. No se crea ningún usuario real.
 */

import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { createClient, type Client } from "@libsql/client";

import { resetDbClient, setDbClientForTesting } from "../db";
import { applyAuthSchema, authSchemaExists } from "../auth/schema";
import { createUser } from "../auth/store";
import {
  createSignedSessionValue,
  generateSessionToken,
  hashSessionToken,
  serializeSessionCookie,
} from "../auth/session";

import { proxy } from "../../proxy";
import { POST as loginRoute } from "../../app/api/auth/login/route";
import { POST as logoutRoute } from "../../app/api/auth/logout/route";
import { GET as sessionRoute } from "../../app/api/auth/session/route";
// Ruta PROPIA de Electricista360 (endpoint de diagnóstico del producto) para
// comprobar que una ruta administrativa tiene su PROPIA guarda fail-closed además
// de la del proxy. La cobertura de auth se hace sobre una ruta de este producto.
import { GET as healthDbRoute } from "../../app/api/health/db/route";

const SESSION_SECRET_TEST = "electricista360-test-secret-32chars-minimum";
const USER_TENANT = "tenant-fase1-test";
const OTHER_TENANT = "tenant-ajeno";
const USER_EMAIL = "fase1.test@example.invalid";
const USER_PASSWORD = "ContraseñaDePrueba-123456";

/** Variables de entorno que estas pruebas modifican, para restaurarlas después. */
const TOUCHED_ENV = [
  "SESSION_SECRET",
  "APP_BASIC_AUTH_USER",
  "APP_BASIC_AUTH_PASSWORD",
  "HEALTH_CHECK_SECRET",
  "SESSION_TTL_HOURS",
  "SESSION_IDLE_HOURS",
] as const;

let savedEnv: Record<string, string | undefined> = {};
let db: Client;

function makeRequest(
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: unknown }
): NextRequest {
  const method = init?.method ?? "GET";
  return new NextRequest(url, {
    method,
    headers: {
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
}

/** Extrae el par `nombre=valor` de una cabecera Set-Cookie. */
function cookiePairFromSetCookie(setCookie: string): string {
  return setCookie.split(";")[0];
}

/** Inicia sesión y devuelve la cookie utilizable en peticiones posteriores. */
async function loginAndGetCookie(): Promise<{ setCookie: string; cookie: string }> {
  const response = await loginRoute(
    makeRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: { email: USER_EMAIL, password: USER_PASSWORD },
    })
  );
  assert.equal(response.status, 200, "el login de prueba debería funcionar");
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie, "el login debe emitir Set-Cookie");
  return { setCookie: setCookie as string, cookie: cookiePairFromSetCookie(setCookie as string) };
}

describe("AUTH FASE 1 — login propio, sesión por cookie y fail-closed", () => {
  before(async () => {
    for (const key of TOUCHED_ENV) {
      savedEnv[key] = process.env[key];
    }
    process.env.SESSION_SECRET = SESSION_SECRET_TEST;
    delete process.env.APP_BASIC_AUTH_USER;
    delete process.env.APP_BASIC_AUTH_PASSWORD;
    delete process.env.HEALTH_CHECK_SECRET;

    db = createClient({ url: "file::memory:" });
    setDbClientForTesting(db);
    await applyAuthSchema(db);

    await createUser(
      { tenantId: USER_TENANT, email: USER_EMAIL, password: USER_PASSWORD },
      db
    );
  });

  after(() => {
    resetDbClient();
    for (const key of TOUCHED_ENV) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  });

  beforeEach(() => {
    // Estado base reproducible: secreto presente y sin credenciales de admin.
    process.env.SESSION_SECRET = SESSION_SECRET_TEST;
    delete process.env.APP_BASIC_AUTH_USER;
    delete process.env.APP_BASIC_AUTH_PASSWORD;
    delete process.env.HEALTH_CHECK_SECRET;
  });

  test("0. el esquema de auth se aplica de forma idempotente", async () => {
    assert.equal(await authSchemaExists(db), true);
    await applyAuthSchema(db); // repetir no debe fallar ni cambiar nada
    assert.equal(await authSchemaExists(db), true);
  });

  test("1. API privada SIN sesión → 401 (nunca 200)", async () => {
    const response = await proxy(makeRequest("http://localhost/api/clients"));
    assert.equal(response.status, 401);
    assert.notEqual(response.status, 200);
  });

  test("2. Página privada SIN sesión → redirección a /login con next relativo", async () => {
    const response = await proxy(makeRequest("http://localhost/dashboard"));
    assert.ok(
      response.status === 302 || response.status === 307,
      `se esperaba redirección, se obtuvo ${response.status}`
    );
    const location = response.headers.get("location");
    assert.ok(location && location.includes("/login"), "debe redirigir a /login");
    assert.ok(location && location.includes("next=%2Fdashboard"), "debe conservar el destino");
  });

  test("3. Varias rutas privadas SIN sesión → ninguna responde 200", async () => {
    const paths = [
      "/api/clients",
      "/api/invoices",
      "/api/budgets",
      "/api/settings",
      "/api/export/all",
      "/api/asistente/voice360",
      "/",
      "/clientes",
      "/configuracion",
    ];
    for (const path of paths) {
      const response = await proxy(makeRequest(`http://localhost${path}`));
      assert.notEqual(response.status, 200, `${path} no debe responder 200 sin sesión`);
    }
  });

  test("4. Login con contraseña incorrecta → rechazado con mensaje genérico", async () => {
    const response = await loginRoute(
      makeRequest("http://localhost/api/auth/login", {
        method: "POST",
        body: { email: USER_EMAIL, password: "contraseña-incorrecta" },
      })
    );
    assert.equal(response.status, 401);
    const payload = await response.json();
    assert.equal(payload.error, "Credenciales incorrectas.");
    assert.equal(response.headers.get("set-cookie"), null, "no debe emitir cookie");
  });

  test("5. Login con email inexistente → mismo error (sin enumeración de usuarios)", async () => {
    const response = await loginRoute(
      makeRequest("http://localhost/api/auth/login", {
        method: "POST",
        body: { email: "no.existe@example.invalid", password: "loquesea12345" },
      })
    );
    assert.equal(response.status, 401);
    const payload = await response.json();
    assert.equal(payload.error, "Credenciales incorrectas.");
  });

  test("6. Login correcto → sesión creada y cookie con flags correctos", async () => {
    const { setCookie } = await loginAndGetCookie();

    assert.match(setCookie, /^e360_session=/, "el nombre de la cookie debe ser e360_session");
    assert.match(setCookie, /HttpOnly/i, "debe ser HttpOnly (inmune a robo por XSS)");
    assert.match(setCookie, /SameSite=Lax/i, "SameSite=Lax para el WebView de la APK");
    assert.match(setCookie, /Path=\//, "debe cubrir toda la aplicación");
    assert.match(setCookie, /Max-Age=\d+/i, "Max-Age explícito: sin él, Android la descarta");
    // En producción DEBE ir Secure (se comprueba de forma explícita más abajo).
    assert.doesNotMatch(setCookie, /Secure/i, "en desarrollo por HTTP no puede ir Secure");
  });

  test("7. La cookie lleva Secure cuando corresponde (producción/HTTPS)", () => {
    const secureCookie = serializeSessionCookie("token.firma", 3600, true);
    assert.match(secureCookie, /Secure/i, "con secure=true debe incluir Secure");

    const insecureCookie = serializeSessionCookie("token.firma", 3600, false);
    assert.doesNotMatch(insecureCookie, /Secure/i, "con secure=false no debe incluir Secure");

    // Borrado de sesión: Max-Age=0.
    const cleared = serializeSessionCookie("", 0, true);
    assert.match(cleared, /Max-Age=0/i);
  });

  test("8. API privada CON sesión válida → permitida y recibe el tenant del servidor", async () => {
    const { cookie } = await loginAndGetCookie();
    const response = await proxy(
      makeRequest("http://localhost/api/clients", { headers: { cookie } })
    );

    assert.notEqual(response.status, 401, "con sesión válida no debe rechazar");
    assert.notEqual(response.status, 302, "con sesión válida no debe redirigir");
    assert.notEqual(response.status, 307, "con sesión válida no debe redirigir");

    const override = response.headers.get("x-middleware-override-headers") ?? "";
    assert.ok(
      override.includes("x-auth-tenant-id"),
      "el proxy debe inyectar x-auth-tenant-id para las rutas"
    );
    assert.ok(override.includes("x-auth-user-id"), "el proxy debe inyectar x-auth-user-id");
  });

  test("9. GET /api/auth/session refleja la sesión y su ausencia", async () => {
    const anonymous = await sessionRoute(makeRequest("http://localhost/api/auth/session"));
    assert.equal(anonymous.status, 401);
    assert.equal((await anonymous.json()).authenticated, false);

    const { cookie } = await loginAndGetCookie();
    const authenticated = await sessionRoute(
      makeRequest("http://localhost/api/auth/session", { headers: { cookie } })
    );
    assert.equal(authenticated.status, 200);
    const payload = await authenticated.json();
    assert.equal(payload.authenticated, true);
    assert.equal(payload.user.tenantId, USER_TENANT);
  });

  test("10. Cookie manipulada (firma inválida) → rechazada", async () => {
    const token = generateSessionToken();
    const signed = createSignedSessionValue(token);
    assert.ok(signed);
    const tampered = `${signed}x`;

    const response = await proxy(
      makeRequest("http://localhost/api/clients", {
        headers: { cookie: `e360_session=${tampered}` },
      })
    );
    assert.equal(response.status, 401);
  });

  test("11. Cookie válida pero SIN fila en BD (inventada) → rechazada", async () => {
    const token = generateSessionToken();
    const signed = createSignedSessionValue(token);
    assert.ok(signed);

    const response = await proxy(
      makeRequest("http://localhost/api/clients", {
        headers: { cookie: `e360_session=${signed}` },
      })
    );
    assert.equal(response.status, 401, "una firma válida sin sesión en BD no basta");
  });

  test("12. TENANT INCORRECTO → sesión rechazada", async () => {
    // Se construye a mano una sesión cuyo tenant NO coincide con el del usuario.
    const token = generateSessionToken();
    const signed = createSignedSessionValue(token);
    assert.ok(signed);

    const now = new Date();
    const future = new Date(now.getTime() + 60 * 60 * 1000);
    const userRow = await db.execute({
      sql: "SELECT id FROM app_users WHERE email = ? LIMIT 1",
      args: [USER_EMAIL],
    });
    const userId = String(userRow.rows[0].id);

    await db.execute({
      sql: `INSERT INTO app_sessions (id, user_id, tenant_id, token_hash, created_at, expires_at, last_seen_at, revoked_at, user_agent, ip_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`,
      args: [
        "sesion-tenant-incorrecto",
        userId,
        OTHER_TENANT,
        hashSessionToken(token),
        now.toISOString(),
        future.toISOString(),
        now.toISOString(),
      ],
    });

    const response = await proxy(
      makeRequest("http://localhost/api/clients", {
        headers: { cookie: `e360_session=${signed}` },
      })
    );
    assert.equal(response.status, 401, "un tenant incoherente debe invalidar la sesión");
  });

  test("13. Un cliente NO puede falsificar su tenant por cabecera", async () => {
    const { cookie } = await loginAndGetCookie();

    // Intento de suplantación: el cliente envía su propio x-auth-tenant-id.
    const response = await proxy(
      makeRequest("http://localhost/api/clients", {
        headers: {
          cookie,
          "x-auth-tenant-id": OTHER_TENANT,
          "x-auth-user-id": "usuario-falso",
        },
      })
    );

    assert.notEqual(response.status, 401);

    // La cabecera que llega a la ruta debe ser la del usuario REAL, no la falsa.
    // Next envía las cabeceras inyectadas con el prefijo `x-middleware-request-`.
    const injectedTenant = response.headers.get("x-middleware-request-x-auth-tenant-id");
    const injectedUser = response.headers.get("x-middleware-request-x-auth-user-id");

    assert.equal(injectedTenant, USER_TENANT, "el tenant debe ser el del servidor");
    assert.notEqual(injectedUser, "usuario-falso", "el usuario falsificado debe descartarse");
  });

  test("14. LOGOUT → la sesión deja de ser válida inmediatamente", async () => {
    const { cookie } = await loginAndGetCookie();

    const before = await proxy(
      makeRequest("http://localhost/api/clients", { headers: { cookie } })
    );
    assert.notEqual(before.status, 401, "la sesión debe funcionar antes del logout");

    const logoutResponse = await logoutRoute(
      makeRequest("http://localhost/api/auth/logout", { method: "POST", headers: { cookie } })
    );
    assert.equal(logoutResponse.status, 200);
    assert.match(
      logoutResponse.headers.get("set-cookie") ?? "",
      /Max-Age=0/i,
      "el logout debe borrar la cookie"
    );

    // Se reutiliza la MISMA cookie: debe quedar revocada en base de datos.
    const after = await proxy(
      makeRequest("http://localhost/api/clients", { headers: { cookie } })
    );
    assert.equal(after.status, 401, "tras el logout la sesión no puede seguir valiendo");
  });

  test("15. FAIL-CLOSED: sin SESSION_SECRET las rutas privadas no quedan abiertas", async () => {
    delete process.env.SESSION_SECRET;
    const apiResponse = await proxy(makeRequest("http://localhost/api/clients"));
    assert.equal(apiResponse.status, 503, "sin secreto la API privada debe cerrarse");

    const pageResponse = await proxy(makeRequest("http://localhost/dashboard"));
    assert.equal(pageResponse.status, 503, "sin secreto la página privada debe cerrarse");

    process.env.SESSION_SECRET = SESSION_SECRET_TEST;
  });

  test("16. /login es accesible sin sesión (si no, no habría forma de entrar)", async () => {
    const response = await proxy(makeRequest("http://localhost/login"));
    assert.notEqual(response.status, 401);
    assert.notEqual(response.status, 503);
  });

  test("17. Basic Auth ya NO bloquea globalmente la app", async () => {
    // Con credenciales de admin configuradas...
    process.env.APP_BASIC_AUTH_USER = "admin-ficticio";
    process.env.APP_BASIC_AUTH_PASSWORD = "password-admin-ficticia";

    // ...la página de login sigue accesible y las rutas de usuario NO dependen de Basic Auth.
    const login = await proxy(makeRequest("http://localhost/login"));
    assert.notEqual(login.status, 401, "Basic Auth no debe proteger /login");

    const privateApi = await proxy(makeRequest("http://localhost/api/clients"));
    assert.equal(
      privateApi.status,
      401,
      "sin sesión sigue rechazando: Basic Auth no sustituye a la sesión"
    );
    assert.notEqual(privateApi.headers.get("www-authenticate")?.includes("Basic"), true);

    // Y con sesión válida se entra aunque no se envíe Basic Auth.
    const { cookie } = await loginAndGetCookie();
    const withSession = await proxy(
      makeRequest("http://localhost/api/clients", { headers: { cookie } })
    );
    assert.notEqual(withSession.status, 401, "la sesión debe bastar sin Basic Auth");
  });

  test("18. Rutas ADMIN con Basic Auth acotado", async () => {
    delete process.env.APP_BASIC_AUTH_USER;
    delete process.env.APP_BASIC_AUTH_PASSWORD;

    // FAIL-CLOSED: sin credenciales de admin, la ruta admin queda CERRADA.
    const closed = await proxy(makeRequest("http://localhost/api/health/db"));
    assert.equal(closed.status, 503, "sin configurar, la ruta admin no puede abrirse");

    process.env.APP_BASIC_AUTH_USER = "admin-ficticio";
    process.env.APP_BASIC_AUTH_PASSWORD = "password-admin-ficticia";

    const wrong = await proxy(
      makeRequest("http://localhost/api/health/db", {
        headers: { authorization: `Basic ${Buffer.from("admin-ficticio:mal").toString("base64")}` },
      })
    );
    assert.equal(wrong.status, 401);

    const right = await proxy(
      makeRequest("http://localhost/api/health/db", {
        headers: {
          authorization: `Basic ${Buffer.from("admin-ficticio:password-admin-ficticia").toString("base64")}`,
        },
      })
    );
    assert.notEqual(right.status, 401, "con Basic Auth correcto la ruta admin debe pasar");
    assert.notEqual(right.status, 503);
  });

  test("19. Endpoint admin sin secreto ni configuración → fail-closed (nunca 200)", async () => {
    // Comprueba la guarda PROPIA de la ruta (defensa en profundidad, además del
    // proxy): un fallo de configuración NUNCA puede conceder acceso.
    delete process.env.HEALTH_CHECK_SECRET;
    delete process.env.APP_BASIC_AUTH_USER;
    delete process.env.APP_BASIC_AUTH_PASSWORD;

    const response = await healthDbRoute(makeRequest("http://localhost/api/health/db"));

    assert.notEqual(response.status, 200, "sin configuración el endpoint debe cerrarse");
    assert.equal(response.status, 404, "se usa 404 para no confirmar la existencia del endpoint");
  });

  test("20. Endpoint admin con el secreto correcto → autorizado por su propia guarda", async () => {
    const secret = "secreto-diagnostico-ficticio-para-pruebas";
    process.env.HEALTH_CHECK_SECRET = secret;
    // Se retiran las credenciales de Basic Auth a propósito: esta prueba valida la
    // guarda de la RUTA (su cabecera propia), no la del proxy.
    delete process.env.APP_BASIC_AUTH_USER;
    delete process.env.APP_BASIC_AUTH_PASSWORD;

    // Sin cabecera → sigue cerrado.
    const sinCabecera = await healthDbRoute(makeRequest("http://localhost/api/health/db"));
    assert.equal(sinCabecera.status, 404, "sin la cabecera del secreto no se entra");

    // Con la cabecera correcta → la guarda le deja pasar al cuerpo del handler.
    const conCabecera = await healthDbRoute(
      makeRequest("http://localhost/api/health/db", {
        headers: { "x-health-check-secret": secret },
      })
    );
    assert.notEqual(conCabecera.status, 404, "con el secreto correcto no debe rechazar por auth");
    const cuerpo = (await conCabecera.json()) as Record<string, unknown>;
    assert.ok("estado" in cuerpo, "debe entrar en el handler y devolver su diagnóstico");
  });

  test("21. Las rutas que consume la APK NO están bajo Basic Auth", async () => {
    process.env.APP_BASIC_AUTH_USER = "admin-ficticio";
    process.env.APP_BASIC_AUTH_PASSWORD = "password-admin-ficticia";

    // Rutas invocadas por la interfaz (WebView). Si estuvieran bajo Basic Auth,
    // el WebView recibiría un 401 que no puede responder y quedaría en blanco.
    const appPaths = [
      "/api/settings",
      "/api/assistant",
      "/api/text-assistant",
      "/api/asistente/voice360",
      "/api/asistente/gemini-live/token",
      "/api/export/clients",
    ];

    for (const path of appPaths) {
      const response = await proxy(makeRequest(`http://localhost${path}`));
      const wwwAuth = response.headers.get("www-authenticate") ?? "";
      assert.ok(
        !wwwAuth.includes("Basic"),
        `${path} no debe emitir un reto Basic Auth (rompería la APK)`
      );
    }
  });
});
