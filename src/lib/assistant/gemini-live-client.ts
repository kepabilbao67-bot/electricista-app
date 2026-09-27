const LIVE_ENDPOINT = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";

/**
 * Normaliza a texto JSON el mensaje que llega por el WebSocket.
 *
 * POR QUÉ HACE FALTA (defecto real, comprobado contra la API)
 * Gemini Live responde en FRAME BINARIO y, en un navegador, `binaryType` es
 * "blob" por defecto. El cliente exigía `typeof raw === "string"` y DESCARTABA
 * todo lo demás, así que `setupComplete` nunca se detectaba: la conexión se
 * quedaba colgada hasta agotar el timeout del setup aunque el servidor hubiera
 * contestado correctamente. Verificado en vivo: con el WebSocket del navegador la
 * sesión no arranca; decodificando el frame, `setupComplete` llega a la primera.
 *
 * Se aceptan las tres formas en que puede venir: texto (también lo que usan los
 * tests), ArrayBuffer/vista binaria, y Blob.
 */
async function mensajeATexto(raw: unknown): Promise<string | null> {
  if (typeof raw === "string") return raw;
  if (raw instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(raw));
  if (ArrayBuffer.isView(raw)) {
    const vista = raw as ArrayBufferView;
    return new TextDecoder().decode(new Uint8Array(vista.buffer, vista.byteOffset, vista.byteLength));
  }
  if (raw && typeof (raw as Blob).text === "function") {
    try { return await (raw as Blob).text(); } catch { return null; }
  }
  return null;
}

export type GeminiLiveState = "IDLE" | "TOKENIZING" | "CONNECTING" | "WAITING_SETUP" | "CONNECTED" | "RECONNECTING" | "ERROR";

interface TokenResponse { token: string; expiresAt: string; model: string }

export interface GeminiLiveSession {
  expiresAt: string;
  model: string;
  isActive: boolean;
  lastActivity: number;
}

export interface GeminiLiveMetrics { reconnections: number }

export interface GeminiLiveConfig {
  baseUrl?: string;
  setupTimeoutMs?: number;
  reconnectBaseDelayMs?: number;
  maxReconnectAttempts?: number;
  fetchImpl?: typeof fetch;
  webSocketFactory?: (url: string) => WebSocket;
}

export class GeminiLiveClient {
  private readonly baseUrl: string;
  private readonly setupTimeoutMs: number;
  private readonly reconnectBaseDelayMs: number;
  private readonly maxReconnectAttempts: number;
  private readonly fetchImpl: typeof fetch;
  private readonly webSocketFactory: (url: string) => WebSocket;
  private socket: WebSocket | null = null;
  private token: string | null = null;
  private session: GeminiLiveSession | null = null;
  private state: GeminiLiveState = "IDLE";
  private setupTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private resumptionHandle: string | null = null;
  private connectPromise: Promise<GeminiLiveSession> | null = null;
  private connectResolve: ((session: GeminiLiveSession) => void) | null = null;
  private connectReject: ((error: Error) => void) | null = null;
  private intentionalClose = false;
  private onErrorCallback: ((error: Error) => void) | null = null;

  constructor(config: GeminiLiveConfig = {}) {
    this.baseUrl = config.baseUrl ?? "";
    this.setupTimeoutMs = config.setupTimeoutMs ?? 8_000;
    this.reconnectBaseDelayMs = config.reconnectBaseDelayMs ?? 500;
    this.maxReconnectAttempts = config.maxReconnectAttempts ?? 3;
    this.fetchImpl = config.fetchImpl ?? fetch.bind(globalThis);
    this.webSocketFactory = config.webSocketFactory ?? ((url) => new WebSocket(url));
  }

  getState(): GeminiLiveState { return this.state; }
  getMetrics(): GeminiLiveMetrics { return { reconnections: this.reconnectAttempts }; }
  initialize(): Promise<GeminiLiveSession> { return this.connect(); }

  async connect(): Promise<GeminiLiveSession> {
    if (this.state === "CONNECTED" && this.session) return this.session;
    if (this.connectPromise) return this.connectPromise;
    this.intentionalClose = false;
    this.connectPromise = new Promise<GeminiLiveSession>((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;
    });
    void this.obtainTokenAndOpen().catch((cause) => this.fail(cause));
    return this.connectPromise;
  }

  private async obtainTokenAndOpen(): Promise<void> {
    this.state = "TOKENIZING";
    const response = await this.fetchImpl(`${this.baseUrl}/api/asistente/gemini-live/token`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error(`GEMINI_TOKEN_ERROR_${response.status}`);
    const data = (await response.json()) as Partial<TokenResponse>;
    if (!data.token || !data.expiresAt || !data.model) throw new Error("GEMINI_TOKEN_INVALID");
    this.token = data.token;
    this.session = { expiresAt: data.expiresAt, model: data.model, isActive: false, lastActivity: Date.now() };
    this.openSocket(false);
  }

  private openSocket(reconnecting: boolean): void {
    if (!this.token || !this.session) throw new Error("GEMINI_SESSION_MISSING");
    if (this.socket && (this.socket.readyState === 1 || this.socket.readyState === 0)) return;
    this.state = reconnecting ? "RECONNECTING" : "CONNECTING";
    const socket = this.webSocketFactory(`${LIVE_ENDPOINT}?access_token=${encodeURIComponent(this.token)}`);
    this.socket = socket;

    // Gemini Live responde en FRAME BINARIO. En un navegador `binaryType` es
    // "blob" por defecto, así que `event.data` NO llega como string. Se pide
    // "arraybuffer" para poder decodificarlo (ver `mensajeATexto`). Sin esto, el
    // `setupComplete` se descartaba y la sesión moría en el timeout del setup.
    try {
      socket.binaryType = "arraybuffer";
    } catch {
      /* runtime que no lo permite: se intentará decodificar igualmente */
    }

    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.state = "WAITING_SETUP";
      const setup: Record<string, unknown> = {
        model: `models/${this.session!.model}`,
        generationConfig: { responseModalities: ["AUDIO"] },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        sessionResumption: this.resumptionHandle ? { handle: this.resumptionHandle } : {},
      };
      socket.send(JSON.stringify({ setup }));
      this.armSetupTimeout(socket);
    };
    socket.onmessage = (event) => { void this.handleMessage(socket, event.data); };
    socket.onerror = () => { if (this.socket === socket) this.handleSocketFailure(new Error("GEMINI_CONNECT_ERROR")); };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.clearSetupTimer();
      if (!this.intentionalClose) this.scheduleReconnect(new Error("GEMINI_SESSION_CLOSED"));
    };
  }

  private async handleMessage(socket: WebSocket, raw: unknown): Promise<void> {
    const texto = await mensajeATexto(raw);
    if (this.socket !== socket || texto === null) return;
    let message: Record<string, unknown>;
    try { message = JSON.parse(texto) as Record<string, unknown>; }
    catch { this.handleSocketFailure(new Error("GEMINI_PROTOCOL_ERROR")); return; }

    if (message.setupComplete) {
      this.clearSetupTimer();
      this.state = "CONNECTED";
      this.reconnectAttempts = 0;
      if (this.session) {
        this.session.isActive = true;
        this.session.lastActivity = Date.now();
        this.connectResolve?.(this.session);
      }
      this.clearConnectPromise();
      return;
    }
    const update = message.sessionResumptionUpdate as { newHandle?: string; resumable?: boolean } | undefined;
    if (update?.resumable && update.newHandle) this.resumptionHandle = update.newHandle;
    if (message.goAway) this.handleSocketFailure(new Error("GEMINI_GO_AWAY"));
  }

  private armSetupTimeout(socket: WebSocket): void {
    this.clearSetupTimer();
    this.setupTimer = setTimeout(() => {
      if (this.socket === socket && this.state === "WAITING_SETUP") this.handleSocketFailure(new Error("GEMINI_SETUP_TIMEOUT"));
    }, this.setupTimeoutMs);
  }

  private handleSocketFailure(error: Error): void {
    this.onErrorCallback?.(error);
    if (this.socket) {
      const socket = this.socket;
      this.socket = null;
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      socket.close();
    }
    this.clearSetupTimer();
    this.scheduleReconnect(error);
  }

  private scheduleReconnect(error: Error): void {
    if (this.intentionalClose || this.reconnectTimer) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) { this.fail(error); return; }
    const delay = this.reconnectBaseDelayMs * 2 ** this.reconnectAttempts;
    this.reconnectAttempts += 1;
    this.state = "RECONNECTING";
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      try { this.openSocket(true); } catch (cause) { this.fail(cause); }
    }, delay);
  }

  private fail(cause: unknown): void {
    const error = cause instanceof Error ? cause : new Error("GEMINI_CONNECT_ERROR");
    this.state = "ERROR";
    this.cleanupSocketAndTimers();
    this.connectReject?.(error);
    this.onErrorCallback?.(error);
    this.clearConnectPromise();
  }

  private clearConnectPromise(): void {
    this.connectPromise = null;
    this.connectResolve = null;
    this.connectReject = null;
  }

  private clearSetupTimer(): void {
    if (this.setupTimer) clearTimeout(this.setupTimer);
    this.setupTimer = null;
  }

  private cleanupSocketAndTimers(): void {
    this.clearSetupTimer();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.socket) {
      const socket = this.socket;
      this.socket = null;
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      socket.close();
    }
  }

  close(): void {
    this.intentionalClose = true;
    this.cleanupSocketAndTimers();
    this.token = null;
    this.resumptionHandle = null;
    this.reconnectAttempts = 0;
    if (this.session) this.session.isActive = false;
    this.session = null;
    this.state = "IDLE";
    this.connectReject?.(new Error("GEMINI_SESSION_CLOSED"));
    this.clearConnectPromise();
  }

  async startCapture(): Promise<void> { throw new Error("GEMINI_AUDIO_NOT_ENABLED"); }
  async stopCapture(): Promise<void> { this.close(); }
  async cancelSession(): Promise<void> { this.close(); }
  onTranscript(_callback: (text: string) => void): void { /* P0.1: sin audio. */ }
  onError(callback: (error: Error) => void): void { this.onErrorCallback = callback; }
}

export const defaultGeminiLiveClient = new GeminiLiveClient();
