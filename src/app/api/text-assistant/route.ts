import { NextRequest, NextResponse } from "next/server";
import { containsHighRiskData, protectedTokensPreserved, stripTags } from "@/lib/sensitive-text-filter";

const SYSTEM_PROMPT = `Eres el Asistente de Redacción Profesional de Autónomo360, una aplicación para autónomos en España (electricistas, fontaneros, reformistas, etc.).

Tu única función es mejorar la redacción de los textos que introduce el usuario, adaptándolos al modo solicitado, SIN ALTERAR NUNCA los hechos, datos numéricos ni la intención original.

REGLAS OBLIGATORIAS DE SEGURIDAD (NO NEGOCIABLES):
1. PROHIBIDO inventar acciones, materiales, plazos o garantías que no estén mencionados en el texto original.
2. PROHIBIDO modificar cualquier cifra, precio, porcentaje, fecha, hora, nombre propio, NIF, CIF, IBAN o número de teléfono. Si el texto original dice "450", debe seguir diciendo "450".
3. Si el texto original es incomprensible o carece de sentido, responde exactamente: "ERROR: Texto demasiado breve o confuso para mejorar. Por favor, añade más detalles."
4. No añadas saludos o despedidas a menos que el modo lo requiera explícitamente y el contexto sea un mensaje directo al cliente.

MODOS DE OPERACIÓN:
- MODO "CORREGIR": Solo corrige ortografía, gramática y puntuación. Mantén el estilo coloquial original.
- MODO "PROFESIONAL": Redacta con tono técnico-formal, ideal para partes de trabajo o presupuestos. Usa voz pasiva o impersonal ("Se revisa...", "Se sustituye...").
- MODO "CERCANO": Redacta con tono amable, claro y educado, ideal para WhatsApp o email al cliente.

FORMATO DE SALIDA:
Devuelve ÚNICAMENTE el texto mejorado, sin explicaciones, sin comillas adicionales y sin preámbulos como "Aquí tienes el texto:".`;

const VALID_MODES = ["CORREGIR"] as const;

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Asistente de redacción no configurado." },
      { status: 503 }
    );
  }

  let body: { text?: string; mode?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const { text, mode } = body;

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "El texto es obligatorio." }, { status: 400 });
  }

  const trimmed = text.trim();
  if (trimmed.length < 8) {
    return NextResponse.json(
      { error: "ERROR: Texto demasiado breve o confuso para mejorar. Por favor, añade más detalles." },
      { status: 400 }
    );
  }

  if (trimmed.length > 3000) {
    return NextResponse.json(
      { error: "El texto es demasiado largo. Máximo 3000 caracteres." },
      { status: 400 }
    );
  }

  // Strip HTML tags
  const cleanText = stripTags(trimmed);

  // Check for high-risk sensitive data
  if (containsHighRiskData(cleanText)) {
    return NextResponse.json(
      { error: "Este texto contiene datos sensibles o cifras protegidas. Revísalo manualmente antes de usar el asistente." },
      { status: 400 }
    );
  }

  if (!mode || !VALID_MODES.includes(mode as typeof VALID_MODES[number])) {
    return NextResponse.json({ error: "Modo no válido. Usa: CORREGIR." }, { status: 400 });
  }

  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_TEXT_ASSISTANT_MODEL || "gpt-4o-mini";

  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 1000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `MODO: ${mode}\n\nTEXTO:\n${cleanText}` },
        ],
      }),
    });

    if (!resp.ok) {
      await resp.text(); // consume body without logging content
      console.error("OpenAI text assistant error:", resp.status);

      // User-friendly messages per status — no technical details exposed
      if (resp.status === 401 || resp.status === 403) {
        return NextResponse.json(
          { error: "Asistente de redacción pendiente de activar." },
          { status: 503 }
        );
      }
      if (resp.status === 429) {
        return NextResponse.json(
          { error: "Asistente de redacción temporalmente no disponible." },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: "No se pudo corregir el texto ahora. Inténtalo más tarde." },
        { status: 502 }
      );
    }

    const data = await resp.json();
    const result = data.choices?.[0]?.message?.content?.trim() || "";

    if (!result) {
      return NextResponse.json(
        { error: "No se obtuvo respuesta del asistente." },
        { status: 502 }
      );
    }

    // Verify protected tokens were not altered
    if (!protectedTokensPreserved(cleanText, result)) {
      return NextResponse.json(
        { error: "La corrección fue bloqueada porque modificaba datos protegidos." },
        { status: 422 }
      );
    }

    return NextResponse.json({ corrected: result, mode });
  } catch (err) {
    console.error("Text assistant connection error");
    return NextResponse.json(
      { error: "Error de conexión con el servicio de corrección." },
      { status: 502 }
    );
  }
}
