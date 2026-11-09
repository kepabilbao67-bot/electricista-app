import { NextRequest, NextResponse } from "next/server";
import { getAuthRevision } from "@/lib/electricista-auth";

const COOKIE_NAME = "electricista360_session";
const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60;

async function sessionValid(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const user = process.env.APP_BASIC_AUTH_USER;
  const password = process.env.APP_BASIC_AUTH_PASSWORD;
  const sessionSecret = process.env.SESSION_SECRET;
  if (!token || !user || !password || !sessionSecret) return false;
  const [issued, signature, extra] = token.split(".");
  if (!issued || !signature || extra) return false;
  const issuedAt = Number(issued);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(issuedAt) || issuedAt > now + 60 || now - issuedAt > SESSION_DURATION_SECONDS) return false;
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(sessionSecret),
      { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const bytes = Uint8Array.from(atob(signature.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
    const revision = await getAuthRevision(user);
    return await crypto.subtle.verify("HMAC", key, bytes,
      new TextEncoder().encode(issued + ":" + user + (revision ? ":" + revision : "")));
  } catch { return false; }
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/acceso" || path === "/api/session-login" ||
      path === "/restablecer" || path === "/api/password-recovery") return NextResponse.next();

  let authenticated = await sessionValid(request);
  if (!authenticated) {
    const user = process.env.APP_BASIC_AUTH_USER;
    const password = process.env.APP_BASIC_AUTH_PASSWORD;
    const auth = request.headers.get("authorization");
    let legacyBasicAllowed = false;
    try { legacyBasicAllowed = Boolean(user) && (await getAuthRevision(user!)) === ""; }
    catch { return NextResponse.json({ error: "Acceso temporalmente no disponible" }, { status: 503 }); }
    if (legacyBasicAllowed && user && password && auth?.startsWith("Basic ")) {
      try { authenticated = atob(auth.slice(6)) === user + ":" + password; } catch { authenticated = false; }
    }
  }

  if (authenticated) {
    if (process.env.DEMO_MODE === "true" && path.startsWith("/api/") &&
        !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      return NextResponse.json({ error: "DEMO / SIN VALIDEZ FISCAL: modo de solo lectura" },
        { status: 403, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.next();
  }

  if (path.startsWith("/api/")) {
    return NextResponse.json({ error: "Acceso requerido", login: "/acceso" },
      { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const login = request.nextUrl.clone();
  login.pathname = "/acceso";
  login.search = "";
  login.searchParams.set("next", path);
  return NextResponse.redirect(login, 307);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_vercel|favicon.ico|manifest.json|sw.js|icon-192.png|icon-512.png|logo-generic.svg).*)",
  ],
};
