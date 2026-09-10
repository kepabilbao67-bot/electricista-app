import { NextRequest, NextResponse } from "next/server";

/**
 * Protege TODA la app con Basic Auth en produccion.
 *
 * Preview SOKOEL: se sirve una vista publica, estatica y de solo lectura
 * para evitar bucles de autenticacion/prefetch del layout principal.
 * Ninguna API de escritura queda publica y produccion no cambia.
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const method = request.method;
  const isPreview = process.env.VERCEL_ENV === "preview";

  if (isPreview) {
    const isStandaloneSokoel = pathname === "/sokoel-preview.html";

    if (isStandaloneSokoel && ["GET", "HEAD"].includes(method)) {
      return NextResponse.next();
    }

    // Cualquier pagina navegable del preview termina en la vista SOKOEL
    // estatica. Asi, atras/adelante o enlaces del historial no muestran
    // Basic Auth ni "Preview protegido".
    if (!pathname.startsWith("/api/") && ["GET", "HEAD"].includes(method)) {
      const target = request.nextUrl.clone();
      target.pathname = "/sokoel-preview.html";
      target.search = "";
      return NextResponse.redirect(target);
    }

    // Ninguna API del preview queda expuesta por esta excepcion.
    return new NextResponse("Preview API protegida.", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
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
      // Cabecera mal formada: se trata igual que no autenticado.
    }
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
