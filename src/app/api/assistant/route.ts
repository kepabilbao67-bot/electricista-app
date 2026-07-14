import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { localAnswer, type CatalogItem } from "@/lib/ai-engine";
import {
  buildSystemPrompt,
  answerAboutApp,
  isDangerousElectricalQuery,
  DANGEROUS_QUERY_RESPONSE,
  KNOWLEDGE_VERSION,
} from "@/lib/assistant";

export const dynamic = "force-dynamic";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Carga el catálogo del usuario de forma defensiva.
 * No ejecuta ALTER TABLE — las migraciones ya se gestionan en initializeDatabase().
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
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  if (!apiKey) return null;

  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const trimmedHistory = history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-8)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  const messages = [
    { role: "system", content: systemPrompt },
    ...trimmedHistory,
    { role: "user", content: query },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

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
        temperature: 0.3,
        max_tokens: 900,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    const answer = data?.choices?.[0]?.message?.content;
    return typeof answer === "string" && answer.trim().length > 0 ? answer.trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Protección: Basic Auth global (middleware.ts) protege este endpoint.
    // No se requiere x-ai-secret adicional dado el esquema fail-closed de SEC-004B.

    const body = await request.json().catch(() => ({}));
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    const history: ChatMessage[] = Array.isArray(body?.history) ? body.history : [];

    if (!query) {
      return NextResponse.json({ error: "Falta la pregunta" }, { status: 400 });
    }

    // Seguridad eléctrica: interceptar consultas peligrosas antes de cualquier procesamiento.
    if (isDangerousElectricalQuery(query)) {
      return NextResponse.json({
        answer: DANGEROUS_QUERY_RESPONSE,
        source: "safety",
        knowledgeVersion: KNOWLEDGE_VERSION,
      });
    }

    const catalog = await loadCatalog();

    // Intentar responder sobre la app desde el mapa de módulos (rápido, sin LLM).
    const appAnswer = answerAboutApp(query);
    if (appAnswer) {
      return NextResponse.json({
        answer: appAnswer,
        source: "app-knowledge",
        knowledgeVersion: KNOWLEDGE_VERSION,
      });
    }

    // 1) Intentar con un modelo de IA real si hay clave configurada.
    const systemPrompt = buildSystemPrompt(catalog);
    const llmAnswer = await callLLM(systemPrompt, history, query);
    if (llmAnswer) {
      return NextResponse.json({
        answer: llmAnswer,
        source: "ai",
        knowledgeVersion: KNOWLEDGE_VERSION,
      });
    }

    // 2) Respaldo: motor offline con normativa + catálogo.
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
