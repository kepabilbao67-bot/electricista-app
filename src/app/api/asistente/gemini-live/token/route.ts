import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";

export const dynamic = "force-dynamic";

const DEFAULT_MODEL = "gemini-3.8-live";
const ALLOWED_MODELS = new Set([DEFAULT_MODEL]);

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;

  // Gemini Live queda habilitado automáticamente cuando existe una credencial
  // server-side válida. Evitamos depender de un segundo flag de despliegue que
  // podía dejar la UI permanentemente en "desconectado" aun teniendo la clave.
  const apiKey =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim();
  const configuredModel = process.env.GEMINI_LIVE_MODEL?.trim() || DEFAULT_MODEL;
  const model = ALLOWED_MODELS.has(configuredModel) ? configuredModel : DEFAULT_MODEL;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_LIVE_NOT_CONFIGURED" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const now = Date.now();
  const expiresAt = new Date(now + 30 * 60_000).toISOString();
  const newSessionExpireTime = new Date(now + 60_000).toISOString();
  const upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      uses: 1,
      expireTime: expiresAt,
      newSessionExpireTime,
      // CAMPO CORRECTO: `bidiGenerateContentSetup`.
      //
      // Antes aquí ponía `liveConnectConstraints`, que NO existe en el esquema
      // de `AuthToken`. Lo confirma el documento de descubrimiento oficial
      // (generativelanguage v1beta, revision 20260923):
      //
      //   AuthToken: expireTime · name · uses · fieldMask ·
      //              newSessionExpireTime · bidiGenerateContentSetup
      //
      // Con el nombre equivocado Google devolvía:
      //   HTTP 400 INVALID_ARGUMENT
      //   "Invalid JSON payload received. Unknown name \"liveConnectConstraints\"
      //    at 'auth_token': Cannot find field."
      // y, al no poder crear el token, el WebSocket del cliente nunca llegaba a
      // `setupComplete` (se quedaba colgado hasta el timeout).
      //
      // La forma también es la del esquema `BidiGenerateContentSetup`: los campos
      // van en el NIVEL SUPERIOR (no anidados en un `config`).
      //
      // El token es de UN SOLO USO (`uses: 1`) y va restringido a este setup, que
      // es lo que permite al cliente abrir `BidiGenerateContentConstrained` con
      // `?access_token=` SIN exponer nunca la clave maestra.
      bidiGenerateContentSetup: {
        model: `models/${model}`,
        generationConfig: { responseModalities: ["AUDIO"] },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        sessionResumption: {},
      },
    }),
    cache: "no-store",
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "GEMINI_TOKEN_ERROR" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }

  const data = (await upstream.json()) as { name?: string; expireTime?: string };
  if (!data.name) {
    return NextResponse.json(
      { error: "GEMINI_TOKEN_INVALID_RESPONSE" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    { token: data.name, expiresAt: data.expireTime || expiresAt, model },
    { headers: { "Cache-Control": "no-store" } }
  );
}
