/**
 * VOZ 360 — SESIÓN GEMINI LIVE CON PCM REAL (integración para /asistente)
 *
 * Hace, en orden:
 *   1. pide el token efímero al backend (nunca usa la clave maestra aquí);
 *   2. abre el WebSocket restringido con `?access_token=`;
 *   3. manda el `setup` como PRIMER mensaje y espera `setupComplete`;
 *   4. captura el micrófono, detecta la frecuencia REAL del hardware, remuestrea
 *      a 16 kHz, convierte a Int16 little-endian y lo envía en base64 por chunks;
 *   5. reproduce la respuesta de 24 kHz por el altavoz, en orden y sin solapes;
 *   6. al recibir `turnComplete` NO da el turno por terminado hasta que suena el
 *      último chunk encolado.
 *
 * DECISIÓN TÉCNICA: se captura con `ScriptProcessorNode`, no con `AudioWorklet`.
 * El worklet del proyecto (`public/audio-worklet-processor.js`) concatena los
 * bloques con un stride fijo de 1024 mientras el render quantum entrega 128
 * muestras, así que DESALINEA el audio; además agrupa ~256 ms, fuera del
 * objetivo de 20-100 ms. Prefiero no reescribirlo (no toca refactor masivo) y
 * hacer la conversión con las funciones puras ya probadas de `pcm-audio.ts`.
 * `ScriptProcessorNode` está disponible en el WebView de Android de forma
 * fiable, cosa que no se puede dar por hecha con `AudioWorklet`.
 *
 * HALLAZGO CLAVE (medido contra la API real): sin una COLA DE SILENCIO después
 * de la locución, Gemini NO cierra el turno y no responde absolutamente nada.
 * `audioStreamEnd` inmediato tras la última palabra no lo sustituye.
 */

import {
  BYTES_POR_CHUNK,
  COLA_SILENCIO_MS,
  ColaEnvioPcm,
  ColaReproduccionPcm,
  EstadosPcm,
  MIME_ENTRADA,
  base64ABytes,
  bytesABase64,
  float32AInt16LE,
  int16LEAFloat32,
  remuestrearA16k,
  type EstadoPcm,
  type MetricasPcm,
  type ProgramadorReproduccion,
  metricasVacias,
} from "./pcm-audio";

const WS_LIVE =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";

/** Umbral de voz (RMS sobre Float32 [-1,1]) para saber si el usuario habla. */
const UMBRAL_VOZ = 0.012;

/**
 * WATCHDOG DE TURNO: tiempo máximo que puede estar la sesión en PROCESSING o
 * SPEAKING sin que llegue el fin del turno.
 *
 * POR QUÉ EXISTE (hueco real de la escucha continua)
 * La vuelta a LISTENING dependía de que llegara `turnComplete` (o `interrupted`).
 * Si el servidor no manda ninguno de los dos —un corte de red a mitad de
 * respuesta, un `goAway`, un turno que se pierde—, la sesión se quedaba en
 * SPEAKING PARA SIEMPRE: el micrófono seguía abierto pero el ciclo no volvía a
 * escuchar, así que la conversación moría en ese turno y sólo se recuperaba
 * pulsando el botón a mano. No es una hipótesis: es la única salida que faltaba
 * para poder prometer "vuelve a escuchar solo".
 *
 * 45 s es un tope deliberadamente holgado: una respuesta hablada legítima dura
 * 7-15 s medidos, así que esto nunca corta audio bueno; sólo rescata una sesión
 * que ya no responde.
 */
const WATCHDOG_TURNO_MS = 45000;
/** Reconexiones acotadas ante una caída del WebSocket Live (no un bucle infinito). */
const MAX_RECONEXIONES = 2;

/**
 * Diagnóstico de UN TURNO, punto por punto (A-O del encargo).
 *
 * Existe porque "el WebSocket responde" NO significa "se oye": este objeto
 * registra la cadena completa para poder ver EN PANTALLA dónde se rompe.
 * No contiene audio ni secretos.
 */
export interface DiagnosticoPcm {
  /** A. ¿Gemini ha enviado audio en este turno? */
  geminiGeneraAudio: boolean;
  /** B/C. chunks de audio recibidos. */
  chunksRecibidos: number;
  /** D. bytes recibidos (ya decodificados de base64). */
  bytesRecibidos: number;
  /** E. mimeType REAL declarado por Gemini. */
  mimeTypeReal: string | null;
  /** F. sample rate REAL (deducido del mimeType). */
  sampleRateReal: number | null;
  /** G. conversión Int16 -> Float32 correcta. */
  conversionInt16Ok: boolean;
  /** H. AudioBuffer creados. */
  audioBuffersCreados: number;
  /** I. source.start() ejecutados. */
  startEjecutados: number;
  /** número de chunks que llegaron a TERMINAR de sonar. */
  chunksReproducidos: number;
  /** J. estado del AudioContext. */
  audioContextState: string;
  /** K. conectado a AudioContext.destination. */
  conectadoADestination: boolean;
  /** L. errores de reproducción. */
  erroresReproduccion: string[];
  /** M. cómo se resolvió el autoplay. */
  autoplay: string;
  /** N. gain aplicado a la cadena de reproducción. */
  gain: number;
  /** O. si se alcanzó SPEAKING de verdad. */
  llegoASpeaking: boolean;
  /** sample rate usado en la reproducción. */
  rateReproduccion: number | null;
  /** Estado del WebSocket: OPEN / CONNECTING / CLOSED. */
  wsEstado: string;
  /** Estado del micrófono: capturando / pausado. */
  micEstado: string;
  /** ¿Hay reproducción activa en este instante? */
  playing: boolean;
  /** Resultado de la PRUEBA DE ALTAVOZ (tono local, sin Gemini). */
  tono: { lanzado: boolean; terminado: boolean; error: string | null };
}

/** Texto del estado del socket, legible en pantalla. */
function nombreReadyState(rs: number | undefined): string {
  if (rs === 0) return "CONNECTING";
  if (rs === 1) return "OPEN";
  if (rs === 2) return "CLOSING";
  if (rs === 3) return "CLOSED";
  return "SIN-SOCKET";
}

export function diagnosticoVacio(): DiagnosticoPcm {
  return {
    geminiGeneraAudio: false,
    chunksRecibidos: 0,
    bytesRecibidos: 0,
    mimeTypeReal: null,
    sampleRateReal: null,
    conversionInt16Ok: false,
    audioBuffersCreados: 0,
    startEjecutados: 0,
    chunksReproducidos: 0,
    audioContextState: "sin-contexto",
    conectadoADestination: false,
    erroresReproduccion: [],
    autoplay: "no-preparado",
    gain: 1,
    llegoASpeaking: false,
    rateReproduccion: null,
    wsEstado: "SIN-SOCKET",
    micEstado: "parado",
    playing: false,
    tono: { lanzado: false, terminado: false, error: null },
  };
}

/** Familias de error, para poder diagnosticar desde el móvil sin adivinar. */
export type ClaseErrorPcm =
  | "permiso_microfono"
  | "websocket"
  | "token_configuracion"
  | "captura"
  | "reproduccion"
  | "formato_resampling"
  | "desconocido";

/**
 * Traduce un código interno a una familia + un mensaje legible.
 *
 * NUNCA incluye tokens ni la clave: sólo el nombre del problema.
 */
export function clasificarErrorPcm(codigo: string): { clase: ClaseErrorPcm; mensaje: string } {
  const c = codigo.toUpperCase();
  if (/PERMISO|NOTALLOWED|SECURITYERROR/.test(c)) {
    return {
      clase: "permiso_microfono",
      mensaje: "Permiso de micrófono denegado. Actívalo en Ajustes → Permisos → Micrófono.",
    };
  }
  if (/SIN_MICROFONO|NOTFOUND|DEVICESNOTFOUND/.test(c)) {
    return { clase: "permiso_microfono", mensaje: "No se detecta ningún micrófono en el dispositivo." };
  }
  if (/^TOKEN|TOKEN_|GEMINI_LIVE_NOT_CONFIGURED|503/.test(c)) {
    return {
      clase: "token_configuracion",
      mensaje: "No se pudo obtener el token de sesión (revisa la configuración del servidor).",
    };
  }
  if (/WS_|SETUP_TIMEOUT|WSERR|CLOSE_|CONNECT/.test(c)) {
    return { clase: "websocket", mensaje: "No se pudo establecer la conexión con Gemini Live." };
  }
  if (/CAPTURA|AUDIOCONTEXT|SCRIPT_PROCESSOR|GETUSERMEDIA/.test(c)) {
    return { clase: "captura", mensaje: "Fallo al capturar audio del micrófono." };
  }
  if (/REPRODUC|BUFFER|AUDIOBUFFER/.test(c)) {
    return { clase: "reproduccion", mensaje: "Fallo al reproducir la respuesta de audio." };
  }
  if (/FORMATO|RESAMPL|RATE|MIME/.test(c)) {
    return { clase: "formato_resampling", mensaje: "Formato de audio o remuestreo incorrecto." };
  }
  return { clase: "desconocido", mensaje: `Error de voz: ${codigo}` };
}

export interface OpcionesSesionLive {
  baseUrl?: string;
  modelo?: string;
  onEstado?: (estado: EstadoPcm) => void;
  onMetricas?: (m: MetricasPcm) => void;
  onTranscripcion?: (t: { entrada?: string; salida?: string }) => void;
  onError?: (codigo: string, detalle?: string) => void;
}

export class SesionLivePcm {
  private estados = new EstadosPcm();
  private envio = new ColaEnvioPcm();
  private colaReproduccion: ColaReproduccionPcm | null = null;
  private socket: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private fuente: MediaStreamAudioSourceNode | null = null;
  private procesador: ScriptProcessorNode | null = null;
  private metricas: MetricasPcm = metricasVacias();
  /** Diagnóstico A-O del turno: se muestra en pantalla para ver dónde se rompe. */
  private diag: DiagnosticoPcm = diagnosticoVacio();

  /** Última vez que se detectó voz, para la cola de silencio. */
  private ultimaVozMs = 0;
  /**
   * ¿Se ha oído voz en ESTE turno?
   *
   * Evita cerrar un turno vacío (silencio de fondo) nada más abrir el micrófono,
   * que provocaría respuestas a la nada en bucle.
   */
  private huboVozEnTurno = false;
  private capturando = false;
  private soltadoElUsuario = false;
  private audioStreamEndEnviado = false;

  /**
   * Tras un `interrupted`, el servidor aún entrega unos chunks EN VUELO de la
   * respuesta cancelada (medido: 11-16 chunks ≈ 0,5 s). Si se encolaran, el
   * usuario oiría un trozo de la respuesta que acaba de interrumpir, así que se
   * descartan hasta el siguiente LÍMITE DE TURNO:
   *   - `turnComplete` (fin del turno cancelado), o
   *   - el `audioStreamEnd` del turno nuevo del usuario.
   * Los dos límites existen a propósito: si el servidor no mandara `turnComplete`,
   * el segundo evita que la sesión se quede muda para siempre.
   */
  private descartarAudioInterrumpido = false;
  /** Watchdog del turno en curso (ver WATCHDOG_TURNO_MS). */
  private watchdogTurno: number | null = null;
  /**
   * RECONEXIÓN DE LA CONEXIÓN LIVE (P0 medido en móvil).
   *
   * El WebSocket de Gemini Live se cae solo: cambio de red del teléfono, pantalla
   * bloqueada, cierre del servidor... Antes, el ÚNICO `onclose` vivía dentro del
   * arranque (`if (!this.setupCompleto) reject(...)`), así que una caída POSTERIOR
   * era invisible: la sesión seguía diciendo LISTENING con el socket muerto, el
   * micrófono seguía capturando al vacío y no se reconectaba nada. Al pulsar de
   * nuevo el botón, el estado acababa en `STATE=DISCONNECTED` con `WS=SIN-SOCKET`,
   * que es exactamente lo que se veía en el móvil.
   *
   * Ahora el cierre se vigila SIEMPRE y la sesión se rehace sola (con reanudación
   * del hilo si el servidor dio handle), sin tocar el micrófono ni el AudioContext.
   */
  private handleResumen: string | null = null;
  private reconexiones = 0;
  private reconectando = false;
  /** Un cierre pedido por el usuario NO es una caída: no se reconecta. */
  private cerrandoPorUsuario = false;
  private t0 = 0;
  private setupCompleto = false;
  private secuenciaSalida = 0;
  private tasaHardware = 0;
  private transcripcionEntrada = "";
  private transcripcionSalida = "";
  private alTerminar: (() => void) | null = null;

  constructor(private readonly opciones: OpcionesSesionLive = {}) {
    this.estados.suscribir((e) => this.opciones.onEstado?.(e));
  }

  get estado(): EstadoPcm {
    return this.estados.actual;
  }
  get metricasActuales(): MetricasPcm {
    return { ...this.metricas };
  }
  /** Diagnóstico A-O del turno en curso (para mostrarlo en pantalla). */
  get diagnostico(): DiagnosticoPcm {
    return {
      ...this.diag,
      erroresReproduccion: [...this.diag.erroresReproduccion],
      // Valores EN VIVO (no foto fija): el estado del socket, del micrófono y si
      // hay reproducción activa cambian en cada instante.
      wsEstado: nombreReadyState(this.socket?.readyState),
      micEstado: this.capturando ? "capturando" : "pausado",
      playing: this.colaReproduccion?.activa ?? false,
      audioContextState: this.audioContext?.state ?? this.diag.audioContextState,
    };
  }

  /**
   * PRUEBA DE ALTAVOZ: tono local por el MISMO AudioContext y destination.
   *
   * POR QUÉ ES LA PRUEBA MÁS ÚTIL
   * Separa en segundos dos mundos que se confunden:
   *   - si el tono SUENA  -> el dispositivo puede reproducir y el problema está
   *     en el camino de Gemini (chunks/formato/cola);
   *   - si NO suena       -> el problema es AudioContext/WebView/routing/volumen,
   *     y ninguna corrección en Gemini lo va a arreglar.
   *
   * NO usa Gemini ni TTS: es un tono generado localmente. Además informa de si
   * `onended` llega, que es la señal de que el RELOJ de audio avanza de verdad
   * (si `start()` se llama pero `onended` nunca llega, el reproductor está
   * bloqueado por más que el código parezca correcto).
   *
   * DEBE llamarse desde un gesto del usuario (síncrono con el clic).
   */
  probarAltavoz(): void {
    this.diag.tono = { lanzado: false, terminado: false, error: null };
    try {
      this.audioContext ??= this.crearAudioContext();
      const ctx = this.audioContext;
      void ctx.resume().catch(() => undefined);
      this.diag.audioContextState = ctx.state;

      // Tono de 660 Hz durante 0,7 s, con rampa para no chasquear.
      const rate = ctx.sampleRate;
      const dur = 0.7;
      const n = Math.floor(rate * dur);
      const buffer = ctx.createBuffer(1, n, rate);
      const datos = buffer.getChannelData(0);
      for (let i = 0; i < n; i += 1) {
        const t = i / rate;
        const rampa = Math.min(1, t / 0.05, (dur - t) / 0.05);
        datos[i] = Math.sin(2 * Math.PI * 660 * t) * 0.25 * Math.max(0, rampa);
      }

      const nodo = ctx.createBufferSource();
      nodo.buffer = buffer;
      nodo.connect(ctx.destination);
      this.diag.conectadoADestination = true;
      this.diag.rateReproduccion = rate;
      nodo.onended = () => {
        this.diag.tono.terminado = true;
      };
      nodo.start();
      this.diag.tono.lanzado = true;
    } catch (causa) {
      this.diag.tono.error = causa instanceof Error ? causa.message : String(causa);
    }
  }
  /** Frecuencia REAL del hardware (la que reporta el AudioContext). */
  get sampleRateHardware(): number {
    return this.tasaHardware;
  }

  // ── Arranque ──────────────────────────────────────────────────────────────

  async iniciar(): Promise<void> {
    if (this.estados.actual !== "DISCONNECTED" && this.estados.actual !== "ERROR") {
      throw new Error("SESION_YA_ACTIVA");
    }
    this.estados.ir("CONNECTING");
    this.t0 = Date.now();
    this.metricas = metricasVacias();
    this.diag = diagnosticoVacio();
    // Se conserva el estado REAL del contexto si ya se creó en el gesto.
    if (this.audioContext) {
      this.diag.audioContextState = this.audioContext.state;
      this.diag.autoplay = "gesto";
    }
    this.transcripcionEntrada = "";
    this.transcripcionSalida = "";
    this.secuenciaSalida = 0;
    this.audioStreamEndEnviado = false;
    this.soltadoElUsuario = false;
    // Sesión NUEVA: la vigilancia de caídas parte de cero.
    this.handleResumen = null;
    this.reconexiones = 0;
    this.reconectando = false;
    this.cerrandoPorUsuario = false;

    try {
      await this.pedirTokenYAbrir();
    } catch (causa) {
      this.fallar(causa instanceof Error ? causa.message : String(causa));
      throw causa;
    }
  }

  private async pedirTokenYAbrir(): Promise<void> {
    const base = this.opciones.baseUrl ?? "";
    const res = await fetch(`${base}/api/asistente/gemini-live/token`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`TOKEN_HTTP_${res.status}`);
    const datos = (await res.json()) as { token?: string; model?: string };
    if (!datos.token) throw new Error("TOKEN_INVALIDO");

    const modelo = this.opciones.modelo ?? datos.model ?? "gemini-3.8-live";
    const socket = new WebSocket(`${WS_LIVE}?access_token=${encodeURIComponent(datos.token)}`);
    // Gemini responde en frame BINARIO: hay que pedir arraybuffer para poder
    // decodificarlo (si no, el mensaje se descarta y la sesión se cuelga).
    try {
      socket.binaryType = "arraybuffer";
    } catch {
      /* runtime sin soporte */
    }
    this.socket = socket;

    await new Promise<void>((resolve, reject) => {
      const temporizador = setTimeout(() => reject(new Error("SETUP_TIMEOUT")), 15000);

      socket.onopen = () => {
        this.metricas.connect_ms = Date.now() - this.t0;
        // El setup es SIEMPRE el primer mensaje.
        socket.send(
          JSON.stringify({
            setup: {
              model: `models/${modelo}`,
              generationConfig: { responseModalities: ["AUDIO"] },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              // REANUDACIÓN: el servidor manda handles y, al reconectar tras una
              // caída, se reanuda el MISMO hilo de conversación en vez de empezar
              // de cero (el usuario no repite lo que ya dijo).
              sessionResumption: this.handleResumen ? { handle: this.handleResumen } : {},
            },
          })
        );
      };

      socket.onmessage = async (evento) => {
        const texto = await this.aTexto(evento.data);
        if (!texto) return;
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(texto) as Record<string, unknown>;
        } catch {
          return;
        }

        if (msg.setupComplete) {
          this.setupCompleto = true;
          this.metricas.setup_ms = Date.now() - this.t0;
          clearTimeout(temporizador);
          resolve();
          return;
        }
        const err = msg.error as { message?: string } | undefined;
        if (err) {
          clearTimeout(temporizador);
          reject(new Error(`GEMINI_ERROR: ${String(err.message ?? "").slice(0, 120)}`));
          return;
        }
        this.procesarServidor(msg);
      };

      socket.onerror = () => {
        clearTimeout(temporizador);
        reject(new Error("WS_ERROR"));
      };
      socket.onclose = (ev) => {
        if (!this.setupCompleto) {
          clearTimeout(temporizador);
          reject(new Error(`WS_CLOSE_${ev.code}`));
          return;
        }
        // CIERRE DESPUÉS DEL SETUP = CAÍDA DE LA CONEXIÓN (no un cierre del usuario).
        // Antes esto no se atendía y la sesión se quedaba "LISTENING" con el socket
        // muerto: el usuario hablaba y no pasaba absolutamente nada.
        this.alCaerLaConexion(ev.code, ev.reason);
      };
    });

    // Setup listo: ahora el micrófono (SI no estaba ya abierto: al reconectar se
    // conserva el mismo micrófono y el mismo AudioContext).
    if (!this.mediaStream) await this.abrirMicrofono();
    this.estados.ir("LISTENING");
  }

  /**
   * CAÍDA DE LA CONEXIÓN LIVE: se informa, se rehace el socket y se sigue.
   *
   * No toca el micrófono ni el AudioContext (siguen vivos): sólo se reabre el
   * WebSocket y se repite el setup, reanudando el hilo si hay handle.
   */
  private alCaerLaConexion(codigo: number, razon: string): void {
    if (this.cerrandoPorUsuario) return;
    if (this.reconectando) return;
    // El socket muerto no sirve para nada: fuera, para que nada intente enviar.
    this.socket = null;
    this.desarmarWatchdogTurno();
    this.diag.erroresReproduccion.push(
      `WS caído (${codigo}${razon ? `: ${String(razon).slice(0, 40)}` : ""}) tras el setup: se reconecta`
    );
    this.estados.ir("CONNECTING");
    void this.reconectar(codigo);
  }

  /** Reconexión acotada: si se agota, se limpia y se informa (nunca en silencio). */
  private async reconectar(codigo: number): Promise<void> {
    if (this.reconexiones >= MAX_RECONEXIONES) {
      this.opciones.onError?.("WS_CAIDO", `sin reconexion (cierre ${codigo})`);
      this.limpiar();
      this.estados.reset();
      this.alTerminar?.();
      this.alTerminar = null;
      return;
    }
    this.reconectando = true;
    this.reconexiones += 1;
    try {
      await this.pedirTokenYAbrir();
      if (this.estados.actual !== "SPEAKING") this.estados.ir("LISTENING");
      this.opciones.onMetricas?.(this.metricasActuales);
    } catch (causa) {
      this.opciones.onError?.("WS_CAIDO", causa instanceof Error ? causa.message : String(causa));
      this.limpiar();
      this.estados.reset();
      this.alTerminar?.();
      this.alTerminar = null;
    } finally {
      this.reconectando = false;
    }
  }

  /** Normaliza cualquier forma de mensaje a texto UTF-8. */
  private async aTexto(data: unknown): Promise<string | null> {
    if (typeof data === "string") return data;
    if (data instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(data));
    if (ArrayBuffer.isView(data)) {
      const v = data as ArrayBufferView;
      return new TextDecoder().decode(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
    }
    const blob = data as Blob | undefined;
    if (blob && typeof blob.text === "function") {
      try {
        return await blob.text();
      } catch {
        return null;
      }
    }
    return null;
  }

  // ── Micrófono: frecuencia REAL del hardware + resampling ──────────────────

  private crearAudioContext(): AudioContext {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    // SIN forzar sampleRate: así el contexto usa el del HARDWARE y podemos
    // detectarlo de verdad para remuestrear bien (forzarlo no cambia el hardware).
    return new Ctor();
  }

  /**
   * CREA Y REANUDA EL AudioContext **DENTRO DEL GESTO DEL USUARIO**.
   *
   * POR QUÉ ES IMPRESCINDIBLE (causa del "no se oye a Gemini")
   * Antes, el AudioContext se creaba al final de la cadena de arranque: después
   * del `fetch` del token, del `setupComplete` del WebSocket y —lo más grave— del
   * DIÁLOGO DE PERMISO de `getUserMedia`. Para entonces la activación por gesto
   * del usuario ya había expirado, así que en Android WebView el contexto nacía
   * en estado `suspended`; `resume()` fuera de un gesto puede quedar ignorado.
   *
   * Con el contexto suspendido, `source.start()` programa nodos que NUNCA suenan,
   * `onended` no llega nunca y la cola de reproducción se queda clavada en el
   * primer chunk: el micrófono y la transcripción funcionan, pero NO SE OYE NADA.
   * Exactamente el síntoma observado.
   *
   * Llamar a esto de forma SÍNCRONA en el manejador del clic garantiza que el
   * contexto arranque en "running". El contexto se reutiliza después entre
   * turnos (no se recrea la cadena de audio).
   */
  prepararAudioEnGesto(): void {
    try {
      this.audioContext ??= this.crearAudioContext();
      this.tasaHardware = this.audioContext.sampleRate;
      // Sin await: se pide la reanudación DENTRO del gesto.
      void this.audioContext.resume().catch(() => undefined);
      this.diag.autoplay = "gesto";
      this.diag.audioContextState = this.audioContext.state;
    } catch (causa) {
      this.diag.autoplay = `error:${causa instanceof Error ? causa.message : String(causa)}`;
    }
  }

  /** Asegura que el contexto está "running"; deja constancia si no lo está. */
  private async garantizarAudioActivo(): Promise<void> {
    const ctx = this.audioContext;
    if (!ctx) return;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch (causa) {
        this.diag.erroresReproduccion.push(
          `resume: ${causa instanceof Error ? causa.message : String(causa)}`
        );
      }
    }
    this.diag.audioContextState = ctx.state;
    // Si sigue suspendido, la reproducción no sonará: se registra para que se vea
    // en pantalla en vez de fallar en silencio.
    if (ctx.state !== "running") {
      this.diag.erroresReproduccion.push(`AudioContext en estado "${ctx.state}" (no sonará)`);
    }
  }

  private async abrirMicrofono(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("CAPTURA_SIN_GETUSERMEDIA");

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (causa) {
      // Se distingue el permiso denegado del "no hay micrófono": son problemas
      // distintos y el usuario puede arreglar uno y no el otro.
      const nombre = causa instanceof Error ? causa.name : String(causa);
      if (nombre === "NotAllowedError" || nombre === "SecurityError") throw new Error("PERMISO_MICROFONO_DENEGADO");
      if (nombre === "NotFoundError" || nombre === "DevicesNotFoundError") throw new Error("SIN_MICROFONO");
      throw new Error(`CAPTURA_${nombre}`);
    }

    // El AudioContext se REUTILIZA si ya se creó dentro del gesto del usuario
    // (ver `prepararAudioEnGesto`). Si no, se crea aquí como respaldo.
    this.audioContext ??= this.crearAudioContext();
    this.tasaHardware = this.audioContext.sampleRate;
    await this.garantizarAudioActivo();

    const fuente = this.audioContext.createMediaStreamSource(this.mediaStream);
    // 2048 muestras: a 48 kHz son ~43 ms, dentro del objetivo de 20-100 ms.
    const procesador = this.audioContext.createScriptProcessor(2048, 1, 1);
    this.fuente = fuente;
    this.procesador = procesador;

    procesador.onaudioprocess = (evento) => this.alCapturar(evento.inputBuffer.getChannelData(0));

    // El procesador necesita estar conectado para que el navegador lo llame, pero
    // NO debe sonar por el altavoz: se conecta a un nodo mudo.
    const mudo = this.audioContext.createGain();
    mudo.gain.value = 0;
    fuente.connect(procesador);
    procesador.connect(mudo);
    mudo.connect(this.audioContext.destination);

    this.prepararReproductor();
    this.capturando = true;
    this.ultimaVozMs = performance.now();
  }

  /** Convierte un bloque del micrófono y lo encola para enviar. */
  private alCapturar(muestras: Float32Array): void {
    if (!this.capturando || !this.setupCompleto) return;

    // ¿Hay voz? (para saber cuándo empieza la cola de silencio)
    let suma = 0;
    for (let i = 0; i < muestras.length; i += 1) suma += muestras[i] * muestras[i];
    const rms = Math.sqrt(suma / muestras.length);
    if (rms > UMBRAL_VOZ) {
      this.ultimaVozMs = performance.now();
      this.huboVozEnTurno = true;
    }

    // Remuestreo REAL a 16 kHz (el hardware casi nunca va a 16 kHz).
    const a16 = remuestrearA16k(muestras, this.tasaHardware);
    const bytes = float32AInt16LE(a16);

    // Se trocea al tamaño objetivo (40 ms) para no mandar buffers grandes.
    for (let off = 0; off < bytes.length; off += BYTES_POR_CHUNK) {
      this.envio.encolar(bytes.subarray(off, Math.min(off + BYTES_POR_CHUNK, bytes.length)));
    }
    this.drenar();
    this.evaluarCierreDeTurno();
  }

  /** Envía lo encolado. La cola limitada actúa de backpressure. */
  private drenar(): void {
    if (!this.socket || this.socket.readyState !== 1) return;
    let trozo = this.envio.sacar();
    while (trozo) {
      if (this.metricas.first_audio_input_ms === null) {
        this.metricas.first_audio_input_ms = Date.now() - this.t0;
      }
      this.socket.send(
        JSON.stringify({
          realtimeInput: { audio: { data: bytesABase64(trozo), mimeType: MIME_ENTRADA } },
        })
      );
      this.metricas.input_chunks += 1;
      trozo = this.envio.sacar();
    }
  }

  /**
   * Cierra el turno SOLO tras la cola de silencio.
   *
   * El usuario "suelta" (parar()), pero se sigue enviando silencio durante
   * COLA_SILENCIO_MS para que el detector de actividad detecte el final. Sin
   * esto, Gemini no responde nada (comprobado contra la API real).
   */
  private evaluarCierreDeTurno(): void {
    if (this.audioStreamEndEnviado) return;
    // SÓLO se cierra estando en LISTENING. Durante SPEAKING el micrófono puede
    // estar oyendo el altavoz: cerrar ahí cortaría la respuesta del propio modelo.
    if (this.estados.actual !== "LISTENING") return;
    // SIN SOCKET VIVO no se puede cerrar nada: cerrar un turno que no se puede
    // enviar sólo servía para armar el watchdog de 45 s y acabar en el error del
    // móvil. Mientras se reconecta, el turno simplemente sigue abierto.
    if (!this.socket || this.socket.readyState !== 1) return;
    // No se cierra un turno en el que no se ha oído nada (evita responder a la nada).
    if (!this.soltadoElUsuario && !this.huboVozEnTurno) return;

    const silencioMs = performance.now() - this.ultimaVozMs;
    if (silencioMs < COLA_SILENCIO_MS) return;

    this.audioStreamEndEnviado = true;
    // Cierra el descarte de una interrupción anterior: el turno del usuario ya ha
    // terminado, así que lo que venga a partir de aquí es su respuesta legítima.
    this.descartarAudioInterrumpido = false;
    // El micrófono SIGUE ABIERTO mientras el modelo piensa y habla.
    //
    // Es la condición para el barge-in NATIVO: si se deja de enviar audio, Gemini
    // no puede oír la interrupción y `serverContent.interrupted` NUNCA llega — la
    // sesión queda sorda justo cuando el usuario quiere cortar. Antes se ponía
    // `capturando = false` aquí y ese era el motivo real de que no hubiera
    // interrupción posible, ni local ni del proveedor.
    //
    // El eco del altavoz hacia el micrófono queda cubierto por las restricciones
    // que ya se piden en abrirMicrofono(): echoCancellation, noiseSuppression y
    // autoGainControl. NO se añade barge-in local por RMS: primero se valida el
    // mecanismo del proveedor.
    try {
      this.socket?.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
    } catch {
      /* el socket pudo cerrarse */
    }
    this.estados.ir("PROCESSING");
    // A partir de aquí la sesión espera al servidor: se arma el rescate por si el
    // fin del turno nunca llega.
    this.armarWatchdogTurno();
  }

  /**
   * Arma el rescate del turno: si en WATCHDOG_TURNO_MS no ha llegado el fin,
   * se descarta el audio que quede en vuelo y se VUELVE A ESCUCHAR sobre la misma
   * sesión (no se cierra el WebSocket ni se rehace la cadena de audio).
   */
  private armarWatchdogTurno(): void {
    this.desarmarWatchdogTurno();
    this.watchdogTurno = window.setTimeout(() => {
      this.watchdogTurno = null;
      if (this.estados.actual !== "PROCESSING" && this.estados.actual !== "SPEAKING") return;
      // Queda escrito en pantalla: un rescate silencioso ocultaría un fallo real
      // del proveedor o de la red.
      this.diag.erroresReproduccion.push(
        `watchdog: ${Math.round(WATCHDOG_TURNO_MS / 1000)} s sin fin de turno (se vuelve a escuchar)`
      );
      this.descartarAudioInterrumpido = true;
      this.colaReproduccion?.limpiar();
      this.volverAEscuchar();
    }, WATCHDOG_TURNO_MS);
  }

  private desarmarWatchdogTurno(): void {
    if (this.watchdogTurno !== null) {
      window.clearTimeout(this.watchdogTurno);
      this.watchdogTurno = null;
    }
  }

  /** El usuario ha terminado de hablar: se deja la cola de silencio y se espera. */
  entregarTurno(): void {
    if (this.estados.actual !== "LISTENING") return;
    this.soltadoElUsuario = true;
    this.evaluarCierreDeTurno();
  }

  // ── Respuesta: audio 24 kHz por el altavoz ────────────────────────────────

  private prepararReproductor(): void {
    if (!this.audioContext) return;
    const ctx = this.audioContext;
    let fuentesActivas = new Set<AudioBufferSourceNode>();

    const programador: ProgramadorReproduccion = {
      programar: (muestras, rate, onFin) => {
        // INVARIANTE: pase lo que pase, `onFin` se llama SIEMPRE. Si no, la cola
        // se queda clavada en `reproduciendo = true` y el silencio es permanente.
        try {
          if (!muestras || muestras.length === 0) {
            onFin();
            return;
          }
          this.diag.rateReproduccion = rate;
          const buffer = ctx.createBuffer(1, muestras.length, rate);
          // getChannelData().set() en vez de copyToChannel(): evita la fricción de
          // tipos ArrayBuffer/ArrayBufferLike de copyToChannel en TS estricto.
          buffer.getChannelData(0).set(muestras);
          this.diag.audioBuffersCreados += 1;

          const nodo = ctx.createBufferSource();
          nodo.buffer = buffer;
          nodo.connect(ctx.destination);
          this.diag.conectadoADestination = true;

          nodo.onended = () => {
            fuentesActivas.delete(nodo);
            this.diag.chunksReproducidos += 1;
            onFin();
          };
          fuentesActivas.add(nodo);
          nodo.start();
          this.diag.startEjecutados += 1;
          this.diag.audioContextState = ctx.state;
        } catch (causa) {
          this.diag.erroresReproduccion.push(
            causa instanceof Error ? causa.message : String(causa)
          );
          onFin(); // nunca dejar la cola bloqueada
        }
      },
      detener: () => {
        for (const n of fuentesActivas) {
          try {
            n.onended = null;
            n.stop();
          } catch {
            /* ya parado */
          }
        }
        fuentesActivas = new Set();
      },
    };
    this.colaReproduccion = new ColaReproduccionPcm(programador);
  }

  private procesarServidor(msg: Record<string, unknown>): void {
    // HANDLE DE REANUDACIÓN: el servidor lo ofrece para poder reconectar tras una
    // caída sin perder el hilo. Antes se recibía y se tiraba a la basura.
    const resumen = msg.sessionResumptionUpdate as
      | { newHandle?: string; resumable?: boolean }
      | undefined;
    if (resumen) {
      if (resumen.resumable && resumen.newHandle) this.handleResumen = resumen.newHandle;
      return;
    }

    const sc = msg.serverContent as
      | {
          inputTranscription?: { text?: string };
          outputTranscription?: { text?: string };
          modelTurn?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
          turnComplete?: boolean;
          interrupted?: boolean;
        }
      | undefined;
    if (!sc) return;

    // ── BARGE-IN NATIVO DEL PROVEEDOR ────────────────────────────────────────
    // Gemini avisa por aquí de que ha oído al usuario por encima de su propia
    // respuesta. Se corta el audio YA (no se espera a `turnComplete`) y se vuelve
    // a escuchar reutilizando `volverAEescuchar()`, que NO cierra el WebSocket ni
    // crea otra sesión: reutiliza socket, AudioContext, micrófono y cola.
    // Sin este manejador, `interrupted` se ignoraba y la respuesta seguía sonando
    // hasta el final: el usuario hablaba y el modelo no se enteraba.
    if (sc.interrupted === true) {
      // A partir de aquí se descarta el audio en vuelo de la respuesta cancelada:
      // vaciar la cola NO basta, porque aún llegan chunks DESPUÉS de este aviso.
      this.descartarAudioInterrumpido = true;
      this.colaReproduccion?.limpiar();
      this.volverAEscuchar();
      return;
    }

    if (sc.inputTranscription?.text) this.transcripcionEntrada += sc.inputTranscription.text;
    if (sc.outputTranscription?.text) this.transcripcionSalida += sc.outputTranscription.text;

    for (const parte of sc.modelTurn?.parts ?? []) {
      const datos = parte.inlineData?.data;
      if (!datos) continue;
      // Audio EN VUELO de una respuesta ya interrumpida: no se reproduce.
      if (this.descartarAudioInterrumpido) continue;
      if (this.metricas.first_audio_output_ms === null) {
        this.metricas.first_audio_output_ms = Date.now() - this.t0;
      }
      // Evidencia E/F: se guarda el mimeType REAL que declara Gemini, no el que
      // esperamos. De ahí se deduce el sample rate real de la respuesta.
      const mime = parte.inlineData?.mimeType ?? null;
      if (mime && this.diag.mimeTypeReal === null) {
        this.diag.mimeTypeReal = mime;
        const m = /rate=(\d+)/.exec(mime);
        this.diag.sampleRateReal = m ? Number(m[1]) : null;
      }
      this.diag.geminiGeneraAudio = true;

      const bytes = base64ABytes(datos);
      this.diag.chunksRecibidos += 1;
      this.diag.bytesRecibidos += bytes.length;

      const flotantes = int16LEAFloat32(bytes);
      // Evidencia G: la conversión es correcta si produce muestras y ninguna es NaN.
      if (flotantes.length > 0 && !Number.isNaN(flotantes[0])) {
        this.diag.conversionInt16Ok = true;
      }

      this.colaReproduccion?.encolar(this.secuenciaSalida, bytes);
      this.secuenciaSalida += 1;
      this.metricas.output_chunks += 1;
      // LISTENING -> PROCESSING -> SPEAKING (una sola reproducción).
      if (this.estados.actual === "LISTENING") this.estados.ir("PROCESSING");
      if (this.estados.actual === "PROCESSING") this.estados.ir("SPEAKING");
      if (this.estados.actual === "SPEAKING") {
        this.diag.llegoASpeaking = true;
        // Si el modelo habla ESPONTÁNEAMENTE (sin turno del usuario) el watchdog
        // no se había armado: se arma aquí, una sola vez por turno.
        if (this.watchdogTurno === null) this.armarWatchdogTurno();
      }
    }

    if (sc.turnComplete === true) {
      // Fin del turno (también del cancelado): se vuelve a aceptar audio normal.
      this.descartarAudioInterrumpido = false;
      this.metricas.turn_total_ms = Date.now() - this.t0;
      this.opciones.onTranscripcion?.({
        entrada: this.transcripcionEntrada,
        salida: this.transcripcionSalida,
      });
      // turnComplete NO corta el audio: se espera a que suene TODO lo encolado y
      // sólo entonces se vuelve a escuchar. Y se vuelve sobre LA MISMA sesión: no
      // se cierra el socket ni se rehace la cadena de audio.
      void this.colaReproduccion?.esperarFin().then(() => {
        this.opciones.onMetricas?.(this.metricasActuales);
        this.volverAEscuchar();
      });
    }
  }

  /**
   * ESCUCHA CONTINUA: prepara el turno siguiente reutilizando la infraestructura.
   *
   * El WebSocket, el AudioContext, el micrófono y la cola de reproducción se
   * REUTILIZAN tal cual; sólo se reinician los flags y las métricas del turno.
   * Verificado contra la API real: un mismo WebSocket admite varios turnos, cada
   * uno con su `audioStreamEnd` (3/3 turnos completos en la misma conexión).
   */
  private volverAEscuchar(): void {
    // El turno ha terminado (por donde sea): el rescate ya no hace falta.
    this.desarmarWatchdogTurno();
    const socketVivo = this.socket !== null && this.socket.readyState === 1;
    if (!socketVivo || !this.mediaStream) {
      // La sesión ya no sirve: se limpia todo y se queda en DISCONNECTED.
      this.limpiar();
      this.estados.reset();
      this.alTerminar?.();
      this.alTerminar = null;
      return;
    }

    this.soltadoElUsuario = false;
    this.audioStreamEndEnviado = false;
    this.capturando = true;
    this.huboVozEnTurno = false;
    this.ultimaVozMs = performance.now();
    this.transcripcionEntrada = "";
    this.transcripcionSalida = "";
    // Métricas del turno nuevo (se conservan las de la conexión: connect/setup).
    this.metricas.first_audio_input_ms = null;
    this.metricas.first_audio_output_ms = null;
    this.metricas.turn_total_ms = null;
    this.metricas.input_chunks = 0;
    this.metricas.output_chunks = 0;
    this.t0 = Date.now();
    this.colaReproduccion?.nuevoTurno();

    this.estados.ir("LISTENING");
    this.alTerminar?.();
    this.alTerminar = null;
  }

  /** Promesa que se resuelve cuando el turno acaba de verdad (audio incluido). */
  esperarTurno(): Promise<void> {
    return new Promise((r) => {
      this.alTerminar = r;
    });
  }

  // ── Parada y limpieza ─────────────────────────────────────────────────────

  /** Parada del usuario: NO corta el audio, deja cerrar el turno. */
  parar(): void {
    this.entregarTurno();
    // Si nunca hubo setup o ya no hay sesión, se limpia del todo.
    if (!this.setupCompleto) this.limpiar();
  }

  /** Cancelación dura: corta audio, suelta el micrófono y vuelve a IDLE. */
  cancelar(): void {
    this.limpiar();
  }

  private limpiar(): void {
    // A partir de aquí cualquier cierre del socket es ESPERADO: no es una caída.
    this.cerrandoPorUsuario = true;
    this.capturando = false;
    this.desarmarWatchdogTurno();
    this.fallar_(null);

    if (this.procesador) {
      this.procesador.onaudioprocess = null;
      try {
        this.procesador.disconnect();
      } catch {
        /* ignore */
      }
      this.procesador = null;
    }
    if (this.fuente) {
      try {
        this.fuente.disconnect();
      } catch {
        /* ignore */
      }
      this.fuente = null;
    }
    if (this.mediaStream) {
      for (const pista of this.mediaStream.getTracks()) pista.stop();
      this.mediaStream = null;
    }
    if (this.audioContext) {
      void this.audioContext.close().catch(() => undefined);
      this.audioContext = null;
    }
    this.colaReproduccion?.limpiar();
    this.colaReproduccion = null;
    this.envio.limpiar();
    if (this.socket) {
      try {
        this.socket.close(1000, "fin");
      } catch {
        /* ignore */
      }
      this.socket = null;
    }
    this.setupCompleto = false;
    this.transcripcionEntrada = "";
    this.transcripcionSalida = "";
  }

  /** Limpieza interna sin notificar error. */
  private fallar_(codigo: string | null): void {
    if (codigo) this.opciones.onError?.(codigo);
  }

  private fallar(codigo: string): void {
    this.limpiar();
    this.metricas.errorCode = codigo;
    this.opciones.onError?.(codigo);
    this.estados.ir("ERROR");
    this.estados.reset();
  }
}
