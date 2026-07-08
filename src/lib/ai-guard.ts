import { NextRequest, NextResponse } from "next/server";

/**
 * Protege el endpoint del asistente de IA (SEC-003A).
 *
 * El endpoint /api/assistant puede generar llamadas facturables a un
 * proveedor de IA (OpenAI) cuando OPENAI_API_KEY esta configurada. Este
 * guard evita que cualquiera pueda invocarlo sin control y agotar la cuota.
 *
 * - Si AI_SECRET no esta configurada, se responde 404 sin llamar a OpenAI
 *   ni ejecutar ninguna logica del endpoint.
 * - Si esta configurada, la peticion debe incluir la cabecera
 *   "x-ai-secret" con el valor exacto; si falta o no coincide, tambien
 *   se responde 404.
 *
 * Uso en el POST de /api/assistant:
 *   const blocked = checkAiSecret(request);
 *   if (blocked) return blocked;
 */
export function checkAiSecret(request: NextRequest): NextResponse | null {
  const expectedSecret = process.env.AI_SECRET?.trim();

  if (!expectedSecret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const providedSecret = request.headers.get("x-ai-secret");

  if (!providedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return null;
}
