/**
 * ELECTRICISTA360 — AUTH FASE 1 · Guardia de sesión para route handlers
 *
 * DEFENSA EN PROFUNDIDAD.
 *
 * La puerta principal es `src/proxy.ts`, que en Next 16 corre en runtime Node y
 * por tanto SÍ consulta la base de datos en cada petición: la revocación es
 * efectiva en todas las rutas sin excepción.
 *
 * Este módulo añade una segunda comprobación explícita dentro del route handler
 * para las rutas sensibles. Vuelve a validar contra la base de datos y devuelve
 * el usuario y su `tenant_id` DERIVADOS DEL SERVIDOR.
 *
 * REGLA DE SEGURIDAD: el `tenant_id` procede del registro del usuario en la BD.
 * Las cabeceras `x-auth-*` que inyecta el proxy son una optimización para que
 * las rutas no repitan la consulta; el proxy ELIMINA esas cabeceras de toda
 * petición entrante, de modo que un cliente no puede falsificarlas. Aun así,
 * `requireSession()` no confía en ellas: relee la BD.
 */

import { NextResponse } from "next/server";
import {
  AUTH_HEADER_ROLE,
  AUTH_HEADER_SESSION_ID,
  AUTH_HEADER_TENANT_ID,
  AUTH_HEADER_USER_ID,
} from "./config";
import { readSessionCookie, readTokenFromSignedValue, hashSessionToken } from "./session";
import { findValidSessionByToken, type AuthUser, type AuthSession } from "./store";

export type RequireSessionResult =
  | { ok: true; user: AuthUser; session: AuthSession; tenantId: string }
  | { ok: false; response: NextResponse };

function deny(status: number, message: string): RequireSessionResult {
  return {
    ok: false,
    response: NextResponse.json(
      { error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    ),
  };
}

/**
 * Exige una sesión válida. Devuelve `{ ok: false, response }` cuando debe
 * cortarse la petición.
 *
 * FAIL-CLOSED: ante cualquier error de base de datos se responde 503 y NO se
 * permite continuar.
 */
export async function requireSession(request: Request): Promise<RequireSessionResult> {
  const signedValue = readSessionCookie(request.headers.get("cookie"));
  const token = readTokenFromSignedValue(signedValue);
  if (!token) {
    return deny(401, "Autenticación requerida.");
  }

  try {
    const lookup = await findValidSessionByToken(hashSessionToken(token));
    if (!lookup.ok) {
      return deny(401, "Sesión no válida o caducada.");
    }
    return {
      ok: true,
      user: lookup.user,
      session: lookup.session,
      tenantId: lookup.user.tenantId,
    };
  } catch {
    // Base de datos inaccesible o esquema no aplicado: se cierra, no se abre.
    return deny(503, "Servicio de autenticación no disponible temporalmente.");
  }
}

/**
 * Devuelve el `tenant_id` derivado del servidor a partir de las cabeceras que
 * el proxy ya validó contra la base de datos, o `null` si no hay identidad.
 *
 * Uso en rutas donde no se quiere repetir la consulta a BD. Para operaciones
 * sensibles, usar `requireSession()`.
 */
export function getAuthenticatedTenantId(request: Request): string | null {
  const tenantId = request.headers.get(AUTH_HEADER_TENANT_ID);
  if (!tenantId) return null;
  const userId = request.headers.get(AUTH_HEADER_USER_ID);
  if (!userId) return null;
  return tenantId;
}

/** Identidad inyectada por el proxy (ya validada contra BD). */
export function getAuthenticatedIdentity(request: Request): {
  userId: string;
  tenantId: string;
  sessionId: string;
  role: string;
} | null {
  const userId = request.headers.get(AUTH_HEADER_USER_ID);
  const tenantId = request.headers.get(AUTH_HEADER_TENANT_ID);
  const sessionId = request.headers.get(AUTH_HEADER_SESSION_ID);
  const role = request.headers.get(AUTH_HEADER_ROLE);
  if (!userId || !tenantId || !sessionId) return null;
  return { userId, tenantId, sessionId, role: role ?? "owner" };
}
