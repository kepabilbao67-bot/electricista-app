/**
 * ELECTRICISTA360 — AUTH FASE 1 · Token de sesión y cookie
 *
 * MODELO DE TOKEN:
 *   valor de cookie = `<token>.<firma>`
 *     token  = 32 bytes aleatorios (base64url)
 *     firma  = HMAC-SHA256(SESSION_SECRET, token) en base64url
 *
 * La firma permite al proxy rechazar un token FORJADO sin tocar la base de datos.
 * En la base de datos se guarda únicamente `sha256(token)`: una fuga de la BD no
 * permite reconstruir cookies válidas.
 *
 * FLAGS DE COOKIE:
 *   HttpOnly            → JavaScript no puede leerla (inmune a robo por XSS).
 *   Secure              → solo por HTTPS. Se activa en producción o si la
 *                         petición ya es HTTPS. En desarrollo por HTTP en la LAN
 *                         no se puede activar (el navegador descartaría la
 *                         cookie) — excepción documentada y SOLO de desarrollo.
 *   SameSite=Lax        → permite la navegación de nivel superior que necesita
 *                         el WebView de la APK, y bloquea el envío en peticiones
 *                         cruzadas de terceros.
 *   Path=/              → toda la aplicación.
 *   Max-Age explícito   → IMPRESCINDIBLE en la APK: Capacitor llama a
 *                         `removeSessionCookies(null)` y Android descarta como
 *                         cookie de sesión toda cookie SIN Max-Age/Expires, de
 *                         modo que la sesión moriría al cerrar la app.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { SESSION_COOKIE_NAME, getSessionSecret } from "./config";

/** Genera un token de sesión nuevo (valor en claro, nunca se almacena tal cual). */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** sha256 del token, tal como se persiste en `app_sessions.token_hash`. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function sign(token: string, secret: string): string {
  return createHmac("sha256", secret).update(token).digest("base64url");
}

/**
 * Devuelve el valor de cookie firmado, o `null` si no hay SESSION_SECRET
 * utilizable. `null` significa "no se puede emitir sesión" → fail-closed.
 */
export function createSignedSessionValue(token: string): string | null {
  const secret = getSessionSecret();
  if (!secret) return null;
  return `${token}.${sign(token, secret)}`;
}

/**
 * Verifica la firma y devuelve el token en claro, o `null` si es inválido.
 * No consulta la base de datos: eso lo hace `findValidSession`.
 */
export function readTokenFromSignedValue(signedValue: string | undefined | null): string | null {
  if (!signedValue) return null;
  const secret = getSessionSecret();
  if (!secret) return null;

  const separator = signedValue.lastIndexOf(".");
  if (separator <= 0 || separator === signedValue.length - 1) return null;

  const token = signedValue.slice(0, separator);
  const providedSignature = signedValue.slice(separator + 1);
  if (!token || !providedSignature) return null;

  const expectedSignature = sign(token, secret);
  const a = Buffer.from(providedSignature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  return token;
}

/** Lee la cookie de sesión de una cabecera `Cookie`. */
export function readSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (name !== SESSION_COOKIE_NAME) continue;
    const raw = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

/**
 * Construye la cabecera `Set-Cookie` de sesión.
 * `secure` debe decidirse en el servidor a partir de la petición.
 */
export function serializeSessionCookie(
  value: string,
  maxAgeSeconds: number,
  secure: boolean
): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
  ];
  if (secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

/** Construye la cabecera `Set-Cookie` que borra la sesión. */
export function serializeClearedSessionCookie(secure: boolean): string {
  return serializeSessionCookie("", 0, secure);
}

/**
 * Determina si la cookie debe llevar `Secure`.
 * - Producción ⇒ siempre (obligatorio por la decisión de arquitectura).
 * - Si la petición llega por HTTPS (p. ej. detrás de un proxy que fija
 *   `x-forwarded-proto`) ⇒ también.
 * - En desarrollo por HTTP en la LAN ⇒ no, porque el navegador descartaría la
 *   cookie y no habría forma de iniciar sesión. Esta excepción NUNCA aplica en
 *   producción.
 */
export function shouldUseSecureCookie(request: Request): boolean {
  if (process.env.NODE_ENV === "production") return true;
  try {
    const url = new URL(request.url);
    if (url.protocol === "https:") return true;
  } catch {
    /* URL no parseable: se cae a la comprobación de cabeceras */
  }
  const forwardedProto = request.headers.get("x-forwarded-proto");
  return forwardedProto === "https";
}

/** Hash de la IP, solo para trazabilidad. Nunca es un factor de autenticación. */
export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}
