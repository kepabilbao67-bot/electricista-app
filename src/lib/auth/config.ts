/**
 * ELECTRICISTA360 — AUTH FASE 1 · Configuración y constantes
 *
 * Principio: TODA lectura de configuración de autenticación es FAIL-CLOSED.
 * Si falta o es inválida, se devuelve `null` y quien llama DEBE denegar.
 * Ningún valor por defecto abre una puerta.
 */

/** Nombre de la cookie de sesión de usuario final. */
export const SESSION_COOKIE_NAME = "e360_session";

/**
 * Longitud mínima exigida a SESSION_SECRET.
 * 32 caracteres es el mínimo razonable para una clave HMAC-SHA256.
 */
export const SESSION_SECRET_MIN_LENGTH = 32;

/** Duración absoluta de la sesión (por defecto 30 días). */
export const DEFAULT_SESSION_TTL_HOURS = 24 * 30;

/** Caducidad por inactividad (por defecto 12 horas). */
export const DEFAULT_SESSION_IDLE_HOURS = 12;

/** Cabeceras inyectadas por el proxy. El cliente NUNCA puede aportarlas. */
export const AUTH_HEADER_USER_ID = "x-auth-user-id";
export const AUTH_HEADER_TENANT_ID = "x-auth-tenant-id";
export const AUTH_HEADER_SESSION_ID = "x-auth-session-id";
export const AUTH_HEADER_ROLE = "x-auth-role";

/** Cabeceras de identidad que deben eliminarse de toda petición entrante. */
export const AUTH_IDENTITY_HEADERS: string[] = [
  AUTH_HEADER_USER_ID,
  AUTH_HEADER_TENANT_ID,
  AUTH_HEADER_SESSION_ID,
  AUTH_HEADER_ROLE,
];

/**
 * Cabecera que marca una ruta pública (la página de login).
 *
 * La fija el proxy en el servidor y la lee el layout raíz para NO renderizar el
 * chasis de navegación (Sidebar, MobileNav) mientras no hay sesión. Sin esto, un
 * visitante no autenticado vería el menú completo de la aplicación.
 */
export const PUBLIC_ROUTE_HEADER = "x-public-route";

/**
 * Devuelve el secreto de firma de sesión, o `null` si no es utilizable.
 * Un secreto ausente o demasiado corto NO habilita sesiones: cierra la puerta.
 */
export function getSessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < SESSION_SECRET_MIN_LENGTH) {
    return null;
  }
  return secret;
}

function readPositiveNumber(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

/** Duración absoluta de sesión en milisegundos. */
export function getSessionTtlMs(): number {
  const hours = readPositiveNumber(process.env.SESSION_TTL_HOURS, DEFAULT_SESSION_TTL_HOURS);
  return hours * 60 * 60 * 1000;
}

/** Caducidad por inactividad en milisegundos. */
export function getSessionIdleMs(): number {
  const hours = readPositiveNumber(process.env.SESSION_IDLE_HOURS, DEFAULT_SESSION_IDLE_HOURS);
  return hours * 60 * 60 * 1000;
}

/**
 * Credenciales Basic Auth de ADMINISTRACIÓN.
 *
 * Ya NO son la identidad del usuario final: solo protegen rutas de operador.
 * Si faltan, se devuelve `null` y las rutas admin quedan CERRADAS (fail-closed),
 * nunca abiertas.
 */
export function getAdminBasicAuth(): { user: string; password: string } | null {
  const user = process.env.APP_BASIC_AUTH_USER?.trim();
  const password = process.env.APP_BASIC_AUTH_PASSWORD;
  if (!user || !password) return null;
  return { user, password };
}

/**
 * Comparación en tiempo constante para cadenas.
 * Evita filtrar información por diferencias de temporización.
 */
export function safeStringEquals(a: string, b: string): boolean {
  // Se comparan longitudes primero: es información pública (no revela contenido).
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
