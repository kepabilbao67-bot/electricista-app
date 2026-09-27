/**
 * Voz 360 — LLAMADA REAL AL MODELO DE LENGUAJE (IA real)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUÉ EXISTE ESTE MÓDULO
 *
 * El motor de Voz 360 (`/api/asistente/voice360`) resolvía las órdenes
 * (presupuestos, consultas a la BD, confirmación) con reglas deterministas, que
 * es lo correcto para acciones verificables y con puerta de confirmación. Pero
 * una PREGUNTA abierta ("¿qué diferencial me hace falta para…?", "explícame
 * cómo…") acababa siempre en el mismo texto fijo: no había IA real.
 *
 * Este módulo es la ÚNICA frontera por la que Voz 360 habla con un modelo
 * OpenAI-compatible (OpenAI o DeepSeek). No duplica el asistente existente: se
 * apoya en el prompt de sistema que ya usa `/api/assistant`
 * (`buildSystemPrompt`) y en sus guardas (`isDangerousElectricalQuery`,
 * `answerAboutApp`, `answerCommercialQuery`).
 * ────────────────────────────────────────────────────────────────────────────
 *
 * REGLAS DE SEGURIDAD (obligatorias)
 *  - La credencial se lee del ENTORNO DEL SERVIDOR y nunca se escribe en el
 *    código, ni se registra, ni se devuelve al cliente, ni viaja en el prompt.
 *  - Sin credencial NO se lanza ninguna llamada: se devuelve `null` y quien
 *    llama responde con el motor local. Fail-soft, nunca un error al usuario.
 *  - Fail-soft también ante timeout, HTTP != 2xx o respuesta vacía: la voz
 *    siempre tiene una respuesta que mostrar.
 *  - El texto del usuario y la respuesta del modelo se tratan como DATOS.
 *
 * Este módulo es SERVER-ONLY (no lleva "use server": no debe ser una Server
 * Action invocable por RPC). Solo debe importarse desde route handlers.
 */

/** Proveedores soportados (los dos hablan el formato OpenAI de chat). */
export type AssistantLLMProvider = "openai" | "deepseek";

export interface AssistantLLMConfig {
  provider: AssistantLLMProvider;
  /** Credencial. NUNCA se registra ni se propaga fuera de este módulo. */
  apiKey: string;
  /** Base sin barra final; la ruta `/chat/completions` se añade al llamar. */
  baseUrl: string;
  model: string;
}

/** Entorno mínimo e inyectable (facilita pruebas sin variables globales). */
export type AssistantLLMEnv = Record<string, string | undefined>;

const OPENAI_DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEEPSEEK_DEFAULT_BASE_URL = "https://api.deepseek.com";
const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";
const DEEPSEEK_DEFAULT_MODEL = "deepseek-flash";

/** Timeout por defecto: en voz, esperar más de 20 s no es aceptable. */
export const DEFAULT_ASSISTANT_LLM_TIMEOUT_MS = 15_000;

function clean(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Resuelve la configuración del modelo.
 *
 * Orden de preferencia: OpenAI primero (es el proveedor que ya documenta
 * `.env.example`) y DeepSeek como alternativa soportada. Si no hay ninguna
 * credencial devuelve `null` y NO se hace ninguna llamada.
 */
export function resolveAssistantLLMConfig(
  env: AssistantLLMEnv = process.env
): AssistantLLMConfig | null {
  const openaiKey = clean(env.OPENAI_API_KEY) ?? clean(env.AI_API_KEY);
  if (openaiKey) {
    return {
      provider: "openai",
      apiKey: openaiKey,
      baseUrl: (clean(env.OPENAI_BASE_URL) ?? OPENAI_DEFAULT_BASE_URL).replace(/\/+$/, ""),
      model: clean(env.OPENAI_MODEL) ?? OPENAI_DEFAULT_MODEL,
    };
  }

  const deepseekKey = clean(env.DEEPSEEK_API_KEY);
  if (deepseekKey) {
    return {
      provider: "deepseek",
      apiKey: deepseekKey,
      baseUrl: (clean(env.DEEPSEEK_BASE_URL) ?? DEEPSEEK_DEFAULT_BASE_URL).replace(/\/+$/, ""),
      model: clean(env.DEEPSEEK_MODEL) ?? DEEPSEEK_DEFAULT_MODEL,
    };
  }

  return null;
}

/** ¿Hay IA real configurada? No revela la credencial ni su valor. */
export function isAssistantAIConfigured(env: AssistantLLMEnv = process.env): boolean {
  return resolveAssistantLLMConfig(env) !== null;
}

export interface AssistantChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantChatRequest {
  /** Prompt de sistema (normalmente `buildSystemPrompt(catalog)`). */
  systemPrompt: string;
  /** Historial corto de la conversación, ya saneado por quien llama. */
  history?: readonly AssistantChatMessage[];
  /** Turno actual del usuario. */
  query: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  /** Cancelación externa cooperativa (además del timeout). */
  signal?: AbortSignal;
  /** Transporte inyectable: en pruebas evita cualquier red real. */
  fetchImpl?: typeof fetch;
  env?: AssistantLLMEnv;
}

/** Máximo de turnos de historial que se envían al modelo. */
export const MAX_ASSISTANT_HISTORY_TURNS = 6;
/** Máximo de caracteres por turno del historial. */
export const MAX_ASSISTANT_MESSAGE_CHARS = 2_000;

interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string | null };
    finish_reason?: string | null;
  }>;
}

/** Presupuesto de salida por defecto. */
export const DEFAULT_ASSISTANT_MAX_TOKENS = 900;

/**
 * Techo de seguridad del reintento. Algunos modelos razonan antes de responder
 * y, con un prompt largo (el del asistente incluye el mapa completo de la app y
 * el catálogo), pueden agotar el presupuesto de salida sin llegar a escribir la
 * respuesta (`finish_reason: "length"` con contenido vacío). En ese caso se
 * reintenta UNA vez con más margen; si tampoco hay texto, se degrada al motor
 * local en lugar de mostrar un hueco.
 */
export const MAX_ASSISTANT_RETRY_TOKENS = 2_400;

/**
 * Pide una respuesta al modelo. Devuelve `null` cuando no hay IA disponible o
 * cuando la llamada falla de cualquier forma: NUNCA lanza y NUNCA devuelve un
 * texto fabricado. Es responsabilidad del llamador aplicar su fallback local.
 */
export async function callAssistantChat(
  request: AssistantChatRequest
): Promise<string | null> {
  const config = resolveAssistantLLMConfig(request.env ?? process.env);
  if (!config) return null;

  const question = clean(request.query);
  if (!question) return null;

  const systemPrompt = clean(request.systemPrompt);
  if (!systemPrompt) return null;

  const history = (request.history ?? [])
    .filter(
      (message) =>
        message &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0
    )
    .slice(-MAX_ASSISTANT_HISTORY_TURNS)
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, MAX_ASSISTANT_MESSAGE_CHARS),
    }));

  const controller = new AbortController();
  const timeoutMs = request.timeoutMs ?? DEFAULT_ASSISTANT_LLM_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const doFetch = request.fetchImpl ?? fetch;

  // Cancelación externa: se propaga al propio controlador para no dejar la
  // petición viva si quien llama ya no espera la respuesta.
  const onExternalAbort = () => controller.abort();
  if (request.signal) {
    if (request.signal.aborted) controller.abort();
    else request.signal.addEventListener("abort", onExternalAbort, { once: true });
  }

  try {
    const presupuestoInicial = request.maxTokens ?? DEFAULT_ASSISTANT_MAX_TOKENS;
    // Un reintento como máximo, y solo cuando el proveedor cortó por longitud.
    const intentos = [presupuestoInicial, Math.min(presupuestoInicial * 2, MAX_ASSISTANT_RETRY_TOKENS)];

    for (let intento = 0; intento < intentos.length; intento += 1) {
      const response = await doFetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          temperature: request.temperature ?? 0.3,
          max_tokens: intentos[intento],
          messages: [
            { role: "system", content: systemPrompt },
            ...history,
            { role: "user", content: question.slice(0, MAX_ASSISTANT_MESSAGE_CHARS) },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        // Se consume el cuerpo para no dejar la conexión abierta, pero NUNCA se
        // registra su contenido (podría contener detalles del proveedor).
        await response.text().catch(() => "");
        return null;
      }

      const data = (await response.json()) as ChatCompletionResponse;
      const choice = data?.choices?.[0];
      const answer = choice?.message?.content;

      if (typeof answer === "string" && answer.trim().length > 0) {
        return answer.trim();
      }

      // Contenido vacío: solo se reintenta si el motivo fue el presupuesto.
      const sinPresupuesto = choice?.finish_reason === "length";
      const esUltimo = intento === intentos.length - 1;
      if (!sinPresupuesto || esUltimo) return null;
    }

    return null;
  } catch {
    // Timeout, red caída, JSON inválido: fail-soft.
    return null;
  } finally {
    clearTimeout(timer);
    request.signal?.removeEventListener("abort", onExternalAbort);
  }
}
