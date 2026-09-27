/**
 * ELECTRICISTA360 — AUTH FASE 1 · GET /api/auth/session
 *
 * Devuelve la identidad de la sesión actual. Lo usa el cliente para saber si
 * sigue autenticado y para mostrar el usuario.
 *
 * Es una ruta PÚBLICA en el proxy (no exige sesión para poder responder), pero
 * NO filtra nada si no hay sesión: devuelve `authenticated: false` con 401.
 */

import { NextRequest, NextResponse } from "next/server";

import { hashSessionToken, readSessionCookie, readTokenFromSignedValue } from "@/lib/auth/session";
import { findValidSessionByToken } from "@/lib/auth/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = readTokenFromSignedValue(readSessionCookie(request.headers.get("cookie")));

  if (!token) {
    return NextResponse.json(
      { authenticated: false },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const lookup = await findValidSessionByToken(hashSessionToken(token));
    if (!lookup.ok) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      {
        authenticated: true,
        user: {
          email: lookup.user.email,
          role: lookup.user.role,
          tenantId: lookup.user.tenantId,
        },
        session: { expiresAt: lookup.session.expiresAt },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    // Fail-closed: si no se puede verificar, no se afirma que haya sesión.
    return NextResponse.json(
      { authenticated: false },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
