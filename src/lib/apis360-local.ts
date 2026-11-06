/** Shared local-only APIs360 client for Electricista 360 QA; never connects to cloud. */
const GATEWAY = "http://127.0.0.1:3737/v1";
const PROJECT = "electricista360";

export function isLocalAiPermitted(
  nodeEnv: string | undefined,
  flag: string | undefined,
  host: string | null,
): boolean {
  return nodeEnv !== "production" &&
    flag === "1" &&
    typeof host === "string" &&
    /^(127\.0\.0\.1|localhost):[0-9]{2,5}$/.test(host);
}

type Status = { service?: string; localOnly?: boolean; ai?: {
  local?: { available?: boolean; modelInstalled?: boolean }
} };
type Project = { id?: string; mode?: string; allowCloudExplicit?: boolean;
  allowAutomaticCloudFallback?: boolean };
type Reply = { source?: string; recommendation?: { text?: string };
  cost?: { requestUsd?: number } };

export async function isApis360Ready(fetcher: typeof fetch = fetch): Promise<boolean> {
  try {
    const [s, p] = await Promise.all([
      fetcher(GATEWAY + "/status", { cache: "no-store", signal: AbortSignal.timeout(3500) }),
      fetcher(GATEWAY + "/projects/" + PROJECT,
        { cache: "no-store", signal: AbortSignal.timeout(3500) }),
    ]);
    if (!s.ok || !p.ok) return false;
    const status = await s.json() as Status;
    const project = await p.json() as Project;
    return status.service === "apis360" &&
      status.localOnly === true &&
      status.ai?.local?.available === true &&
      status.ai?.local?.modelInstalled === true &&
      project.id === PROJECT &&
      project.mode === "local" &&
      project.allowCloudExplicit === false &&
      project.allowAutomaticCloudFallback === false;
  } catch { return false; }
}

export async function askApis360(
  question: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  if (typeof question !== "string" || !question.trim() || question.length > 1200) {
    throw new Error("AI360_INVALID_QUESTION");
  }
  const prompt = [
    "Responde en español a consultas informativas generales para un electricista.",
    "Solo ayudas con texto general. No tienes acceso a clientes, CRM, catálogo, facturas, presupuestos ni registros reales.",
    "Nunca inventes clientes, pagos, cifras, acciones ejecutadas ni fuentes verificadas.",
    "Para normativa REBT y riesgos eléctricos exige revisar fuentes oficiales y consultar a un profesional acreditado; no des instrucciones para trabajar con tensión ni asesoramiento fiscal definitivo.",
    "No generes ni envíes acciones externas.",
    "Consulta:", question,
  ].join("\n");
  const response = await fetcher(GATEWAY + "/ai/ask", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", "x-kepa-project": PROJECT },
    signal: AbortSignal.timeout(90000),
    body: JSON.stringify({ mode: "local", project: PROJECT, prompt }),
  });
  if (!response.ok) throw new Error("AI360_GATEWAY_UNAVAILABLE");
  const data = await response.json() as Reply;
  const text = data.recommendation?.text;
  if (data.source !== "local" || data.cost?.requestUsd !== 0 ||
      typeof text !== "string" || !text.trim()) {
    throw new Error("AI360_LOCAL_RESPONSE_NOT_VERIFIED");
  }
  return text.trim();
}
