import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { localAnswer, type CatalogItem } from "@/lib/ai-engine";
import { containsHighRiskData } from "@/lib/sensitive-text-filter";
import { askApis360, isApis360Ready, isLocalAiPermitted } from "@/lib/apis360-local";
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

function isLocalQa(request: NextRequest, requireOrigin = false): boolean {
  try {
    const host = request.headers.get("host");
    const url = new URL(request.url);
    if (!isLocalAiPermitted(process.env.NODE_ENV,
      process.env.ELECTRICISTA360_ENABLE_LOCAL_AI, host) || url.host !== host) return false;
    if (!requireOrigin) return true;
    const origin = new URL(request.headers.get("origin") || "");
    return origin.host === host && ["http:", "https:"].includes(origin.protocol);
  } catch { return false; }
}

export async function GET(request: NextRequest) {
  const available = isLocalQa(request) && await isApis360Ready();
  return NextResponse.json({
    available, cloud: false, mode: "local", project: "electricista360",
    actionsEnabled: false, accessesCrm: false,
  }, { headers: { "Cache-Control": "no-store" } });
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

    // Modo informativo opcional local. No consulta catálogos ni ejecuta acciones.
    if (body?.mode === "apis360-local") {
      const noCache = { "Cache-Control": "no-store" };
      if (Object.keys(body).some(key => !["query", "mode"].includes(key)) ||
          query.length > 1200 || containsHighRiskData(query)) {
        return NextResponse.json({
          error: "Consulta no válida o contiene datos protegidos; usa una pregunta genérica.",
        }, { status: 400, headers: noCache });
      }
      if (!isLocalQa(request, true)) {
        return NextResponse.json({ error: "IA360 local no habilitada." },
          { status: 403, headers: noCache });
      }
      if (!(await isApis360Ready())) {
        return NextResponse.json({ error: "APIs360 local no disponible." },
          { status: 503, headers: noCache });
      }
      try {
        const answer = await askApis360(query);
        return NextResponse.json({
          answer, source: "apis360-local", costUsd: 0,
          actionsExecuted: false, accessesCrm: false,
          knowledgeVersion: KNOWLEDGE_VERSION,
        }, { headers: noCache });
      } catch {
        return NextResponse.json({ error: "No se confirmó una respuesta local." },
          { status: 503, headers: noCache });
      }
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
