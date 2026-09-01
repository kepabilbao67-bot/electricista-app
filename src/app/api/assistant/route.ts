import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { localAnswer, type CatalogItem } from "@/lib/ai-engine";
import { containsStrictPii } from "@/lib/sensitive-text-filter";
import {
  buildSystemPrompt,
  answerAboutApp,
  isDangerousElectricalQuery,
  DANGEROUS_QUERY_RESPONSE,
  KNOWLEDGE_VERSION,
  answerCommercialQuery,
  ASSISTANT_TOOLS,
  executeAssistantTool,
} from "@/lib/assistant";

export const dynamic = "force-dynamic";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface LLMResult {
  answer: string;
  draft?: {
    type: "budget" | "visit" | "client";
    payload: Record<string, unknown>;
  };
}

/**
 * Carga el catálogo del usuario de forma defensiva.
 * No ejecuta ALTER TABLE - las migraciones ya se gestionan en initializeDatabase().
 */
async function loadCatalog(): Promise<CatalogItem[]> {
  try {
    await initializeDatabase();
    const db = getDbClient();
    const result = await db.execute(
      "SELECT id, name, unit_price, COALESCE(cost_price, 0) as cost_price, category FROM catalog_items ORDER BY category, name"
    );
    return result.rows as unknown as CatalogItem[];
  } catch {
    return [];
  }
}

async function callLLM(
  systemPrompt: string,
  history: ChatMessage[],
  query: string
): Promise<LLMResult | null> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  if (!apiKey) return null;

  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const trimmedHistory = history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-8)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  const messages: any[] = [
    { role: "system", content: systemPrompt },
    ...trimmedHistory,
    { role: "user", content: query },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35000);

  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        tools: ASSISTANT_TOOLS,
        temperature: 0.3,
        max_tokens: 1000,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    const choiceMessage = data?.choices?.[0]?.message;

    if (!choiceMessage) return null;

    // Procesar Tool Calls si el modelo decide usarlos
    if (choiceMessage.tool_calls && Array.isArray(choiceMessage.tool_calls) && choiceMessage.tool_calls.length > 0) {
      let draftPayload: LLMResult["draft"] = undefined;

      messages.push(choiceMessage);

      for (const call of choiceMessage.tool_calls) {
        let args = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          args = {};
        }

        const toolRes = await executeAssistantTool(call.function.name, args);

        if (toolRes.draft) {
          draftPayload = toolRes.draft;
        }

        const rawContent = JSON.stringify(
          toolRes.success
            ? toolRes.draft
              ? { draft: toolRes.draft }
              : toolRes.result
            : { error: toolRes.error }
        );

        // Control de tamaño máximo del JSON enviado a OpenAI (máx 4000 caracteres)
        const safeContent =
          rawContent.length > 4000
            ? JSON.stringify({ error: "El resultado de la consulta supera el tamaño máximo permitido." })
            : rawContent;

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: safeContent,
        });
      }

      // Segunda llamada al modelo para resumir el resultado de la herramienta
      const resp2 = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.3,
          max_tokens: 900,
        }),
        signal: controller.signal,
      });

      if (resp2.ok) {
        const data2 = await resp2.json();
        const finalContent = data2?.choices?.[0]?.message?.content?.trim();
        if (finalContent) {
          return { answer: finalContent, draft: draftPayload };
        }
      }

      return {
        answer: draftPayload
          ? `He preparado el borrador solicitado. Puedes revisarlo a continuación:`
          : `Consulta ejecutada correctamente.`,
        draft: draftPayload,
      };
    }

    const textAnswer = choiceMessage.content?.trim();
    return textAnswer ? { answer: textAnswer } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    const history: ChatMessage[] = Array.isArray(body?.history) ? body.history : [];

    if (!query) {
      return NextResponse.json({ error: "Falta la pregunta" }, { status: 400 });
    }

    // Comprobación de PII estricta en query o historial para bloquear llamadas externas sin enviar datos protegidos
    const hasPiiInQuery = containsStrictPii(query);
    const hasPiiInHistory = history.some((h) => h && containsStrictPii(h.content || ""));

    if (hasPiiInQuery || hasPiiInHistory) {
      return NextResponse.json(
        { error: "Por motivos de privacidad, por favor elimina datos personales (NIF, IBAN, teléfono o email) de tu consulta antes de enviarla." },
        { status: 400 }
      );
    }

    // 1. Seguridad eléctrica
    if (isDangerousElectricalQuery(query)) {
      return NextResponse.json({
        answer: DANGEROUS_QUERY_RESPONSE,
        source: "safety",
        knowledgeVersion: KNOWLEDGE_VERSION,
      });
    }

    // 2. Respuestas comerciales directas desde BD CRM (búsqueda rápida)
    const commercialAnswer = await answerCommercialQuery(query);
    if (commercialAnswer) {
      return NextResponse.json({
        answer: commercialAnswer,
        source: "crm-data",
        knowledgeVersion: KNOWLEDGE_VERSION,
      });
    }

    const catalog = await loadCatalog();

    // 3. Respuesta sobre la aplicación
    const appAnswer = answerAboutApp(query);
    if (appAnswer) {
      return NextResponse.json({
        answer: appAnswer,
        source: "app-knowledge",
        knowledgeVersion: KNOWLEDGE_VERSION,
      });
    }

    // 4. Invocación a LLM con Function Calling / Tools
    const systemPrompt = buildSystemPrompt(catalog);
    const llmResult = await callLLM(systemPrompt, history, query);
    if (llmResult) {
      return NextResponse.json({
        answer: llmResult.answer,
        draft: llmResult.draft,
        source: "ai",
        knowledgeVersion: KNOWLEDGE_VERSION,
      });
    }

    // 5. Motor offline de respaldo
    const answer = localAnswer(query, catalog);
    return NextResponse.json({
      answer,
      source: "local",
      knowledgeVersion: KNOWLEDGE_VERSION,
    });
  } catch {
    return NextResponse.json(
      { error: "Error al procesar la consulta" },
      { status: 500 }
    );
  }
}
