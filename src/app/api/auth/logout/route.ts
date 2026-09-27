/**
 * ELECTRICISTA360 — AUTH FASE 1 · POST /api/auth/logout
 *
 * Cierra la sesión del dispositivo actual.
 *
 * NO basta con borrar la cookie en el cliente: eso dejaría el token válido si
 * alguien lo hubiera copiado. Aquí se marca `revoked_at` en la base de datos,
 * de modo que la comprobación autoritativa del proxy rechace ese token aunque
 * se presente de nuevo.
 *
 * Solo POST: un logout por GET sería vulnerable a CSRF de cierre de sesión.
 */

import { NextRequest, NextResponse } from "next/server";

import {
  hashSessionToken,
  readSessionCookie,
  readTokenFromSignedValue,
  serializeClearedSessionCookie,
  shouldUseSecureCookie,
} from "@/lib/auth/session";
import { revokeSessionByTokenHash } from "@/lib/auth/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secure = shouldUseSecureCookie(request);
  const token = readTokenFromSignedValue(readSessionCookie(request.headers.get("cookie")));

  if (token) {
    try {
      await revokeSessionByTokenHash(hashSessionToken(token));
    } catch {
      // La cookie se borra igualmente. El token quedará inutilizable por
      // caducidad si la base de datos no estaba disponible.
    }
  }

  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
  response.headers.set("Set-Cookie", serializeClearedSessionCookie(secure));
  return response;
}
