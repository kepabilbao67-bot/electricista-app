/**
 * UtteranceEndpointer — cierre de turno por pausa natural para Voz 360.
 *
 * Núcleo reutilizable (Web / Next / Capacitor). No depende de React ni del DOM,
 * por lo que puede usarse tanto en la UI web como en el shell Android.
 *
 * PROBLEMA QUE RESUELVE
 *   `SpeechRecognition` con `continuous = false` cierra el reconocimiento en la
 *   primera pausa corta, y quien consume `onresult` enviaba el mensaje con el
 *   PRIMER resultado final. Consecuencia: la frase se corta a mitad y se procesa
 *   antes de que el usuario termine de hablar.
 *
 * SOLUCIÓN
 *   - Acumula los segmentos finales que pertenecen a la MISMA intervención.
 *   - Reinicia un temporizador de silencio con CADA actividad de voz, de modo
 *     que cualquier pausa inferior a `silenceMs` mantiene el turno abierto.
 *   - Solo cierra el turno (onCommit) cuando el hablante calla `silenceMs`.
 *   - `flush()` permite cerrar explícitamente (botón de micrófono, fin de sesión).
 *   - `maxUtteranceMs` evita que un micrófono abierto retenga el turno sin fin.
 */

export interface UtteranceEndpointerConfig {
  /** Pausa natural tolerada antes de cerrar el turno, en ms. */
  silenceMs?: number;
  /** Longitud mínima del texto para no cerrar turnos vacíos o ruido. */
  minChars?: number;
  /** Tope de seguridad para una misma intervención, en ms. */
  maxUtteranceMs?: number;
  /**
   * Duración mínima de la intervención. Aunque se detecte silencio, no se cierra
   * el turno antes de este tiempo: evita cerrar en el hueco que el motor inserta
   * justo al empezar a hablar. Garantiza que «hablar con calma» nunca se corte
   * por arrancar despacio.
   */
  minUtteranceMs?: number;
}

export interface UtteranceEndpointerCallbacks {
  /** Texto parcial en vivo (segmentos finales acumulados + interino actual). */
  onInterim?: (text: string) => void;
  /** Turno cerrado: texto definitivo, listo para enviar. */
  onCommit: (text: string) => void;
}

/** Inyectable para poder probar el comportamiento temporal de forma determinista. */
export interface UtteranceEndpointerDeps {
  setTimeout?: (handler: () => void, ms: number) => unknown;
  clearTimeout?: (handle: unknown) => void;
  now?: () => number;
}

export const DEFAULT_UTTERANCE_CONFIG: Required<UtteranceEndpointerConfig> = {
  // Una pausa natural al pensar una frase dura del orden de 1–2,5 s, y al
  // dictar un presupuesto (cliente, horas, precio, partidas) se hacen varias.
  // Chrome/Android cierra por su cuenta antes (~0,7–1 s), así que el umbral
  // debe quedar por ENCIMA del rango de pausa natural, no dentro: con 1800 ms
  // una pausa de 2 s partía la frase en varios envíos (corte prematuro
  // reproducido). 3000 ms tolera la pausa natural y sigue cerrando en cuanto
  // el hablante calla de verdad.
  silenceMs: 3000,
  minChars: 2,
  // Tope por intervención: cubre de sobra una frase dictada de 15–30 s y evita
  // que un micrófono abierto retenga el turno indefinidamente.
  maxUtteranceMs: 60000,
  // Suelo de la intervención: por debajo de esto no se cierra por silencio.
  minUtteranceMs: 1200,
};

function normalize(text: string): string {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

export class UtteranceEndpointer {
  private config: Required<UtteranceEndpointerConfig>;
  private callbacks: UtteranceEndpointerCallbacks;
  private deps: Required<UtteranceEndpointerDeps>;

  private finalSegments: string[] = [];
  private interimSegment = '';
  private silenceTimer: unknown = null;
  private maxTimer: unknown = null;
  private utteranceStartedAt = 0;
  private disposed = false;

  constructor(
    config: UtteranceEndpointerConfig = {},
    callbacks: UtteranceEndpointerCallbacks,
    deps: UtteranceEndpointerDeps = {}
  ) {
    this.config = { ...DEFAULT_UTTERANCE_CONFIG, ...config };
    this.callbacks = callbacks;
    this.deps = {
      setTimeout:
        deps.setTimeout ??
        ((handler, ms) => setTimeout(handler, ms) as unknown),
      clearTimeout:
        deps.clearTimeout ??
        ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)),
      now: deps.now ?? (() => Date.now()),
    };
  }

  /**
   * Registra un segmento del motor de reconocimiento.
   * Llamar con los resultados interinos Y con los finales.
   *
   * Solo la ACTIVIDAD REAL cuenta: un final nuevo (o su reemisión, que confirma
   * que el motor sigue en la misma locución) y un interino que APORTA TEXTO
   * NUEVO. Un interino idéntico reemitido no es habla nueva y no debe posponer
   * el cierre del turno indefinidamente.
   */
  pushSegment(text: string, isFinal: boolean): void {
    if (this.disposed) return;

    const clean = normalize(text);
    if (!clean) return;

    if (isFinal) {
      // Chrome puede reemitir un final idéntico: no duplicar el texto, pero sí
      // contar como actividad (la locución sigue viva).
      if (this.finalSegments[this.finalSegments.length - 1] !== clean) {
        this.finalSegments.push(clean);
      }
      this.interimSegment = '';
      this.noteActivity();
      return;
    }

    const changed = clean !== this.interimSegment;
    this.interimSegment = clean;
    if (changed) {
      this.callbacks.onInterim?.(this.getPendingText());
      this.noteActivity();
    }
  }

  /**
   * Señal de actividad de voz sin texto nuevo (onspeechstart / onaudiostart).
   * Mantiene el turno abierto mientras el hablante sigue emitiendo sonido,
   * incluso antes de que el motor entregue el primer texto.
   */
  touch(): void {
    if (this.disposed) return;
    this.noteActivity();
  }

  /** Cierra el turno de inmediato. Devuelve el texto enviado, o null si no había nada válido. */
  flush(): string | null {
    if (this.disposed) return null;
    if (!this.hasPending()) {
      this.clearTimers();
      return null;
    }
    return this.commit();
  }

  /** Descarta el turno en curso sin enviarlo. */
  reset(): void {
    this.clearTimers();
    this.finalSegments = [];
    this.interimSegment = '';
    this.utteranceStartedAt = 0;
  }

  hasPending(): boolean {
    return this.finalSegments.length > 0 || this.interimSegment.length > 0;
  }

  getPendingText(): string {
    return normalize(
      [...this.finalSegments, this.interimSegment].filter(Boolean).join(' ')
    );
  }

  getConfig(): Required<UtteranceEndpointerConfig> {
    return { ...this.config };
  }

  dispose(): void {
    this.disposed = true;
    this.reset();
  }

  /**
   * Registra actividad real de voz/texto.
   *
   * Criterio de finalización (multicriterio, NO solo `silenceMs`):
   *  1. silencio acumulado >= `silenceMs` DESDE la última actividad;
   *  2. Y la intervención ya dura >= `minUtteranceMs`;
   *  3. salvo tope absoluto `maxUtteranceMs`, que cierra sí o sí;
   *  4. `flush()` cierra a mano (botón Detener) y `reset()` cancela.
   */
  private noteActivity(): void {
    if (this.utteranceStartedAt === 0) {
      this.utteranceStartedAt = this.deps.now();
    }

    // Silencio: se reinicia con cada actividad -> tolera pausas naturales.
    if (this.silenceTimer !== null) {
      this.deps.clearTimeout(this.silenceTimer);
    }
    this.silenceTimer = this.deps.setTimeout(() => {
      this.silenceTimer = null;
      this.onSilenceElapsed();
    }, this.config.silenceMs);

    // Tope absoluto: se arma una sola vez por intervención.
    if (this.maxTimer === null) {
      this.maxTimer = this.deps.setTimeout(() => {
        this.maxTimer = null;
        this.commit();
      }, this.config.maxUtteranceMs);
    }
  }

  /**
   * El silencio venció. Solo se cierra si hay algo que enviar y la intervención
   * ya superó la duración mínima; si es demasiado pronto, se espera lo que falta
   * en lugar de cortar al hablante.
   */
  private onSilenceElapsed(): void {
    if (this.disposed) return;
    if (!this.hasPending()) return;

    const elapsed = this.deps.now() - this.utteranceStartedAt;
    const remaining = this.config.minUtteranceMs - elapsed;

    if (remaining > 0) {
      this.silenceTimer = this.deps.setTimeout(() => {
        this.silenceTimer = null;
        this.onSilenceElapsed();
      }, remaining);
      return;
    }

    this.commit();
  }

  private clearTimers(): void {
    if (this.silenceTimer !== null) {
      this.deps.clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.maxTimer !== null) {
      this.deps.clearTimeout(this.maxTimer);
      this.maxTimer = null;
    }
  }

  private commit(): string | null {
    const text = this.getPendingText();
    this.clearTimers();
    this.finalSegments = [];
    this.interimSegment = '';
    this.utteranceStartedAt = 0;

    if (text.length < this.config.minChars) return null;

    this.callbacks.onCommit(text);
    return text;
  }
}
