import { NextRequest, NextResponse } from "next/server";

/**
 * Protege TODA la app (paginas y APIs) con Basic Auth (SEC-004B).
 *
 * Excepcion limitada para previews SOKOEL:
 * - /catalogo/sokoel es publica en preview;
 * - GET/HEAD/OPTIONS de /api/catalog/sokoel son publicos;
 * - /catalogo y / redirigen a /catalogo/sokoel para evitar pantallas muertas;
 * - las demas rutas siguen protegidas;
 * - produccion conserva Basic Auth sin cambios.
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const method = request.method;
  const isPreview = process.env.VERCEL_ENV === "preview";

  if (
    isPreview &&
    ["GET", "HEAD"].includes(method) &&
    (pathname === "/" || pathname === "/catalogo")
  ) {
    const target = request.nextUrl.clone();
    target.pathname = "/catalogo/sokoel";
    return NextResponse.redirect(target);
  }

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
