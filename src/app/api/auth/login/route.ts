/**
 * ELECTRICISTA360 — AUTH FASE 1 · POST /api/auth/login
 *
 * Login del usuario final. NO usa Basic Auth.
 *
 * SEGURIDAD:
 * - Contraseñas verificadas con scrypt + comparación en tiempo constante.
 * - Respuesta de error GENÉRICA: no se revela si el email existe.
 * - Verificación "señuelo" cuando el email no existe, para no crear un oráculo
 *   de temporización que permita enumerar usuarios.
 * - Bloqueo temporal por intentos fallidos, además del rate limit por IP.
 * - La cookie se emite con `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age`
 *   explícito y `Secure` cuando corresponde.
 * - FAIL-CLOSED: sin `SESSION_SECRET` no se emite ninguna sesión (503).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSessionSecret, getSessionTtlMs } from "@/lib/auth/config";
import {
  createSignedSessionValue,
  generateSessionToken,
  hashIp,
  hashSessionToken,
  serializeSessionCookie,
  shouldUseSecureCookie,
} from "@/lib/auth/session";
import {
  createSession,
  findUserByEmail,
  isAccountLocked,
  registerFailedLogin,
  registerSuccessfulLogin,
} from "@/lib/auth/store";
import { verifyPassword } from "@/lib/auth/password";
import { hashPassword } from "@/lib/auth/password";
import { ensureAuthSchema } from "@/lib/auth/bootstrap";
import { checkRateLimit, getClientIp } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(1024),
});

/** Mensaje de error único para TODOS los fallos de credenciales. */
const GENERIC_CREDENTIALS_ERROR = "Credenciales incorrectas.";

function jsonError(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Hash señuelo, calculado una sola vez y de forma perezosa.
 * Se verifica contra él cuando el email no existe, de modo que el coste de la
 * petición sea similar exista o no el usuario.
 */
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword("electricista360-dummy-password-never-valid");
  }
  return dummyHashPromise;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. FAIL-CLOSED: sin secreto de firma no hay sesiones posibles.
  if (!getSessionSecret()) {
    return jsonError(503, "Acceso no disponible: falta configuracion.");
  }

  // 2. Rate limit por IP (capa adicional al bloqueo por cuenta).
  const rateLimit = checkRateLimit(getClientIp(request), 10, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Inténtalo más tarde." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfter || 60),
          "Cache-Control": "no-store",
        },
      }
    );
  }

  // 3. Validación de entrada.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Solicitud no válida.");
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Solicitud no válida.");
  }

  const { email, password } = parsed.data;

  try {
    // 3.b — El esquema de autenticación debe existir antes de consultarlo. Es
    // idempotente y cacheado por proceso (ver src/lib/auth/bootstrap.ts), y deja
    // este camino autosuficiente: aunque el proxy no llegara a ejecutarse, el
    // login no puede fallar por "app_users no existe". Sólo crea las tablas de
    // autenticación; no crea ningún usuario.
    await ensureAuthSchema();

    const user = await findUserByEmail(email);

    // Usuario inexistente: se paga el mismo coste de scrypt y se falla igual.
    if (!user) {
      await verifyPassword(password, await getDummyHash());
      return jsonError(401, GENERIC_CREDENTIALS_ERROR);
    }

    if (!user.isActive) {
      await verifyPassword(password, user.passwordHash);
      return jsonError(401, GENERIC_CREDENTIALS_ERROR);
    }

    if (isAccountLocked(user)) {
      return NextResponse.json(
        { error: "Cuenta bloqueada temporalmente por intentos fallidos." },
        { status: 429, headers: { "Cache-Control": "no-store" } }
      );
    }

    const passwordOk = await verifyPassword(password, user.passwordHash);
    if (!passwordOk) {
      await registerFailedLogin(user.id);
      return jsonError(401, GENERIC_CREDENTIALS_ERROR);
    }

    // 4. Éxito: se limpian los fallos y se emite la sesión.
    await registerSuccessfulLogin(user.id);

    const token = generateSessionToken();
    const signedValue = createSignedSessionValue(token);
    if (!signedValue) {
      return jsonError(503, "Acceso no disponible: falta configuracion.");
    }

    await createSession({
      userId: user.id,
      tenantId: user.tenantId,
      tokenHash: hashSessionToken(token),
      userAgent: request.headers.get("user-agent"),
      ipHash: hashIp(getClientIp(request)),
    });

    const secure = shouldUseSecureCookie(request);
    const maxAgeSeconds = Math.floor(getSessionTtlMs() / 1000);

    const response = NextResponse.json(
      {
        ok: true,
        user: { email: user.email, role: user.role, tenantId: user.tenantId },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
    response.headers.set("Set-Cookie", serializeSessionCookie(signedValue, maxAgeSeconds, secure));
    return response;
  } catch {
    // Incluye "esquema de auth no aplicado" y "base de datos inaccesible".
    return jsonError(503, "Servicio de autenticación no disponible temporalmente.");
  }
}
