/**
 * VOZ 360 — CAMINO PCM REAL (Gemini Live)
 *
 * Qué hay aquí y qué NO:
 *   - SÍ: captura a PCM 16 kHz mono Int16 LE por chunks pequeños, base64, cola
 *     limitada con backpressure, y reproducción incremental de 24 kHz con orden
 *     garantizado y limpieza total.
 *   - NO: function calling, presupuestos, partes, facturas, clientes. Este módulo
 *     sólo mueve audio.
 *
 * HALLAZGO IMPORTANTE (medido contra la API real)
 * Gemini Live NO cierra el turno si se le corta el audio en seco: hay que dejar
 * una COLA DE SILENCIO después de la locución. Enviar `audioStreamEnd`
 * inmediatamente después de la última muestra de voz NO basta: el servidor se
 * queda esperando y no responde absolutamente nada (ni audio ni turnComplete).
 * Un micrófono real entrega ese silencio de forma natural, así que la captura
 * debe seguir enviando mientras el usuario calla; ver `COLA_SILENCIO_MS`.
 *
 * La lógica pura (resampling, conversión a Int16 LE, base64 y las colas) está
 * separada de Web Audio a propósito: así se puede verificar sin navegador.
 */

// ────────────────────────────────────────────────────────────────────────────
// Formatos exigidos por Gemini Live
// ────────────────────────────────────────────────────────────────────────────

/** Entrada que espera Gemini: PCM 16 bits little-endian, mono, 16 kHz. */
export const RATE_ENTRADA = 16000;
/** Salida que devuelve Gemini (`audio/pcm;rate=24000`). */
export const RATE_SALIDA = 24000;
/** MIME exacto que hay que declarar al enviar audio. */
export const MIME_ENTRADA = `audio/pcm;rate=${RATE_ENTRADA}`;
/** MIME que se debe esperar en la respuesta. */
export const MIME_SALIDA = `audio/pcm;rate=${RATE_SALIDA}`;

/** Duración de cada chunk enviado. Objetivo del enunciado: 20-100 ms. */
export const CHUNK_MS = 40;
export const MUESTRAS_POR_CHUNK = (RATE_ENTRADA * CHUNK_MS) / 1000;
export const BYTES_POR_CHUNK = MUESTRAS_POR_CHUNK * 2;

/**
 * Silencio que se sigue enviando tras la última voz antes de cerrar el turno.
 * Sin esto la respuesta nunca llega (ver cabecera).
 */
export const COLA_SILENCIO_MS = 1500;

/** Tope de chunks en vuelo: si el socket va lento, se descarta lo más viejo. */
export const MAX_CHUNKS_EN_COLA = 50;

// ────────────────────────────────────────────────────────────────────────────
// Conversiones puras (verificables sin navegador)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Remuestrea a 16 kHz por interpolación lineal.
 *
 * POR QUÉ ES OBLIGATORIO: el AudioContext de un navegador suele correr a 48 kHz
 * aunque se le pida 16 kHz (el hardware manda). Enviar esas muestras declarando
 * `rate=16000` haría que Gemini oyera la voz acelerada (efecto chipmunk) y no
 * entendería nada. Hay que remuestrear DE VERDAD.
 */
export function remuestrearA16k(muestras: Float32Array, rateOrigen: number): Float32Array {
  if (rateOrigen === RATE_ENTRADA) return muestras;
  if (rateOrigen <= 0) return new Float32Array(0);
  const factor = rateOrigen / RATE_ENTRADA;
  const salida = new Float32Array(Math.floor(muestras.length / factor));
  for (let i = 0; i < salida.length; i += 1) {
    const posicion = i * factor;
    const bajo = Math.floor(posicion);
    const alto = Math.min(bajo + 1, muestras.length - 1);
    const peso = posicion - bajo;
    salida[i] = muestras[bajo] * (1 - peso) + muestras[alto] * peso;
  }
  return salida;
}

/** Convierte Float32 [-1,1] a bytes Int16 LITTLE-ENDIAN (mono). */
export function float32AInt16LE(muestras: Float32Array): Uint8Array {
  const bytes = new Uint8Array(muestras.length * 2);
  const vista = new DataView(bytes.buffer);
  for (let i = 0; i < muestras.length; i += 1) {
    const v = Math.max(-1, Math.min(1, muestras[i]));
    // 32767 para el máximo positivo y -32768 para el negativo (rango Int16 real).
    const entero = v < 0 ? Math.round(v * 32768) : Math.round(v * 32767);
    vista.setInt16(i * 2, Math.max(-32768, Math.min(32767, entero)), true); // true = little-endian
  }
  return bytes;
}

/** Bytes Int16 LE -> Float32 [-1,1] (para reproducir lo que devuelve Gemini). */
export function int16LEAFloat32(bytes: Uint8Array): Float32Array {
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = Math.floor(bytes.byteLength / 2);
  const salida = new Float32Array(n);
  for (let i = 0; i < n; i += 1) salida[i] = vista.getInt16(i * 2, true) / 32768;
  return salida;
}

/** Base64 de bytes (sin dependender de Buffer: sirve en navegador y en Node). */
export function bytesABase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let binario = "";
  for (let i = 0; i < bytes.length; i += 1) binario += String.fromCharCode(bytes[i]);
  return btoa(binario);
}

/** Base64 -> bytes. */
export function base64ABytes(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(b64, "base64"));
  const binario = atob(b64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/** ¿Estos bytes son PCM crudo y NO un WAV? (no puede empezar por "RIFF"). */
export function esPcmCrudo(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return true;
  const cabecera = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  return cabecera !== "RIFF";
}

// ────────────────────────────────────────────────────────────────────────────
// Estados
// ────────────────────────────────────────────────────────────────────────────

export type EstadoPcm =
  | "DISCONNECTED"
  | "CONNECTING"
  | "LISTENING"
  | "PROCESSING"
  | "SPEAKING"
  | "ERROR";

/**
 * Transiciones permitidas.
 *
 * La cadena de la conversación continua es:
 *   DISCONNECTED -> CONNECTING -> LISTENING -> PROCESSING -> SPEAKING
 *                -> LISTENING -> … (sin rehacer la cadena de audio)
 *
 * `SPEAKING -> LISTENING` es la transición CLAVE de la escucha continua: al
 * acabar el turno se vuelve a escuchar SOBRE LA MISMA SESIÓN. Está verificado
 * contra la API real: un mismo WebSocket admite varios turnos, cada uno con su
 * `audioStreamEnd` (3/3 turnos completos en la misma conexión).
 *
 * Las reglas siguen impidiendo dos capturas o dos reproducciones simultáneas.
 */
const TRANSICIONES: Record<EstadoPcm, EstadoPcm[]> = {
  DISCONNECTED: ["CONNECTING", "LISTENING", "ERROR"],
  CONNECTING: ["LISTENING", "ERROR", "DISCONNECTED"],
  LISTENING: ["PROCESSING", "SPEAKING", "DISCONNECTED", "ERROR"],
  PROCESSING: ["SPEAKING", "LISTENING", "DISCONNECTED", "ERROR"],
  SPEAKING: ["LISTENING", "DISCONNECTED", "ERROR"],
  ERROR: ["DISCONNECTED"],
};

export function transicionPermitida(desde: EstadoPcm, hacia: EstadoPcm): boolean {
  if (desde === hacia) return false;
  return (TRANSICIONES[desde] ?? []).includes(hacia);
}

/** Máquina de estados mínima para PCM. No permite saltos imposibles. */
export class EstadosPcm {
  private estado: EstadoPcm = "DISCONNECTED";
  private oyentes = new Set<(e: EstadoPcm) => void>();

  get actual(): EstadoPcm {
    return this.estado;
  }

  /** Cambia de estado. Devuelve false si la transición no está permitida. */
  ir(hacia: EstadoPcm): boolean {
    if (!transicionPermitida(this.estado, hacia)) return false;
    this.estado = hacia;
    for (const o of this.oyentes) o(hacia);
    return true;
  }

  /** Vuelve a DISCONNECTED desde donde sea (cancelar/cerrar/error). */
  reset(): void {
    this.estado = "DISCONNECTED";
    for (const o of this.oyentes) o("DISCONNECTED");
  }

  suscribir(fn: (e: EstadoPcm) => void): () => void {
    this.oyentes.add(fn);
    return () => this.oyentes.delete(fn);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Cola de ENVÍO (captura -> socket) con backpressure
// ────────────────────────────────────────────────────────────────────────────

/**
 * Cola limitada de chunks de entrada.
 *
 * INVARIANTES:
 *  - el ORDEN se conserva siempre (FIFO);
 *  - nunca hay dos capturas a la vez (lo garantiza el llamante con `EstadosPcm`);
 *  - si el socket va lento y la cola se llena, se DESCARTA lo más viejo y se
 *    cuenta como `descartes` (backpressure). Se prefiere perder audio viejo a
 *    acumular memoria sin límite o a crecer en latencia sin fin.
 */
export class ColaEnvioPcm {
  private cola: Uint8Array[] = [];
  private descartes = 0;
  private enviados = 0;

  constructor(private readonly maximo: number = MAX_CHUNKS_EN_COLA) {}

  encolar(bytes: Uint8Array): void {
    this.cola.push(bytes);
    while (this.cola.length > this.maximo) {
      this.cola.shift();
      this.descartes += 1;
    }
  }

  sacar(): Uint8Array | null {
    const siguiente = this.cola.shift();
    if (!siguiente) return null;
    this.enviados += 1;
    return siguiente;
  }

  get tamaño(): number {
    return this.cola.length;
  }
  get estadisticas() {
    return { pendientes: this.cola.length, enviados: this.enviados, descartes: this.descartes };
  }

  limpiar(): void {
    this.cola = [];
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Cola de REPRODUCCIÓN (socket -> altavoz)
// ────────────────────────────────────────────────────────────────────────────

export interface ProgramadorReproduccion {
  /** Programa un buffer para que suene; llama a `onFin` cuando termina. */
  programar(muestras: Float32Array, rate: number, onFin: () => void): void;
  /** Corta lo que esté sonando. */
  detener(): void;
}

/**
 * Cola de reproducción incremental.
 *
 * INVARIANTES QUE SE GARANTIZAN AQUÍ:
 *  - UNA SOLA reproducción activa: los chunks se encadenan uno tras otro, nunca
 *    se solapan en el tiempo;
 *  - ORDEN correcto: FIFO por número de secuencia;
 *  - SIN repetir: se ignora cualquier secuencia ya aceptada (deduplicación);
 *  - `cancelar()`, `limpiar()` y `error()` VACÍAN la cola y detienen el audio.
 *
 * `turnComplete` NO corta el audio pendiente: el llamante debe esperar a
 * `esperarFin()` antes de dar el turno por terminado.
 */
export class ColaReproduccionPcm {
  private pendientes: Array<{ seq: number; muestras: Float32Array }> = [];
  private secuenciasVistas = new Set<number>();
  private reproduciendo = false;
  // Se asigna en `nuevaEspera()` (llamada desde el constructor): de ahí el `!`.
  private finalizada!: Promise<void>;
  private resolverFinal: (() => void) | null = null;
  /** ¿La espera actual ya se resolvió? (para no dar por finido un turno con audio nuevo) */
  private resuelta = false;

  constructor(private readonly programador: ProgramadorReproduccion) {
    this.nuevaEspera();
  }

  /** Crea una promesa de espera nueva (se usa al vaciarse y al reiniciarse). */
  private nuevaEspera(): void {
    this.resuelta = false;
    this.finalizada = new Promise((r) => {
      this.resolverFinal = () => {
        this.resuelta = true;
        r();
      };
    });
    this.finalizada.then(() => undefined, () => undefined);
  }

  get activa(): boolean {
    return this.reproduciendo;
  }
  get pendientesCount(): number {
    return this.pendientes.length;
  }
  get aceptados(): number {
    return this.secuenciasVistas.size;
  }

  /** Encola un chunk. `seq` permite detectar duplicados. */
  encolar(seq: number, bytes: Uint8Array): boolean {
    if (this.secuenciasVistas.has(seq)) return false; // duplicado -> se ignora
    this.secuenciasVistas.add(seq);
    this.pendientes.push({ seq, muestras: int16LEAFloat32(bytes) });
    this.arrancarSiHaceFalta();
    return true;
  }

  private arrancarSiHaceFalta(): void {
    if (this.reproduciendo) return;
    const siguiente = this.pendientes.shift();
    if (!siguiente) {
      this.resolverFinal?.();
      return;
    }
    this.reproduciendo = true;
    this.programador.programar(siguiente.muestras, RATE_SALIDA, () => {
      this.reproduciendo = false;
      // Encadena el siguiente SIN solapar: hasta que no acaba éste no empieza otro.
      this.arrancarSiHaceFalta();
    });
  }

  /**
   * Espera a que suene TODO lo encolado (lo usa `turnComplete`).
   *
   * OJO (defecto corregido): si la cola se vació una vez, la promesa quedaba
   * RESUELTA para siempre. Al llegar audio nuevo después (chunks que siguen
   * entrando tras un hueco), `esperarFin()` devolvía una promesa ya resuelta y el
   * turno se daba por terminado CON AUDIO TODAVÍA PENDIENTE: se volvía a
   * LISTENING con el altavoz sonando y el micrófono podía oír a Gemini.
   * Ahora, si hay audio nuevo tras haberse vaciado, se crea una espera NUEVA.
   */
  esperarFin(): Promise<void> {
    if (!this.reproduciendo && this.pendientes.length === 0) return Promise.resolve();
    if (this.resuelta) this.nuevaEspera();
    return this.finalizada;
  }

  /**
   * Fin de turno en escucha CONTINUA.
   *
   * Se olvidan las secuencias vistas para que el conjunto no crezca sin límite
   * durante una conversación larga. Es seguro porque la numeración es monótona
   * (nunca se reutiliza un número) y el servidor no reenvía chunks ya entregados.
   * NO toca el audio pendiente: si aún queda algo sonando, se respeta.
   */
  nuevoTurno(): void {
    this.secuenciasVistas.clear();
  }

  /** Corta y vacía (cancelar, cerrar socket, error). */
  limpiar(): void {
    this.pendientes = [];
    this.secuenciasVistas.clear();
    this.reproduciendo = false;
    try {
      this.programador.detener();
    } catch {
      /* el programador puede no estar disponible */
    }
    this.resolverFinal?.();
    this.nuevaEspera();
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Métricas de QA (sin guardar audio)
// ────────────────────────────────────────────────────────────────────────────

export interface MetricasPcm {
  connect_ms: number | null;
  setup_ms: number | null;
  first_audio_input_ms: number | null;
  first_audio_output_ms: number | null;
  turn_total_ms: number | null;
  input_chunks: number;
  output_chunks: number;
  underruns: number;
  reconnects: number;
  errorCode: string | null;
}

export function metricasVacias(): MetricasPcm {
  return {
    connect_ms: null,
    setup_ms: null,
    first_audio_input_ms: null,
    first_audio_output_ms: null,
    turn_total_ms: null,
    input_chunks: 0,
    output_chunks: 0,
    underruns: 0,
    reconnects: 0,
    errorCode: null,
  };
}
