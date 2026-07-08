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
 * - Si APP_BASIC_AUTH_USER o APP_BASIC_AUTH_PASSWORD no estan configuradas,
 *   se bloquea el acceso (fail-closed): no se puede entrar a nada hasta que
 *   se configuren ambas variables en Vercel.
 * - Si estan configuradas, se exige Basic Auth valido (usuario y contrasena)
 *   en cada peticion a paginas y a APIs.
 * - No se modifica ningun endpoint ni pagina existente: esta capa se ejecuta
 *   antes de que la peticion llegue a cualquier route.ts o page.tsx.
 */
export function middleware(request: NextRequest) {
  const expectedUser = process.env.APP_BASIC_AUTH_USER;
  const expectedPassword = process.env.APP_BASIC_AUTH_PASSWORD;

  if (!expectedUser || !expectedPassword) {
    return new NextResponse("Acceso no disponible: falta configuracion.", {
      status: 503,
    });
  }

  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Basic ")) {
    const encoded = authHeader.slice("Basic ".length);
    try {
      const decoded = atob(encoded);
      const separatorIndex = decoded.indexOf(":");
      const providedUser = decoded.slice(0, separatorIndex);
      const providedPassword = decoded.slice(separatorIndex + 1);

      if (providedUser === expectedUser && providedPassword === expectedPassword) {
        return NextResponse.next();
      }
    } catch {
      // Cabecera mal formada: se trata igual que "no autenticado".
    }
  }

  return new NextResponse("Autenticacion requerida.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="ElectricistApp"' },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_vercel|favicon.ico|manifest.json).*)",
  ],
};
