import type {
  Voice360ProcessResult,
  Voice360ClientConfig,
  ProcessElectricistaVoiceOptions
} from "./types";
import { electricistaDomainAdapter } from "./electricista-adapter";

export class Voice360Client {
  private baseUrl: string;
  private enabled: boolean;
  private timeoutMs: number;
  private authToken?: string;

  constructor(config?: Voice360ClientConfig) {
    this.baseUrl = (config?.baseUrl || process.env.VOICE360_BASE_URL || "http://localhost:3088").replace(/\/+$/, "");
    this.enabled = config?.enabled !== undefined ? config.enabled : (process.env.VOICE360_ENABLED !== "false");
    this.timeoutMs = config?.timeoutMs || Number(process.env.VOICE360_TIMEOUT_MS) || 5000;
    this.authToken = config?.authToken || process.env.VOICE360_AUTH_TOKEN;
  }

  async process(payload: {
    tenantId: string;
    input: string;
    requestId?: string;
    channel?: string;
    context?: Record<string, unknown>;
  }): Promise<Voice360ProcessResult> {
    if (!this.enabled) {
      return {
        success: false,
        action: "error",
        summary: "Servicio de voz deshabilitado por configuración.",
        error: "VOICE360_DISABLED"
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-tenant-id": payload.tenantId,
      };
      if (this.authToken) {
        headers["Authorization"] = `Bearer ${this.authToken}`;
      }

      const res = await fetch(`${this.baseUrl}/api/asistente/voice360`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        let errData: any = {};
        try {
          errData = await res.json();
        } catch {
          errData = { error: "HTTP_" + res.status };
        }
        return {
          success: false,
          action: "error",
          summary: errData.summary || errData.error || `Error del motor Voice360 (${res.status})`,
          error: errData.error || `HTTP_${res.status}`,
        };
      }

      const data = await res.json();
      return data as Voice360ProcessResult;
    } catch (err: any) {
      clearTimeout(timer);
      const isTimeout = err?.name === "AbortError";
      return {
        success: false,
        action: "error",
        summary: isTimeout
          ? "Tiempo de espera agotado al conectar con el motor Voice360."
          : "No se pudo conectar con el motor Voice360 canónico.",
        error: isTimeout ? "VOICE360_TIMEOUT" : "VOICE360_CONNECTION_ERROR",
      };
    }
  }
}

export const defaultVoice360Client = new Voice360Client();

/**
 * Pipeline integral de Electricista360 hacia Voice360 Canónico:
 * 1. Normalización de vocabulario eléctrico (adapter.normalizeInput)
 * 2. Enriquecimiento de contexto vertical SOKOEL (adapter.enrichContext)
 * 3. Ejecución contra Voice360 canónico vía HTTP client
 * 4. Post-procesamiento vertical de resultado (adapter.postProcessResult)
 */
export async function processElectricistaVoice(
  rawInput: string,
  options: ProcessElectricistaVoiceOptions = {}
): Promise<Voice360ProcessResult> {
  const tenantId = options.tenantId || "tenant-default-electricista";
  const client = options.config ? new Voice360Client(options.config) : defaultVoice360Client;

  // 1. Normalizar vocabulario
  let normalizedInput = rawInput;
  if (electricistaDomainAdapter.normalizeInput) {
    normalizedInput = await Promise.resolve(electricistaDomainAdapter.normalizeInput(rawInput));
  }

  // 2. Enriquecer contexto
  let verticalContext: Record<string, unknown> = {};
  if (electricistaDomainAdapter.enrichContext) {
    verticalContext = await Promise.resolve(electricistaDomainAdapter.enrichContext(tenantId, normalizedInput));
  }

  const combinedContext = {
    ...verticalContext,
    ...(options.context || {}),
  };

  // 3. Invocar core canónico
  const coreResult = await client.process({
    tenantId,
    input: normalizedInput,
    requestId: options.requestId,
    channel: options.channel || "web",
    context: combinedContext,
  });

  // 4. Post-procesar con adapter
  if (electricistaDomainAdapter.postProcessResult) {
    return await Promise.resolve(electricistaDomainAdapter.postProcessResult(coreResult, combinedContext));
  }

  return coreResult;
}
