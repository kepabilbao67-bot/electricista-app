/**
 * ELECTRICISTA360 — ACCESO AUTOMÁTICO DE QA (SOLO DESARROLLO)
 *
 * POR QUÉ EXISTE
 * Probar el ciclo de VOZ completo en el móvil exigía teclear la contraseña de QA en
 * cada recarga (y el túnel de prueba cambia de URL). Eso hace inviable comprobar
 * "abrir → hablar → oír la respuesta → repetir": el probador acaba peleándose con
 * el login en lugar de con la voz, que es lo que hay que validar.
 *
 * QUÉ HACE
 * Cuando NO hay sesión válida y el acceso de QA está habilitado, emite una sesión
 * REAL (token firmado + fila en `app_sessions`, exactamente igual que el login
 * normal) para un usuario QA que YA EXISTE y está activo. No crea usuarios, no
 * cambia contraseñas y no toca el login.
 *
 * GARANTÍAS (obligatorias, comprobadas en `qa-autologin.test.ts`)
 *   1. PRODUCCIÓN NUNCA LO PERMITE. Con `NODE_ENV=production`, o en un despliegue
 *      de producción (`VERCEL_ENV=production`), devuelve `null` SIEMPRE, aunque la
 *      variable de entorno esté puesta. Es una comprobación DURA, no un aviso.
 *   2. Hay que pedirlo EXPLÍCITAMENTE con `E360_QA_AUTOLOGIN=1`. Sin esa variable
 *      el comportamiento es exactamente el de antes: 401 / redirección a /login.
 *   3. Si el usuario QA no existe, está inactivo o bloqueado → `null` y se sigue el
 *      camino normal. Nunca se "abre por si acaso".
 *   4. La autenticación normal queda INTACTA: esto sólo AÑADE una puerta de QA en
 *      desarrollo; no elimina ni debilita la existente.
 */

import { getSessionSecret, getSessionTtlMs } from "./config";
import {
  createSignedSessionValue,
  generateSessionToken,
  hashSessionToken,
  serializeSessionCookie,
  shouldUseSecureCookie,
} from "./session";
import { createSession, findUserByEmail, isAccountLocked } from "./store";

/** Correo del usuario QA que se usa para el acceso automático. */
export const QA_AUTOLOGIN_EMAIL_POR_DEFECTO = "qa.mobile@electricista360.invalid";

/** Correo de QA configurado (por entorno) o el de por defecto. */
export function qaAutologinEmail(): string {
  const configurado = process.env.E360_QA_EMAIL?.trim();
  return configurado && configurado.length > 0 ? configurado : QA_AUTOLOGIN_EMAIL_POR_DEFECTO;
}

/**
 * ¿Está permitido el acceso automático de QA en ESTE proceso?
 *
 * Es la única puerta: si devuelve `false`, no se emite ninguna sesión automática.
 */
export function qaAutologinPermitido(): boolean {
  // 1. PRODUCCIÓN: prohibido SIEMPRE, pase lo que pase en el entorno.
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.VERCEL_ENV === "production") return false;
  // 2. Opt-in explícito: sin esto no cambia nada.
  return process.env.E360_QA_AUTOLOGIN === "1";
}

export interface SesionQa {
  signedValue: string;
  setCookie: string;
  user: { id: string; tenantId: string; role: string; email: string };
}

/**
 * Emite una sesión de QA si —y sólo si— está permitido y el usuario QA es válido.
 * Devuelve `null` en cualquier otro caso (fail-closed).
 */
export async function intentarSesionQa(request: Request): Promise<SesionQa | null> {
  if (!qaAutologinPermitido()) return null;
  // Sin secreto de firma no se puede emitir una sesión válida: mismo fail-closed
  // que el login normal.
  if (!getSessionSecret()) return null;

  try {
    const user = await findUserByEmail(qaAutologinEmail());
    // El usuario debe EXISTIR y estar ACTIVO: así el bypass no puede inventarse una
    // identidad ni resucitar una cuenta desactivada.
    if (!user || !user.isActive || isAccountLocked(user)) return null;

    const token = generateSessionToken();
    const signedValue = createSignedSessionValue(token);
    if (!signedValue) return null;

    await createSession({
      userId: user.id,
      tenantId: user.tenantId,
      tokenHash: hashSessionToken(token),
      userAgent: request.headers.get("user-agent"),
      ipHash: null,
    });

    return {
      signedValue,
      setCookie: serializeSessionCookie(
        signedValue,
        Math.floor(getSessionTtlMs() / 1000),
        shouldUseSecureCookie(request)
      ),
      user: {
        id: user.id,
        tenantId: user.tenantId,
        role: user.role,
        email: user.email,
      },
    };
  } catch {
    // Cualquier problema (BD inaccesible, esquema sin aplicar) NO abre la puerta.
    return null;
  }
}
