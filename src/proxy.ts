import { NextRequest, NextResponse } from "next/server";

import {
  AUTH_HEADER_ROLE,
  AUTH_HEADER_SESSION_ID,
  AUTH_HEADER_TENANT_ID,
  AUTH_HEADER_USER_ID,
  AUTH_IDENTITY_HEADERS,
  PUBLIC_ROUTE_HEADER,
  getAdminBasicAuth,
  getSessionSecret,
  safeStringEquals,
} from "@/lib/auth/config";
import {
  hashSessionToken,
  readSessionCookie,
  readTokenFromSignedValue,
  serializeClearedSessionCookie,
  shouldUseSecureCookie,
} from "@/lib/auth/session";
import { findValidSessionByToken } from "@/lib/auth/store";
import { ensureAuthSchema } from "@/lib/auth/bootstrap";

/**
 * ELECTRICISTA360 — PUERTA DE AUTENTICACIÓN (Fase 1)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUÉ ESTE FICHERO SE LLAMA proxy.ts Y NO middleware.ts  (P0 comprobado)
 *
 * Con Next.js 16 la convención `middleware` está deprecada en favor de `proxy`.
 * Lo comprobado en este proyecto con Next 16.2.10 (Turbopack):
 *   - `middleware.ts` con `export function middleware` NO se ejecutaba: se forzó
 *     un `return 503` incondicional y, tras reiniciar el servidor de desarrollo,
 *     `/` y `/api/clients` seguían respondiendo 200 con contenido real. Es decir,
 *     la aplicación estaba COMPLETAMENTE ABIERTA pese a existir la protección.
 *   - Next resuelve el handler así (next/dist/build/templates/middleware.js:77):
 *       const handlerUserland = (isProxy ? mod.proxy : mod.middleware) || mod.default;
 *     de modo que un fichero `proxy` debe exportar `proxy`.
 *   - `middleware.ts` y `proxy.ts` NO pueden coexistir: Next aborta con el error
 *     E900 ("Both middleware file ... and proxy file ... are detected").
 *
 * RUNTIME (comprobado en el código de Next 16.2.10, no supuesto):
 *   next/dist/build/index.js:1513 →
 *       if (staticInfo.runtime === 'nodejs' || isProxyFile(page)) {
 *         hasNodeMiddleware = true;
 *         functionsConfigManifest.functions['/_middleware'] = { runtime: 'nodejs', ... }
 *   Un fichero `proxy` se ejecuta por tanto en runtime NODE (no Edge). Eso es lo
 *   que permite que esta puerta consulte la base de datos en cada petición y que
 *   la REVOCACIÓN de sesiones sea efectiva en todas las rutas.
 *   (El Edge de Next no podría leer un SQLite `file:` local.)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * MODELO DE AUTENTICACIÓN (Fase 1)
 *
 *   Usuario final  → login propio + cookie de sesión firmada y `HttpOnly`.
 *   Administración → Basic Auth, ACOTADO a rutas de operador (ver ADMIN_PATHS).
 *
 * Basic Auth YA NO es la identidad del usuario final. Se conserva únicamente
 * para rutas administrativas justificadas, y NUNCA debe alcanzar rutas que use
 * el WebView de la APK: Capacitor no sobrescribe `onReceivedHttpAuthRequest`, de
 * modo que un reto 401 Basic se cancela en silencio y la app queda en blanco.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * FAIL-CLOSED (obligatorio)
 *   - Sin `SESSION_SECRET` utilizable → 503 en toda ruta privada.
 *   - Sesión firma-válida pero ausente/revocada/caducada/usuario inactivo → 401.
 *   - Base de datos inaccesible o esquema de auth sin aplicar → 503.
 *   - Rutas admin sin credenciales configuradas → CERRADAS (503), nunca abiertas.
 *   - Las credenciales NUNCA se registran ni se devuelven en la respuesta.
 * ────────────────────────────────────────────────────────────────────────────
 */

/** Rutas accesibles SIN sesión (incluye la propia página de login). */
const PUBLIC_EXACT_PATHS = new Set<string>([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/session",
  "/favicon.ico",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/logo-generic.svg",
  "/logo-sh-electricas.png",
]);

/** Prefijos de recursos estáticos que nunca pasan por la puerta. */
const PUBLIC_PREFIXES: string[] = ["/_next/static", "/_next/image", "/_vercel"];

/**
 * Rutas SOLO ADMIN, protegidas con Basic Auth.
 *
 * Se han elegido verificando empíricamente que NINGUNA es invocada por la UI:
 *   - /api/health/db   → diagnóstico de base de datos (SEC-001)
 *   - /api/prospector  → endpoint interno de prospección
 *
 * Deliberadamente NO están aquí `/api/settings`, `/api/assistant`,
 * `/api/text-assistant`, `/api/asistente/*` ni `/api/export/*`: la interfaz SÍ
 * las llama (configuracion/page.tsx, normativa/page.tsx, TextAssistantButton.tsx,
 * asistente/page.tsx, gemini-live-client.ts, exportar/page.tsx). Someterlas a
 * Basic Auth provocaría un 401 que la APK no puede responder. Esas rutas van por
 * SESIÓN, y las de exportación conservan además su `EXPORT_SECRET`.
 */
const ADMIN_PATHS = new Set<string>(["/api/health/db", "/api/prospector"]);

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

function noStoreHeaders(extra?: Record<string, string>): Record<string, string> {
  return { "Cache-Control": "no-store", ...extra };
}

/** Respuesta de servicio no disponible (configuración ausente o BD inaccesible). */
function unavailableResponse(isApi: boolean): NextResponse {
  if (isApi) {
    return NextResponse.json(
      { error: "Acceso no disponible: falta configuracion." },
      { status: 503, headers: noStoreHeaders() }
    );
  }
  return new NextResponse("Acceso no disponible: falta configuracion.", {
    status: 503,
    headers: noStoreHeaders(),
  });
}

/**
 * Rechaza una petición no autenticada.
 * - APIs → 401 JSON (nunca HTML).
 * - Páginas → 302 a /login con `next` RELATIVO (solo el pathname, para impedir
 *   redirecciones abiertas).
 * Siempre borra la cookie de sesión, que a esas alturas es inservible.
 */
function rejectUnauthenticated(
  request: NextRequest,
  isApi: boolean,
  pathname: string,
  clearedCookie: string
): NextResponse {
  if (isApi) {
    return NextResponse.json(
      { error: "Autenticacion requerida." },
      { status: 401, headers: noStoreHeaders({ "Set-Cookie": clearedCookie }) }
    );
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  const response = NextResponse.redirect(loginUrl);
  response.headers.set("Set-Cookie", clearedCookie);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/** Bloqueo de escritura en modo demostración. */
function demoReadOnlyResponse(isApi: boolean): NextResponse | null {
  if (process.env.DEMO_MODE !== "true") return null;
  if (!isApi) return null;
  return NextResponse.json(
    { error: "DEMO / SIN VALIDEZ FISCAL: modo de solo lectura" },
    { status: 403, headers: noStoreHeaders() }
  );
}

/**
 * Puerta para rutas administrativas (Basic Auth).
 * FAIL-CLOSED: si no hay credenciales configuradas, la ruta queda cerrada.
 */
function handleAdminPath(
  request: NextRequest,
  requestHeaders: Headers,
  pathname: string
): NextResponse {
  const isApi = isApiPath(pathname);
  const expected = getAdminBasicAuth();

  if (!expected) {
    // Sin credenciales de administración NO se abre: se cierra.
    return unavailableResponse(isApi);
  }

  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Basic ")) {
    try {
      const encoded = authHeader.slice("Basic ".length);
      const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
      const decoded = new TextDecoder("utf-8").decode(bytes);
      const separatorIndex = decoded.indexOf(":");
      if (separatorIndex !== -1) {
        const providedUser = decoded.slice(0, separatorIndex);
        const providedPassword = decoded.slice(separatorIndex + 1);

        if (
          safeStringEquals(providedUser, expected.user) &&
          safeStringEquals(providedPassword, expected.password)
        ) {
          const demoBlocked = demoReadOnlyResponse(isApi);
          if (demoBlocked) return demoBlocked;
          return NextResponse.next({ request: { headers: requestHeaders } });
        }
      }
    } catch {
      // Cabecera mal formada: se trata igual que "no autenticado".
    }
  }

  return new NextResponse("Autenticacion de administracion requerida.", {
    status: 401,
    headers: noStoreHeaders({
      "WWW-Authenticate": 'Basic realm="ElectricistApp Admin"',
    }),
  });
}

/**
 * Puerta para rutas privadas de usuario final (sesión por cookie).
 *
 * Consulta la base de datos en cada petición: esto es lo que hace que un logout
 * o una revocación surtan efecto de inmediato, también en otros dispositivos.
 */
async function handleSessionPath(
  request: NextRequest,
  requestHeaders: Headers,
  pathname: string
): Promise<NextResponse> {
  const isApi = isApiPath(pathname);

  // 1. Sin secreto de firma no se puede validar ninguna sesión → fail-closed.
  if (!getSessionSecret()) {
    return unavailableResponse(isApi);
  }

  const secure = shouldUseSecureCookie(request);
  const clearedCookie = serializeClearedSessionCookie(secure);

  // 2. Comprobación barata: firma HMAC. Rechaza tokens forjados sin tocar la BD.
  const signedValue = readSessionCookie(request.headers.get("cookie"));
  const token = readTokenFromSignedValue(signedValue);
  if (!token) {
    return rejectUnauthenticated(request, isApi, pathname, clearedCookie);
  }

  // 3. Comprobación AUTORITATIVA contra la base de datos.
  let lookup: Awaited<ReturnType<typeof findValidSessionByToken>>;
  try {
    lookup = await findValidSessionByToken(hashSessionToken(token));
  } catch {
    // BD inaccesible o esquema de auth sin aplicar → se cierra, no se abre.
    return unavailableResponse(isApi);
  }

  if (!lookup.ok) {
    return rejectUnauthenticated(request, isApi, pathname, clearedCookie);
  }

  // 4. Modo demostración: solo lectura sobre las APIs.
  const demoBlocked = demoReadOnlyResponse(isApi);
  if (demoBlocked) return demoBlocked;

  // 5. Identidad derivada del SERVIDOR, inyectada para los route handlers.
  //    El tenant procede del registro del usuario, nunca del cliente.
  requestHeaders.set(AUTH_HEADER_USER_ID, lookup.user.id);
  requestHeaders.set(AUTH_HEADER_TENANT_ID, lookup.user.tenantId);
  requestHeaders.set(AUTH_HEADER_SESSION_ID, lookup.session.id);
  requestHeaders.set(AUTH_HEADER_ROLE, lookup.user.role);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

/**
 * Puerta única de la aplicación. Se ejecuta ANTES de cualquier page.tsx o
 * route.ts, de modo que ninguna ruta privada puede alcanzarse sin pasar por aquí.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // PASO 0 (seguridad): eliminar SIEMPRE las cabeceras de identidad que pudiera
  // haber enviado el cliente. Sin esto, un cliente podría falsificar su tenant.
  const requestHeaders = new Headers(request.headers);
  for (const header of AUTH_IDENTITY_HEADERS) {
    requestHeaders.delete(header);
  }

  // PASO 0.5 — ARRANQUE DEL ESQUEMA DE AUTENTICACIÓN.
  //
  // El proxy es el ÚNICO punto por el que pasa toda la aplicación (páginas y
  // APIs), así que es el sitio correcto para asegurar que `app_users` y
  // `app_sessions` existen ANTES de que el paso 3 las consulte. Se ejecuta una
  // sola vez por proceso (promesa cacheada) y, si el esquema ya está, ni siquiera
  // lanza DDL: ver `src/lib/auth/bootstrap.ts`.
  //
  // FAIL-CLOSED: si el esquema no se puede asegurar (base de datos inaccesible),
  // las rutas privadas se cierran con 503 — igual que antes, pero sin confundir
  // "no hay tablas" con "no hay sesión". Las rutas PÚBLICAS siguen adelante para
  // que /login se pueda pintar y dar un error legible en vez de una página en
  // blanco.
  try {
    await ensureAuthSchema();
  } catch {
    if (!isPublicPath(pathname)) {
      return unavailableResponse(isApiPath(pathname));
    }
  }

  // 1. Rutas públicas (login y recursos estáticos).
  if (isPublicPath(pathname)) {
    requestHeaders.set(PUBLIC_ROUTE_HEADER, "1");
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // 2. Rutas administrativas → Basic Auth (acotado, no global).
  if (ADMIN_PATHS.has(pathname)) {
    return handleAdminPath(request, requestHeaders, pathname);
  }

  // 3. Todo lo demás → sesión de usuario final.
  return handleSessionPath(request, requestHeaders, pathname);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_vercel|favicon.ico|manifest.json).*)",
  ],
};
