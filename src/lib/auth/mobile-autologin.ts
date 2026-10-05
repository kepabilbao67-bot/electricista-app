import { safeStringEquals, getSessionSecret, getSessionTtlMs } from "./config";
import {
  createSignedSessionValue,
  generateSessionToken,
  hashSessionToken,
  serializeSessionCookie,
  shouldUseSecureCookie,
} from "./session";
import { createSession, findFirstActiveUserByRole } from "./store";

const MOBILE_UA_PREFIX = "Electricista360App/";
const MIN_TOKEN_LENGTH = 32;

export function mobileAutologinTokenFromUserAgent(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const markerIndex = userAgent.indexOf(MOBILE_UA_PREFIX);
  if (markerIndex < 0) return null;
  const raw = userAgent.slice(markerIndex + MOBILE_UA_PREFIX.length);
  const token = raw.split(/\s/, 1)[0]?.trim() ?? "";
  return token.length >= MIN_TOKEN_LENGTH ? token : null;
}

export function mobileAutologinPermitido(request: Request): boolean {
  if (process.env.E360_MOBILE_AUTOLOGIN !== "1") return false;

  const expected = process.env.E360_MOBILE_AUTOLOGIN_TOKEN?.trim();
  if (!expected || expected.length < MIN_TOKEN_LENGTH) return false;

  const provided = mobileAutologinTokenFromUserAgent(request.headers.get("user-agent"));
  if (!provided) return false;

  return safeStringEquals(provided, expected);
}

export interface SesionMovil {
  setCookie: string;
  user: { id: string; tenantId: string; role: string; email: string };
  sessionId: string;
}

export async function intentarSesionMovil(request: Request): Promise<SesionMovil | null> {
  if (!mobileAutologinPermitido(request)) return null;
  if (!getSessionSecret()) return null;

  try {
    const user = await findFirstActiveUserByRole("owner");
    if (!user || !user.isActive) return null;

    const token = generateSessionToken();
    const signedValue = createSignedSessionValue(token);
    if (!signedValue) return null;

    const session = await createSession({
      userId: user.id,
      tenantId: user.tenantId,
      tokenHash: hashSessionToken(token),
      userAgent: request.headers.get("user-agent"),
      ipHash: null,
    });

    return {
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
      sessionId: session.id,
    };
  } catch {
    return null;
  }
}
