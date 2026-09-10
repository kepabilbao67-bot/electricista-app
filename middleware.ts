import { NextRequest, NextResponse } from "next/server";

/**
 * Protege TODA la app (paginas y APIs) con Basic Auth (SEC-004B).
 *
 * Motivo: Vercel Authentication no esta protegiendo de forma fiable todos
 * los dominios del proyecto (electricista-app-two sigue accesible sin login
 * en incognito). Esta proteccion vive dentro del propio codigo, es
 * independiente de la configuracion de la plataforma y protege cualquier
 * dominio que apunte a este deployment.
 *
 * Excepcion deliberada y limitada para previews de la rama SOKOEL:
 * - solo en VERCEL_ENV=preview;
 * - solo permite la pagina /catalogo/sokoel;
 * - solo permite GET/HEAD/OPTIONS de /api/catalog/sokoel;
 * - nunca habilita escrituras publicas ni afecta produccion.
 *
 * En preview, las peticiones no autorizadas devuelven 403 sin
 * WWW-Authenticate para evitar que prefetches o recursos secundarios de
 * Next.js abran el dialogo nativo de Basic Auth encima de la pagina publica
 * SOKOEL. En produccion se mantiene el reto Basic Auth normal.
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const method = request.method;
  const isPreview = process.env.VERCEL_ENV === "preview";

  const isPublicSokoelPreview =
    isPreview &&
    (
      pathname === "/catalogo/sokoel" ||
      (pathname === "/api/catalog/sokoel" && ["GET", "HEAD", "OPTIONS"].includes(method))
    );

  if (isPublicSokoelPreview) {
    return NextResponse.next();
  }

  const expectedUser = process.env.APP_BASIC_AUTH_USER;
  const expectedPassword = process.env.APP_BASIC_AUTH_PASSWORD;

  if (!expectedUser || !expectedPassword) {
    return new NextResponse("Acceso no disponible: falta configuracion.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Basic ")) {
    const encoded = authHeader.slice("Basic ".length);
    try {
      const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
      const decoded = new TextDecoder("utf-8").decode(bytes);
      const separatorIndex = decoded.indexOf(":");
      const providedUser = decoded.slice(0, separatorIndex);
      const providedPassword = decoded.slice(separatorIndex + 1);

      if (providedUser === expectedUser && providedPassword === expectedPassword) {
        if (
          process.env.DEMO_MODE === "true" &&
          pathname.startsWith("/api/") &&
          !["GET", "HEAD", "OPTIONS"].includes(method)
        ) {
          return NextResponse.json(
            { error: "DEMO / SIN VALIDEZ FISCAL: modo de solo lectura" },
            { status: 403, headers: { "Cache-Control": "no-store" } }
          );
        }
        return NextResponse.next();
      }
    } catch {
      // Cabecera mal formada: se trata igual que "no autenticado".
    }
  }

  if (isPreview) {
    return new NextResponse("Preview protegido.", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return new NextResponse("Autenticacion requerida.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="ElectricistApp"',
      "Cache-Control": "no-store",
    },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_vercel|favicon.ico|manifest.json).*)",
  ],
};
