import { NextRequest, NextResponse } from "next/server";

/**
 * Protege los endpoints de exportacion (SEC-002).
 *
 * - Si EXPORT_SECRET no esta configurada, el endpoint se considera
 *   deshabilitado y se responde 404 sin ejecutar ninguna consulta.
 * - Si esta configurada, la peticion debe incluir la cabecera
 *   "x-export-secret" con el valor exacto; si falta o no coincide,
 *   tambien se responde 404 (no se distingue el motivo en la respuesta).
 *
 * Uso en cada route.ts de exportacion:
 *   const blocked = checkExportSecret(request);
 *   if (blocked) return blocked;
 */
export function checkExportSecret(request: NextRequest): NextResponse | null {
  const expectedSecret = process.env.EXPORT_SECRET?.trim();

  if (!expectedSecret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const providedSecret = request.headers.get("x-export-secret");

  if (!providedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return null;
}
