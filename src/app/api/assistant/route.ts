import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { localAnswer, buildCatalogContext, CatalogItem } from "@/lib/ai-engine";
import { checkAiSecret } from "@/lib/ai-guard";

export const dynamic = "force-dynamic";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Carga el catalogo del usuario de forma defensiva (la columna cost_price puede
 * no existir todavia en instalaciones antiguas).
 */
async function loadCatalog(): Promise<CatalogItem[]> {
  try {
    await initializeDatabase();
    const db = getDbClient();
    // Asegura la columna de precio de compra (idempotente).
    try {
      await db.execute("ALTER TABLE catalog_items ADD COLUMN cost_price REAL DEFAULT 0");
    } catch {
      /* la columna ya existe */
    }
    const result = await db.execute(
      "SELECT id, name, unit_price, COALESCE(cost_price, 0) as cost_price, category FROM catalog_items ORDER BY category, name"
    );
    return result.rows as unknown as CatalogItem[];
  } catch {
    return [];
  }
}

function buildSystemPrompt(catalog: CatalogItem[]): string {
  return `Eres el asistente experto de una app de gestion para un electricista autonomo en Espana (Pais Vasco).

Tu perfil de conocimiento:
- Dominas el REBT (Reglamento Electrotecnico de Baja Tension) y sus instrucciones ITC-BT: secciones de cable, protecciones (magnetotermicos, diferenciales), circuitos minimos (C1-C12), grados de electrificacion (basica 5750W / elevada 9200W), puesta a tierra, caida de tension, banos, piscinas, garajes, locales de publica concurrencia, obras y agricolas.
- Conoces la fiscalidad del autonomo espanol: IRPF, modelo 130, IVA, cuota de autonomo, y la facturacion electronica TicketBAI / Batuz del Pais Vasco.
- Conoces precios de mercado de material electrico y mano de obra, tramites (boletin/CIE, inspecciones OCA, carnet de instalador REI), seguridad (EPIs, primeros auxilios, arco electrico) y tecnologia (domotica KNX, cargadores de vehiculo electrico, fotovoltaica).

Instrucciones de respuesta:
- Responde SIEMPRE en espanol, de forma clara, practica y directa, como un companero de profesion.
- Usa formato Markdown: titulos en negrita, listas y tablas cuando ayuden.
- Da valores concretos (secciones, intensidades, precios en euros) cuando el usuario lo necesite.
- Para PRECIOS de material usa EXCLUSIVAMENTE el catalogo del usuario que aparece abajo (compra en SOKOEL). No inventes precios: si un material no esta en el catalogo, dilo y sugiere anadirlo en la seccion Catalogo. Puedes calcular margenes = (venta - compra) / compra * 100 y beneficio = venta - compra.
- Si algo depende de una inspeccion o del criterio del tecnico competente, indicalo.
- Se conciso: ve al grano.

${buildCatalogContext(catalog)}`;
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
    const blocked = checkAiSecret(request);
    if (blocked) return blocked;

    const body = await request.json().catch(() => ({}));
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    const history: ChatMessage[] = Array.isArray(body?.history) ? body.history : [];

    if (!query) {
      return NextResponse.json({ error: "Falta la pregunta" }, { status: 400 });
    }

    const catalog = await loadCatalog();

    // 1) Intentar con un modelo de IA real si hay clave configurada.
    const systemPrompt = buildSystemPrompt(catalog);
    const llmAnswer = await callLLM(systemPrompt, history, query);
    if (llmAnswer) {
      return NextResponse.json({ answer: llmAnswer, source: "ai" });
    }

    // 2) Respaldo: motor offline con normativa + catalogo.
    const answer = localAnswer(query, catalog);
    return NextResponse.json({ answer, source: "local" });
  } catch {
    return NextResponse.json(
      { error: "Error al procesar la consulta" },
      { status: 500 }
    );
  }
}
