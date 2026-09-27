/**
 * Voz 360 — ACUMULACIÓN Y CIERRE DE FRASE (núcleo puro)
 * ====================================================
 * Aquí vive el motivo por el que la escucha "corta" o "no corta" una frase.
 * Está fuera de la pantalla y de Android a propósito: así se prueba sin DOM,
 * sin micrófono y sin dispositivo.
 *
 * POR QUÉ ESTÁ HECHO ASÍ (corte prematuro real en el POCO)
 * -------------------------------------------------------
 * 1. RECONSTRUCCIÓN IDEMPOTENTE. La lista de resultados del motor es acumulativa
 *    dentro de una sesión. Se recalcula la transcripción ENTERA desde esa lista
 *    en cada evento, en vez de ir concatenando deltas: así es imposible duplicar
 *    texto ya cerrado (el fallo clásico "partial + final repetidos").
 *
 * 2. VENTANA DE SILENCIO QUE SE REINICIA CON CADA TROZO NUEVO. Cualquier parcial
 *    o segmento nuevo mueve `lastSpeechAt`. Una pausa natural a mitad de frase
 *    (hasta ~3 s) ya no la da por terminada.
 *
 * 3. NO SE CIERRA POR SILENCIO SI NO SE HA OÍDO NADA (`hasSpeech`). Antes el
 *    cierre por silencio podía dispararse sin contenido y gastar el turno.
 *
 * 4. SE UNE LO ACUMULADO ENTRE REINICIOS DEL MOTOR. En Android el
 *    SpeechRecognizer y en Chrome la sesión se cierran solos; cada reinicio trae
 *    su propia lista de resultados. `mergeUtterances` conserva lo anterior y
 *    descarta solo la repetición completa que algunos motores reemiten.
 *
 * 5. EL CIERRE LO DECIDE UN "LATIDO" PERIÓDICO, no un temporizador de un solo
 *    uso que se puede perder si el motor reinicia por el medio.
 *
 * Nada de aquí conoce presupuestos ni intenciones: es solo voz.
 */

/** Trozo de reconocimiento tal como lo entrega el motor (Web Speech o Android). */
export interface SpeechChunk {
  transcript: string;
  isFinal: boolean;
}

/** Transcripción en curso: segmentos ya cerrados por el motor + hipótesis provisional. */
export interface Utterance {
  segments: readonly string[];
  interim: string;
}

export const EMPTY_UTTERANCE: Utterance = { segments: [], interim: "" };

/**
 * Ventana de silencio antes de dar la frase por terminada.
 * El usuario pide tolerar pausas naturales de hasta ~3 s al dictar.
 */
export const END_OF_SPEECH_SILENCE_MS = 3000;

/**
 * Duración mínima de la intervención: por debajo de esto no se cierra por
 * silencio, aunque el motor ya haya entregado algo.
 */
export const MIN_UTTERANCE_MS = 1200;

/** Tope de seguridad de una misma escucha: cubre frases dictadas de 20-30 s. */
export const MAX_UTTERANCE_MS = 60000;

/** Periodo del latido que decide el cierre. */
export const HEARTBEAT_MS = 250;

/** Reinicios del motor tolerados antes de cerrar por tope. */
export const MAX_RESTARTS = 40;

/** Errores transitorios: NO cierran la sesión, solo se ignoran. */
export const IGNORED_ERRORS: ReadonlySet<string> = new Set(["no-speech", "aborted"]);

const normalize = (value: string | undefined): string => (value ?? "").replace(/\s+/g, " ").trim();

/**
 * Reconstruye la transcripción a partir de la lista COMPLETA de resultados.
 * Recalcular de cero es idempotente y hace imposible duplicar texto ya cerrado.
 */
export function utteranceFromResults(results: readonly SpeechChunk[]): Utterance {
  const segments: string[] = [];
  let interim = "";

  for (const result of results) {
    const text = normalize(result?.transcript);
    if (!text) continue;
    if (result.isFinal) {
      segments.push(text);
      interim = "";
    } else {
      // Las hipótesis provisionales se REEMPLAZAN, nunca se concatenan.
      interim = text;
    }
  }

  return segments.length === 0 && interim === "" ? EMPTY_UTTERANCE : { segments, interim };
}

export const committedText = (utterance: Utterance): string => normalize(utterance.segments.join(" "));

/** Lo que se muestra al usuario: lo cerrado más la hipótesis provisional. */
export const displayText = (utterance: Utterance): string =>
  normalize([committedText(utterance), normalize(utterance.interim)].filter(Boolean).join(" "));

export const isEmptyUtterance = (utterance: Utterance): boolean => displayText(utterance).length === 0;

/**
 * Texto que se procesa al cerrar la frase. Si el motor nunca llegó a cerrar un
 * segmento se usa la última hipótesis: no se pierde lo que se acaba de decir.
 */
export const finalUtteranceText = (utterance: Utterance): string =>
  committedText(utterance) || normalize(utterance.interim);

/**
 * Une lo acumulado antes de un reinicio con lo de la sesión nueva.
 * El reconocimiento se reinicia solo (sobre todo en móvil) y cada reinicio trae
 * su propia lista de resultados.
 */
export function mergeUtterances(base: Utterance, extra: Utterance): Utterance {
  const baseCommitted = committedText(base).toLowerCase();
  const extraCommitted = committedText(extra).toLowerCase();

  // Guarda anti-duplicado: algunos motores reemiten el texto ya cerrado al
  // reiniciarse. Se descarta solo la repetición completa.
  const repeated =
    baseCommitted.length > 0 &&
    extraCommitted.length > 0 &&
    (extraCommitted === baseCommitted || baseCommitted.endsWith(extraCommitted));

  const segments = repeated ? [...base.segments] : [...base.segments, ...extra.segments];
  const extraHasContent = extra.segments.length > 0 || extra.interim !== "";
  const interim = extraHasContent ? extra.interim : base.interim;

  if (segments.length === base.segments.length && interim === base.interim) return base;
  return { segments, interim };
}

export type FinalizeReason = "silence" | "timeout";

export interface FinalizeInput {
  /** Milisegundos desde el último trozo de voz reconocido. */
  sinceLastSpeechMs: number;
  /** Milisegundos desde que arrancó la escucha. */
  sinceStartMs: number;
  /** Si ya se ha reconocido algo en esta escucha. */
  hasSpeech: boolean;
}

/**
 * Decide si hay que cerrar la frase y con qué motivo.
 *
 * - `silence`: el usuario ha terminado de hablar (ventana cumplida).
 * - `timeout`: se alcanzó el tope de escucha.
 * - `null`: seguir escuchando.
 */
export function finalizeReason(input: FinalizeInput): FinalizeReason | null {
  const sinceLastSpeechMs = Math.max(0, input.sinceLastSpeechMs);
  const sinceStartMs = Math.max(0, input.sinceStartMs);

  // Sin nada reconocido todavía: no se cierra por silencio, solo por tope.
  if (!input.hasSpeech) {
    return sinceStartMs >= MAX_UTTERANCE_MS ? "timeout" : null;
  }

  // Suelo de intervención: no se da por terminada una frase recién empezada.
  if (sinceStartMs < MIN_UTTERANCE_MS) return null;

  if (sinceLastSpeechMs >= END_OF_SPEECH_SILENCE_MS) return "silence";
  if (sinceStartMs >= MAX_UTTERANCE_MS) return "timeout";
  return null;
}
