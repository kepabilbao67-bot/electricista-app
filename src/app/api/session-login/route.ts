import { NextRequest, NextResponse } from "next/server";

const COOKIE = "electricista360_session";
const DURATION = 30 * 24 * 60 * 60;

export async function POST(request: NextRequest) {
  const user = process.env.APP_BASIC_AUTH_USER;
  const password = process.env.APP_BASIC_AUTH_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!user || !password || !secret) {
    return NextResponse.json({ error: "Acceso no configurado" }, { status: 503 });
  }
  let input: { username?: string; password?: string };
  try { input = await request.json(); } catch {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  if (input.username !== user || input.password !== password) {
    return NextResponse.json({ error: "Usuario o contraseña incorrectos" },
      { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const issued = String(Math.floor(Date.now() / 1000));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign(
    "HMAC", key, new TextEncoder().encode(issued + ":" + user)));
  const encoded = btoa(String.fromCharCode(...signature))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(COOKIE, issued + "." + encoded, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: DURATION
  });
  return response;
}
