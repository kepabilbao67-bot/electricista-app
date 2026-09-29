"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, AlertCircle, X } from "lucide-react";
import { BargeInManager } from "@/lib/assistant/barge-in-manager";
import { Voz360SttSession } from "@/lib/assistant/voz360-audio-core";
import {
  EMPTY_UTTERANCE,
  HEARTBEAT_MS,
  MAX_RESTARTS,
  displayText,
  finalizeReason,
  finalUtteranceText,
  isEmptyUtterance,
  mergeUtterances,
  utteranceFromResults,
  type FinalizeReason,
  type Utterance,
} from "@/packages/voz360-client-sdk/utterance";

interface VoiceDictationProps {
  onTranscriptComplete: (text: string) => void;
  className?: string;
  language?: string;
  disabled?: boolean;
  /**
   * Se llama justo antes de empezar a escuchar. La usa Voz 360 para cortar la
   * respuesta hablada (TTS) en curso: si el usuario vuelve a hablar, la voz del
   * asistente se interrumpe en el acto en lugar de solaparse.
   */
  onListeningStart?: () => void;
  /** Se llama cuando el micrófono deja de escuchar (por cualquier motivo). */
  onListeningEnd?: () => void;
  /**
   * Se llama cuando el dictado FALLA (permiso, motor sin respuesta, error del
   * reconocedor). El consumidor (Voz 360) lo usa para llevar el ciclo de voz a
   * ERROR y devolverlo a IDLE: así el micrófono vuelve a estar disponible.
   */
  onError?: (mensaje: string) => void;
  /**
   * PETICIÓN EXTERNA DE ESCUCHA (conversación continua / manos libres).
   *
   * Cada VEZ QUE ESTE NÚMERO SUBE se arranca una escucha nueva, igual que si el
   * usuario pulsara Dictar. Lo usa /asistente para volver a escuchar solo cuando
   * termina la respuesta hablada, que es lo que convierte el dictado en una
   * conversación: hablar → reconocer → actuar → responder hablando → volver a
   * escuchar, sin tocar la pantalla.
   *
   * Es OPCIONAL y ADITIVO: sin esta prop el componente se comporta exactamente
   * como antes (nadie más lo usa). Si ya hay una escucha viva, la petición se
   * ignora en vez de reiniciar el micrófono (nunca dos escuchas a la vez).
   */
  escuchaSolicitada?: number;
}

/**
 * Modo de dictado realmente disponible:
 *  - "native":   puente Android (window.AndroidSTT) → reconocedor del teléfono.
 *  - "web":      Web Speech API (navegador).
 *  - "fallback": MediaRecorder + /api/asistente/transcribe (servidor).
 *  - "none":     no hay NINGUNA vía (ni puente, ni Web Speech, ni micrófono):
 *                se avisa en pantalla, NO se simula éxito.
 *
 * POR QUÉ EXISTE EL MODO "fallback" (fallo real corregido)
 * Antes, si el navegador no exponía la Web Speech API —o la exponía y fallaba con
 * "network", "service-not-allowed" o "not-allowed" (lo normal en móvil: el
 * servicio de voz de Google no está disponible, o el WebView no lo permite)— el
 * botón Dictar se quedaba SIN hacer nada útil: sólo un mensaje de error, sin texto
 * y sin forma de dictar. El usuario pulsaba, hablaba y no aparecía nada.
 *
 * Ahora, en cualquiera de esos casos se pasa AUTOMÁTICAMENTE a grabar con
 * MediaRecorder y se transcribe en el servidor (`/api/asistente/transcribe`). La
 * clave del proveedor vive SOLO en el servidor: el navegador nunca la ve.
 *
 * CONTEXTO SEGURO
 * El navegador solo permite el micrófono en contextos seguros (https, localhost o
 * 127.0.0.1). Servida por http://IP-de-LAN la página NO es contexto seguro y no
 * hay getUserMedia: ahí sólo puede dictarse por el puente nativo (APK) o con el
 * teclado, y se dice claramente.
 */
type SttMode = "native" | "web" | "fallback" | "none";

const SIN_MOTOR_TEXTO = "Dictado no disponible aquí";
const SIN_MOTOR_TITULO =
  "Este navegador no expone micrófono ni reconocimiento de voz. " +
  "Escribe la orden con el teclado.";

/** Traduce los códigos de error de la Web Speech API a algo legible. */
const ERRORES_WEB: Record<string, string> = {
  "service-not-allowed": "El navegador no permite el dictado en este origen",
  "audio-capture": "No se detecta micrófono",
  network: "Sin conexión con el servicio de dictado",
};

/** Errores sin sentido reintentar: se para y se informa. */
const ERRORES_FATALES = new Set(["not-allowed", "service-not-allowed", "audio-capture"]);

/**
 * ERRORES DE LA WEB SPEECH API QUE ACTIVAN EL FALLA AUTOMÁTICO.
 *
 * `network` incluido: es el más habitual en móvil cuando el servicio de voz no
 * está disponible, y antes dejaba al usuario sin ninguna vía.
 */
const ERRORES_QUE_PASAN_A_FALLBACK = new Set([
  "not-allowed",
  "service-not-allowed",
  "network",
  "audio-capture",
  "language-not-supported",
]);

/** Arranque de la Web Speech API: si no da señales en este tiempo, está colgada. */
const ESPERA_ARRANQUE_WEB_MS = 2500;
/**
 * Tope de grabación del fallback. Corta solo: en el móvil el usuario puede no
 * volver a pulsar "Detener", y sin tope el micrófono quedaría tomado para siempre.
 */
const MAX_GRABACION_MS = 20000;
/**
 * Si tras este tiempo grabando NO se ha detectado voz (energía), se corta y se
 * avisa de que no se ha oído nada: no se manda un audio vacío al servidor.
 */
const ESPERA_VOZ_FALLBACK_MS = 6000;
/** Umbral de energía (RMS sobre [-1,1]) para considerar que hay voz. */
const UMBRAL_VOZ_FALLBACK = 0.012;
/**
 * TOPE DE LA TRANSCRIPCIÓN (autocuración del ciclo de dictado).
 *
 * Si el servidor no contesta (radio caída, túnel muerto, proveedor colgado),
 * `fetch` puede quedarse esperando indefinidamente. Sin tope, el estado se quedaba
 * en "transcribiendo" con el botón Dictar DESHABILITADO para siempre: había que
 * recargar la aplicación. Con el tope, la sesión se libera y se puede volver a
 * dictar inmediatamente.
 *
 * El valor cubre el peor caso REAL del servidor: proveedor de OpenAI (petición +
 * reintento) → modelo principal de Google (petición + reintento) → modelo de
 * reserva (una sola petición). Medido: ~2-3 s por intento, así que 25 s deja
 * margen y sigue siendo un tope acotado: el usuario ve "no se ha podido", nunca un
 * botón muerto.
 */
const TIMEOUT_TRANSCRIPCION_MS = 25000;
/**
 * Red de seguridad del cierre de la grabación: si `MediaRecorder.onstop` no llega
 * (recorder atascado en "stopping"), el ciclo se cierra igual y el botón no queda
 * muerto en "Detener".
 */
const ESPERA_CIERRE_GRABACION_MS = 1500;
/** Estados de la grabación del fallback, para poder informar en pantalla. */
type FaseFallback = "idle" | "grabando" | "transcribiendo";

const FALLBACK_GRABANDO_TEXTO = "Grabando… habla y pulsa Detener";
const FALLBACK_TRANSCRIBIENDO_TEXTO = "Transcribiendo…";
const FALLBACK_SIN_VOZ_TEXTO =
  "No se ha oído nada. Acércate al micrófono y vuelve a pulsar Dictar, o escribe la orden en el cuadro de texto.";
const FALLBACK_SIN_SERVIDOR_TEXTO =
  "El dictado por voz no está disponible en el servidor. Escribe la orden en el cuadro de texto.";
const FALLBACK_FALLO_TEXTO =
  "No se pudo transcribir el audio. Vuelve a pulsar Dictar o escribe la orden en el cuadro de texto.";

/**
 * Mensajes del puente nativo (NativeStt.java). El puente entrega en `text` un
 * mensaje ya redactado en español, así que el texto del puente MANDA y estos
 * valores son el respaldo cuando llega vacío: nunca se falla en silencio.
 */
const PERMISO_DENEGADO_TEXTO =
  "Permiso de micrófono denegado. Actívalo en Ajustes → Aplicaciones → " +
  "Electricista 360 → Permisos → Micrófono. Puedes escribir la orden con el teclado.";
const ERROR_VOZ_TEXTO = "No se pudo reconocer la voz.";
const SIN_TEXTO_TEXTO = "No se ha reconocido nada. Pulsa el micrófono y habla, o escribe la orden.";
/** Cola común: el teclado es SIEMPRE la salida, y hay que decirla. */
const TECLADO_TEXTO = "Puedes escribirlo en el cuadro de texto.";

/**
 * Red de seguridad del cierre nativo: el puente entrega el último segmento y
 * emite "stopped"; si no contesta (reconocedor que se queda mudo), el turno se
 * cierra igualmente con lo acumulado. Nunca puede duplicar la entrega: el cierre
 * es idempotente (`entregaHechaRef`).
 */
const ESPERA_CIERRE_NATIVO_MS = 2000;

/** ¿La página se sirve por un origen que el navegador considera no seguro? */
function origenNoSeguro(): boolean {
  return typeof window !== "undefined" && window.isSecureContext === false;
}

/** Mensaje claro y accionable cuando el navegador bloquea el micrófono. */
function mensajeMicrofonoBloqueado(): string {
  if (origenNoSeguro()) {
    return (
      "El navegador bloquea el micrófono: esta página no es segura (HTTP por IP). " +
      "Abre la app instalada, o entra por localhost o https."
    );
  }
  if (typeof navigator === "undefined" || !navigator.mediaDevices) {
    return "Este navegador no expone el micrófono en este origen.";
  }
  return "Permiso de micrófono denegado. Actívalo en los permisos del navegador.";
}

export default function VoiceDictation({
  onTranscriptComplete,
  className = "",
  language = "es-ES",
  disabled = false,
  onListeningStart,
  onListeningEnd,
  onError,
  escuchaSolicitada,
}: VoiceDictationProps) {
  const [isListening, setIsListening] = useState(false);
  // Valor inicial neutro para no romper la hidratación: el modo real se resuelve
  // en el cliente, dentro de useEffect (nunca durante el render del servidor).
  const [mode, setMode] = useState<SttMode>("web");
  const [error, setError] = useState<string | null>(null);
  /** Texto reconocido que se va mostrando mientras se habla. */
  const [preview, setPreview] = useState("");
  /** Estado de la grabación del fallback (para informar en pantalla). */
  const [faseFallback, setFaseFallback] = useState<FaseFallback>("idle");

  const reconocimientoRef = useRef<any>(null);
  const modoRef = useRef<SttMode>("web");
  /** Error irrecuperable: no se reintenta ni se reconecta. */
  const errorFatalRef = useRef(false);
  /**
   * ¿Ya se ha intentado el fallback en ESTA pulsación?
   *
   * Evita el bucle "Web Speech falla → fallback → falla → fallback": el fallback se
   * intenta UNA vez por dictado y, si tampoco puede, se informa y se para.
   */
  const fallbackIntentadoRef = useRef(false);
  /** ¿Está el dictado de fallback VIVO ahora mismo? (grabando o transcribiendo). */
  const fallbackActivoRef = useRef(false);
  /** Recursos de la grabación de fallback (se liberan SIEMPRE al terminar). */
  const grabacionRef = useRef<{
    recorder: MediaRecorder | null;
    stream: MediaStream | null;
    chunks: Blob[];
    contexto: AudioContext | null;
    analizador: AnalyserNode | null;
    fuente: MediaStreamAudioSourceNode | null;
    watchdog: number | null;
    tope: number | null;
    /** Red de seguridad del cierre de la grabación (si `onstop` no llega). */
    timerCierre: number | null;
    /**
     * Token de la sesión de grabación. Cada arranque lo sube y `liberarGrabacion`
     * también: así un arranque que siga en vuelo (esperando el permiso del
     * micrófono) no puede resucitar por encima de un cierre o de un dictado nuevo.
     */
    id: number;
    huboVoz: boolean;
    parando: boolean;
  }>({
    recorder: null,
    stream: null,
    chunks: [],
    contexto: null,
    analizador: null,
    fuente: null,
    watchdog: null,
    tope: null,
    timerCierre: null,
    id: 0,
    huboVoz: false,
    parando: false,
  });
  /** Watchdog de arranque de la Web Speech API (detecta el motor colgado). */
  const watchdogArranqueWebRef = useRef<number | null>(null);
  /**
   * ¿Cuántos turnos seguidos ha cerrado el motor de NAVEGADOR sin una sola palabra?
   *
   * Distingue dos casos que desde fuera parecen el mismo: "el usuario no ha hablado"
   * (normal) y "el motor está MUDO" (arranca, no devuelve resultados y no da error,
   * que es lo que se ha medido en un Chrome sin servicio de voz). En el segundo
   * caso, insistir con el mismo motor deja el dictado inservible para siempre, así
   * que la PULSACIÓN SIGUIENTE usa la grabación de servidor. Con voz reconocida el
   * contador se pone a cero: un turno bueno demuestra que el motor sirve.
   */
  const turnosWebSinTextoRef = useRef(0);
  /**
   * Texto ya ENTREGADO en este dictado: la entrega es IDEMPOTENTE.
   *
   * Un turno puede terminar por varios caminos a la vez (Detener, latido, cierre
   * del motor, respuesta tardía del puente nativo). Sin esta marca, el mismo texto
   * podía entregarse dos veces y acabar DUPLICADO en el campo de texto.
   */
  const entregaHechaRef = useRef(false);
  /**
   * El usuario ha pulsado Cancelar: se descarta TODO, incluso lo que llegue tarde.
   * Sin esta marca, un `onend`/`stopped` posterior a Cancelar volvía a entregar
   * texto que el usuario había descartado.
   */
  const descartadoRef = useRef(false);
  /** Red de seguridad del cierre nativo (ver programarCierreNativoForzado). */
  const temporizadorCierreNativoRef = useRef<number | null>(null);
  /** Detector de energía del módulo BargeInManager (complemento del aviso nativo). */
  const bargeInRef = useRef<BargeInManager | null>(null);
  const bargeInStreamRef = useRef<MediaStream | null>(null);
  /** Callback vigente, para no re-registrar el canal de eventos en cada render. */
  const onTranscriptRef = useRef(onTranscriptComplete);
  onTranscriptRef.current = onTranscriptComplete;
  /** Callback de inicio de escucha (corta el TTS en curso). */
  const onListeningStartRef = useRef(onListeningStart);
  onListeningStartRef.current = onListeningStart;
  /** Callback de fin de escucha (para el estado de la pantalla). */
  const onListeningEndRef = useRef(onListeningEnd);
  onListeningEndRef.current = onListeningEnd;
  /** Callback de error del dictado (lleva el ciclo de voz a ERROR). */
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  /**
   * ==========================================================================
   * ESTADO DE LA ESCUCHA NATIVA (Android) — AUTORIDAD: NÚCLEO DE AUDIO (P0-1)
   * ==========================================================================
   * El reconocedor de Android cierra la locución en cuanto detecta una pausa
   * aunque el usuario siga hablando. Por eso:
   *
   *  - Un `final` del puente es un SEGMENTO cerrado, NO el fin del turno: se
   *    MERGE en `actual` (`mergeUtterances`) y la escucha continúa.
   *  - Un `partial` REEMPLAZA la hipótesis provisional (nunca se concatena).
   *  - `speechend` es una micro-pausa: NO cierra nada.
   *  - El turno lo cierra el LATIDO (`finalizeReason`) o el usuario (Detener):
   *    sólo entonces se entrega TODO lo acumulado, UNA sola vez.
   *
   * `base` guarda lo acumulado antes de un reinicio del motor (el reconocedor
   * reemite su propia lista de resultados al reanudarse).
   *
   * El CICLO de esta sesión (arranque, sesión colgada, confirmación del puente,
   * cierre idempotente y temporizadores) NO se lleva a mano aquí: lo gobierna
   * `Voz360SttSession` (núcleo de audio), que es lo que se prueba con los 10
   * ciclos. Las banderas se conservan con el MISMO nombre (`activo`,
   * `finalizado`, `base`, `actual`, `latido`) para no cambiar el contrato.
   */
  const abortarArranqueRef = useRef<(() => void) | null>(null);
  const sttNativoRef = useRef<Voz360SttSession>(
    new Voz360SttSession(EMPTY_UTTERANCE, {
      // Si el puente no confirma el arranque, se corta el intento y se libera.
      onArranqueSinConfirmar: () => abortarArranqueRef.current?.(),
    })
  );

  /**
   * Estado de la escucha Web Speech (escritorio / PWA). Mismo criterio que la vía
   * nativa —se acumula, se reconstruye desde la lista completa de resultados y un
   * latido decide el cierre— para que las dos vías se comporten igual.
   */
  const wsRef = useRef<{
    base: Utterance;
    actual: Utterance;
    inicio: number;
    ultimaVoz: number;
    reinicios: number;
    sesionActiva: boolean;
    keepListening: boolean;
    finalizado: boolean;
    latido: number | null;
  }>({
    base: EMPTY_UTTERANCE,
    actual: EMPTY_UTTERANCE,
    inicio: 0,
    ultimaVoz: 0,
    reinicios: 0,
    sesionActiva: false,
    keepListening: false,
    finalizado: false,
    latido: null,
  });

  const puenteSttNativo = () =>
    typeof window !== "undefined" ? (window as any).AndroidSTT : null;

  /** Para el latido y los temporizadores de las dos vías. */
  function limpiarTemporizadores() {
    // El núcleo de audio limpia el latido nativo y su espera de confirmación.
    sttNativoRef.current.limpiarTemporizadores();
    const ws = wsRef.current;
    if (ws.latido !== null) {
      window.clearInterval(ws.latido);
      ws.latido = null;
    }
    if (temporizadorCierreNativoRef.current !== null) {
      window.clearTimeout(temporizadorCierreNativoRef.current);
      temporizadorCierreNativoRef.current = null;
    }
  }

  /**
   * Aborta el arranque nativo que nunca se confirmó.
   *
   * Lo dispara el watchdog del núcleo de audio (`Voz360SttSession`). `cancel()`
   * del puente libera el reconocedor DE VERDAD (en Java destruye la instancia),
   * así que este camino deja el micrófono listo para el siguiente intento en vez
   * de dejarlo colgado como antes.
   */
  function abortarArranqueSinConfirmar() {
    const n = sttNativoRef.current;
    if (n.arranqueConfirmado || n.finalizado || !n.activo) return;
    console.log("[VOZ360][STT] el puente no confirmó el arranque: se cancela y se libera");
    try {
      puenteSttNativo()?.cancel?.();
    } catch {
      /* el estado local se limpia igualmente */
    }
    cerrarSesionNativaSinEntrega();
    const mensaje = "El micrófono no respondió. Vuelve a pulsar Dictar o escribe la orden.";
    setError(mensaje);
    onErrorRef.current?.(mensaje);
    onListeningEndRef.current?.();
  }
  abortarArranqueRef.current = abortarArranqueSinConfirmar;

  /**
   * INTERRUPCIÓN DEL TTS (barge-in REAL): la voz del asistente se calla EN CUANTO
   * el usuario habla, no sólo al pulsar Dictar.
   *
   * El corte efectivo lo hace el consumidor en `onListeningStart` (en /asistente
   * llama a `speechSynthesis.cancel()`), así que se reutiliza ESE MISMO aviso, que
   * ya está cableado, en lugar de añadir otro canal. Es idempotente: avisar varias
   * veces no tiene ningún efecto secundario.
   *
   * Tres disparadores, del más fiable al complementario:
   *  1. NATIVO (cada `partial`/`final` del puente): es el ÚNICO que funciona en la
   *     APK, donde http://IP-de-LAN no es contexto seguro y por tanto no hay ni Web
   *     Speech API ni getUserMedia.
   *  2. WEB (`onspeechstart`/`onaudiostart` de la Web Speech API).
   *  3. ENERGÍA (`BargeInManager`, módulo que ya existía sin usarse): complemento
   *     para motores que no emiten `onspeechstart`.
   */
  function interrumpirTts() {
    try {
      onListeningStartRef.current?.();
    } catch {
      /* que el TTS falle nunca debe impedir dictar */
    }
  }

  /**
   * Activa el detector de energía del módulo BargeInManager sobre el micrófono.
   *
   * Sólo se intenta cuando el navegador YA tiene el permiso de micrófono concedido:
   * así no aparece un diálogo de permiso sorpresa encima del dictado, y en la APK
   * (origen http://IP) no se activa porque no existe getUserMedia: allí el barge-in
   * lo cubre el aviso nativo de voz nueva. Cualquier fallo se ignora: la energía es
   * un COMPLEMENTO, nunca un requisito para dictar.
   */
  async function activarBargeInPorEnergia() {
    if (bargeInRef.current || descartadoRef.current) return;
    try {
      const nav = typeof navigator === "undefined" ? undefined : navigator;
      const media = nav?.mediaDevices;
      if (!media?.getUserMedia) return;
      const permisos = (nav as unknown as { permissions?: { query?: (d: unknown) => Promise<{ state?: string }> } })
        .permissions;
      if (!permisos?.query) return;
      const estado = await permisos.query({ name: "microphone" });
      if (estado?.state !== "granted") return;
      const stream = await media.getUserMedia({ audio: true });
      const manager = new BargeInManager();
      await manager.initialize(stream);
      manager.onBargeIn(() => interrumpirTts());
      // Mientras se dicta, cualquier voz del usuario interrumpe al asistente.
      manager.startGeminiSpeech();
      manager.startMonitoring();
      bargeInRef.current = manager;
      bargeInStreamRef.current = stream;
    } catch (e) {
      console.log("[VOZ360][STT] barge-in por energía no disponible", e);
    }
  }

  /** Suelta el detector de energía y el micrófono que hubiera tomado. */
  function desactivarBargeInPorEnergia() {
    const manager = bargeInRef.current;
    bargeInRef.current = null;
    if (manager) {
      try {
        manager.cleanup();
      } catch {
        /* ignore */
      }
    }
    try {
      bargeInStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    bargeInStreamRef.current = null;
  }

  /**
   * ==========================================================================
   * FALLBACK DE DICTADO: MediaRecorder → /api/asistente/transcribe
   * ==========================================================================
   * Es la vía que hace que "Dictar" funcione SIEMPRE:
   *
   *   - navegador sin Web Speech API (Firefox, muchos WebView, iOS antiguo),
   *   - Web Speech que responde "network" / "service-not-allowed" / "not-allowed",
   *   - Web Speech que se queda COLGADA sin dar ninguna señal.
   *
   * Se graba con MediaRecorder, se manda el audio al servidor y se escribe el
   * texto que devuelve. La clave del proveedor de voz NO sale del servidor: el
   * navegador sólo envía el audio a NUESTRA ruta y recibe `{ text }`.
   */

  /** ¿Puede este navegador grabar audio? (requisito del fallback) */
  function fallbackDisponible(): boolean {
    if (typeof window === "undefined") return false;
    const media = navigator?.mediaDevices;
    if (!media?.getUserMedia) return false;
    return typeof (window as unknown as { MediaRecorder?: unknown }).MediaRecorder === "function";
  }

  /** Traduce el error de `getUserMedia` a un mensaje claro y accionable. */
  function mensajeErrorMicrofono(causa: unknown): string {
    const nombre = causa instanceof Error ? causa.name : String(causa);
    if (nombre === "NotAllowedError" || nombre === "SecurityError") {
      return mensajeMicrofonoBloqueado();
    }
    if (nombre === "NotFoundError" || nombre === "DevicesNotFoundError") {
      return "No se detecta ningún micrófono en el dispositivo. " + TECLADO_TEXTO;
    }
    return "No se pudo abrir el micrófono. " + TECLADO_TEXTO;
  }

  /** Libera SIEMPRE los recursos de la grabación: sin esto, el micro queda tomado. */
  function liberarGrabacion() {
    const g = grabacionRef.current;
    // Al liberar, la sesión de grabación queda INVALIDADA: cualquier arranque que
    // siga en vuelo (permiso del micrófono a medias) se descarta en vez de resucitar.
    g.id += 1;
    if (g.timerCierre !== null) {
      window.clearTimeout(g.timerCierre);
      g.timerCierre = null;
    }
    if (g.watchdog !== null) {
      window.clearInterval(g.watchdog);
      g.watchdog = null;
    }
    if (g.tope !== null) {
      window.clearTimeout(g.tope);
      g.tope = null;
    }
    try {
      g.fuente?.disconnect();
    } catch {
      /* ignore */
    }
    g.fuente = null;
    try {
      g.contexto?.close();
    } catch {
      /* ignore */
    }
    g.contexto = null;
    g.analizador = null;
    if (g.recorder) {
      g.recorder.ondataavailable = null;
      g.recorder.onstop = null;
      g.recorder.onerror = null;
      if (g.recorder.state !== "inactive") {
        try {
          g.recorder.stop();
        } catch {
          /* ignore */
        }
      }
    }
    g.recorder = null;
    if (g.stream) {
      for (const pista of g.stream.getTracks()) {
        try {
          pista.stop();
        } catch {
          /* ignore */
        }
      }
    }
    g.stream = null;
    g.chunks = [];
    g.parando = false;
    fallbackActivoRef.current = false;
    setFaseFallback("idle");
  }

  /** Cabecera WAV para PCM 16 bits mono. */
  function wavDesdeInt16(muestras: Int16Array, rate: number): ArrayBuffer {
    const datos = new Uint8Array(muestras.length * 2);
    const vista = new DataView(datos.buffer);
    for (let i = 0; i < muestras.length; i += 1) vista.setInt16(i * 2, muestras[i], true);
    const cabecera = new ArrayBuffer(44);
    const v = new DataView(cabecera);
    const texto = (pos: number, s: string) => {
      for (let i = 0; i < s.length; i += 1) v.setUint8(pos + i, s.charCodeAt(i));
    };
    texto(0, "RIFF");
    v.setUint32(4, 36 + datos.length, true);
    texto(8, "WAVE");
    texto(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); // PCM
    v.setUint16(22, 1, true); // mono
    v.setUint32(24, rate, true);
    v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    texto(36, "data");
    v.setUint32(40, datos.length, true);
    const salida = new Uint8Array(44 + datos.length);
    salida.set(new Uint8Array(cabecera), 0);
    salida.set(datos, 44);
    return salida.buffer;
  }

  /**
   * Convierte el audio grabado a WAV 16 kHz mono.
   *
   * POR QUÉ (comprobado contra la API real)
   * MediaRecorder entrega WebM/Opus. El proveedor de voz del servidor acepta WAV y
   * rechaza formato que no reconozca, así que se decodifica en el propio navegador
   * (WebAudio) y se reempaqueta: mismo audio, formato que entienden TODOS los
   * proveedores. Si la decodificación falla, se envía el audio original: el
   * dictado se intenta igual y no se pierde el turno.
   */
  async function convertirAWav16k(blob: Blob): Promise<Blob | null> {
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const contexto = new Ctor();
      const crudo = await blob.arrayBuffer();
      const audio = await contexto.decodeAudioData(crudo);
      const canales = audio.numberOfChannels;
      const n = audio.length;
      const mono = new Float32Array(n);
      for (let c = 0; c < canales; c += 1) {
        const datos = audio.getChannelData(c);
        for (let i = 0; i < n; i += 1) mono[i] += datos[i] / canales;
      }
      const destino = 16000;
      const total = Math.max(1, Math.floor((n * destino) / audio.sampleRate));
      const salida = new Int16Array(total);
      for (let i = 0; i < total; i += 1) {
        const pos = (i * audio.sampleRate) / destino;
        const i0 = Math.floor(pos);
        const i1 = Math.min(i0 + 1, n - 1);
        const f = pos - i0;
        const muestra = mono[i0] * (1 - f) + mono[i1] * f;
        salida[i] = Math.max(-1, Math.min(1, muestra)) * 32767;
      }
      try {
        void contexto.close();
      } catch {
        /* ignore */
      }
      return new Blob([wavDesdeInt16(salida, destino)], { type: "audio/wav" });
    } catch {
      return null;
    }
  }

  /** Manda el audio grabado al servidor y entrega el texto reconocido. */
  async function transcribirGrabacion(blob: Blob, huboVoz: boolean) {
    // Si el usuario canceló, se libera IGUAL: volver sin liberar dejaba la sesión
    // marcada como activa para siempre y el dictado no volvía a arrancar.
    if (descartadoRef.current) {
      liberarGrabacion();
      return;
    }
    setFaseFallback("transcribiendo");
    setPreview(FALLBACK_TRANSCRIBIENDO_TEXTO);
    // Tope duro de la transcripción: si el servidor no contesta, se aborta.
    let relojTranscripcion: number | null = null;
    try {
      // Se intenta enviar WAV (lo entienden todos los proveedores). Si no se puede
      // decodificar, se manda el audio original tal cual.
      const wav = await convertirAWav16k(blob);
      const audio = wav ?? blob;
      const nombre = wav
        ? "dictado.wav"
        : blob.type.includes("ogg")
          ? "dictado.ogg"
          : blob.type.includes("mp4")
            ? "dictado.mp4"
            : "dictado.webm";

      const formulario = new FormData();
      formulario.append("audio", audio, nombre);

      const controlador = new AbortController();
      relojTranscripcion = window.setTimeout(
        () => controlador.abort(),
        TIMEOUT_TRANSCRIPCION_MS
      );

      const respuesta = await fetch("/api/asistente/transcribe", {
        method: "POST",
        body: formulario,
        signal: controlador.signal,
      });
      const cuerpo = (await respuesta.json().catch(() => ({}))) as { text?: string; error?: string };

      if (!respuesta.ok) {
        // 422 = el servidor ha recibido audio pero no ha encontrado voz.
        if (respuesta.status === 422 || cuerpo.error === "STT_EMPTY") {
          setError(FALLBACK_SIN_VOZ_TEXTO);
          onErrorRef.current?.(FALLBACK_SIN_VOZ_TEXTO);
          return;
        }
        // 503: no hay proveedor de voz configurado en el servidor (no es culpa
        // del micrófono ni del usuario, y NO debe parecer un error interno).
        if (respuesta.status === 503 || cuerpo.error === "STT_NOT_CONFIGURED") {
          setError(FALLBACK_SIN_SERVIDOR_TEXTO);
          onErrorRef.current?.(FALLBACK_SIN_SERVIDOR_TEXTO);
          return;
        }
        setError(FALLBACK_FALLO_TEXTO);
        onErrorRef.current?.(FALLBACK_FALLO_TEXTO);
        return;
      }

      const texto = (cuerpo.text ?? "").trim();
      if (!texto) {
        setError(huboVoz ? FALLBACK_FALLO_TEXTO : FALLBACK_SIN_VOZ_TEXTO);
        onErrorRef.current?.(huboVoz ? FALLBACK_FALLO_TEXTO : FALLBACK_SIN_VOZ_TEXTO);
        return;
      }
      // Entrega ÚNICA (misma garantía que la vía nativa/web): nunca duplica.
      entregarTurno(texto);
    } catch {
      setError(FALLBACK_FALLO_TEXTO);
      onErrorRef.current?.(FALLBACK_FALLO_TEXTO);
    } finally {
      if (relojTranscripcion !== null) window.clearTimeout(relojTranscripcion);
      // SIEMPRE se libera: el ciclo queda reutilizable aunque el servidor falle,
      // tarde de más o el usuario ya se haya ido de la pantalla.
      liberarGrabacion();
    }
  }

  /**
   * Termina la grabación. `enviar = false` descarta el audio (Cancelar).
   *
   * Es IDEMPOTENTE: da igual si la llaman el usuario, el watchdog de silencio o el
   * tope de grabación; el audio se envía una sola vez.
   */
  function terminarGrabacion(enviar: boolean) {
    const g = grabacionRef.current;
    if (g.parando) return;
    g.parando = true;

    if (g.watchdog !== null) {
      window.clearInterval(g.watchdog);
      g.watchdog = null;
    }
    if (g.tope !== null) {
      window.clearTimeout(g.tope);
      g.tope = null;
    }

    const huboVoz = g.huboVoz;
    const recorder = g.recorder;

    // `cerrar` es IDEMPOTENTE: pueden concurrir el `onstop` del propio recorder y
    // la red de seguridad de abajo, y el audio sólo puede enviarse UNA vez.
    let cerrado = false;
    const cerrar = () => {
      if (cerrado) return;
      cerrado = true;
      if (g.timerCierre !== null) {
        window.clearTimeout(g.timerCierre);
        g.timerCierre = null;
      }
      const tipo = recorder?.mimeType || "audio/webm";
      const blob = new Blob(g.chunks, { type: tipo });
      // El micrófono se libera ANTES de transcribir: así nunca queda una pista
      // abierta mientras se espera al servidor y se puede volver a pulsar Dictar.
      const stream = g.stream;
      g.stream = null;
      if (stream) {
        for (const pista of stream.getTracks()) {
          try {
            pista.stop();
          } catch {
            /* ignore */
          }
        }
      }
      if (stream) {
        setIsListening(false);
        setPreview("");
        onListeningEndRef.current?.();
      }
      if (!enviar || descartadoRef.current) {
        liberarGrabacion();
        return;
      }
      if (!huboVoz) {
        // Silencio: no se manda audio vacío al servidor; se avisa y se libera.
        liberarGrabacion();
        setError(FALLBACK_SIN_VOZ_TEXTO);
        onErrorRef.current?.(FALLBACK_SIN_VOZ_TEXTO);
        return;
      }
      void transcribirGrabacion(blob, huboVoz);
    };

    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = cerrar;
      try {
        recorder.stop(); // dispara onstop → cerrar()
        // RED DE SEGURIDAD: si `onstop` no llega (recorder atascado en "stopping"),
        // el cierre ocurre igual. Sin esto el botón se quedaba en "Detener" y no se
        // podía volver a dictar sin recargar.
        if (g.timerCierre !== null) window.clearTimeout(g.timerCierre);
        g.timerCierre = window.setTimeout(() => {
          g.timerCierre = null;
          cerrar();
        }, ESPERA_CIERRE_GRABACION_MS);
        return;
      } catch {
        /* si no se puede parar, se cierra igualmente */
      }
    }
    cerrar();
  }

  /**
   * ARRANCA el dictado de fallback: graba hasta que el usuario pulse Detener (o
   * hasta el tope, o hasta detectar que no hay voz).
   */
  async function iniciarEscuchaFallback() {
    if (fallbackActivoRef.current) return;
    const g = grabacionRef.current;
    // Token de ESTA sesión de grabación: si mientras se pide el micrófono el usuario
    // cancela, para el dictado o arranca otro, este arranque queda invalidado.
    g.id += 1;
    const idSesion = g.id;
    fallbackActivoRef.current = true;
    fallbackIntentadoRef.current = true;
    descartadoRef.current = false;
    entregaHechaRef.current = false;
    // Estado limpio en CADA arranque: ningún residuo del ciclo anterior.
    errorFatalRef.current = false;
    setError(null);
    setPreview("");
    setIsListening(true);

    g.chunks = [];
    g.huboVoz = false;
    g.parando = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      // El usuario pudo cancelar —o cerrarse la sesión— mientras se pedía el permiso.
      // Si esta sesión ya no es la vigente, el arranque es FANTASMA: se sueltan las
      // pistas y NO se toca ningún estado (el del dictado en curso manda).
      if (descartadoRef.current || g.id !== idSesion) {
        for (const pista of stream.getTracks()) {
          try {
            pista.stop();
          } catch {
            /* ignore */
          }
        }
        return;
      }
      g.stream = stream;

      // Detector de voz por energía: distingue "no ha hablado" de "fallo del
      // servidor", que son dos mensajes distintos para el usuario.
      try {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const contexto = new Ctor();
        const fuente = contexto.createMediaStreamSource(stream);
        const analizador = contexto.createAnalyser();
        analizador.fftSize = 1024;
        fuente.connect(analizador);
        g.contexto = contexto;
        g.fuente = fuente;
        g.analizador = analizador;
      } catch {
        /* sin analizador el dictado sigue funcionando; sólo se pierde el aviso */
      }

      const tipoPreferido = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"]
        .find((t) => typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported(t));
      const recorder = tipoPreferido ? new MediaRecorder(stream, { mimeType: tipoPreferido }) : new MediaRecorder(stream);
      g.recorder = recorder;
      recorder.ondataavailable = (evento) => {
        if (evento.data && evento.data.size > 0) g.chunks.push(evento.data);
      };
      recorder.onerror = () => {
        terminarGrabacion(false);
        setError(FALLBACK_FALLO_TEXTO);
        onErrorRef.current?.(FALLBACK_FALLO_TEXTO);
      };
      recorder.start(250); // trozos de 250 ms: no se pierde el final de la frase

      setFaseFallback("grabando");
      setPreview(FALLBACK_GRABANDO_TEXTO);
      onListeningStartRef.current?.();

      // Vigilancia: (1) no ha hablado en N ms → corta y avisa; (2) tope duro.
      const datos = new Uint8Array(128);
      const inicio = Date.now();
      g.watchdog = window.setInterval(() => {
        const analizador = grabacionRef.current.analizador;
        if (analizador) {
          try {
            analizador.getByteTimeDomainData(datos);
            let suma = 0;
            for (let i = 0; i < datos.length; i += 1) {
              const v = (datos[i] - 128) / 128;
              suma += v * v;
            }
            if (Math.sqrt(suma / datos.length) > UMBRAL_VOZ_FALLBACK) {
              grabacionRef.current.huboVoz = true;
            }
          } catch {
            /* si el analizador falla, se asume que sí hubo voz */
            grabacionRef.current.huboVoz = true;
          }
        }
        const transcurrido = Date.now() - inicio;
        if (transcurrido > ESPERA_VOZ_FALLBACK_MS && !grabacionRef.current.huboVoz) {
          terminarGrabacion(true); // silencio: se cierra y se avisa
        }
      }, 250);
      g.tope = window.setTimeout(() => terminarGrabacion(true), MAX_GRABACION_MS);
    } catch (causa) {
      // Si la sesión ya no es la vigente (cancelada mientras se pedía el permiso),
      // este fallo pertenece a un arranque fantasma: no se pisa el estado actual.
      if (g.id !== idSesion) return;
      liberarGrabacion();
      setIsListening(false);
      const mensaje = mensajeErrorMicrofono(causa);
      setError(mensaje);
      onErrorRef.current?.(mensaje);
      onListeningEndRef.current?.();
    }
  }

  /**
   * ENTREGA ÚNICA del turno.
   *
   * Es el ÚNICO sitio del componente que llama a `onTranscriptComplete`, y sólo
   * ocurre cuando el turno TERMINA (latido, Detener o cierre del motor). Nunca se
   * entrega desde un parcial ni desde un segmento: eso era justo el corte
   * prematuro. `entregaHechaRef` la hace idempotente, de modo que da igual cuántos
   * caminos de cierre concurran.
   *
   * El texto llega ya fusionado por el SDK (`finalUtteranceText`), sin perder ni
   * duplicar palabras. Si no hay nada, NO se falla en silencio: se avisa y queda el
   * teclado.
   */
  function entregarTurno(texto: string) {
    if (entregaHechaRef.current || descartadoRef.current) return;
    entregaHechaRef.current = true;
    limpiarTemporizadores();
    desactivarBargeInPorEnergia();
    setPreview("");
    setIsListening(false);
    if (texto) {
      onTranscriptRef.current(texto);
    } else {
      setError(SIN_TEXTO_TEXTO);
    }
    onListeningEndRef.current?.();
  }

  /**
   * Cierra el turno nativo UNA sola vez y entrega TODO lo acumulado.
   *
   * Se llama cuando el latido decide (silencio real o tope), cuando el usuario
   * pulsa Detener (el puente emite "stopped") y cuando el motor da un error
   * habiendo texto útil. El micrófono se libera SIEMPRE antes de entregar, para no
   * seguir captando ni realimentar la respuesta hablada.
   */
  function cerrarTurnoNativo(motivo: FinalizeReason | "manual" | "detenido" | "error") {
    const n = sttNativoRef.current;
    // Entrega ÚNICA: el núcleo cierra una sola vez y este guardia lo deja escrito
    // en el propio cierre, por si concurren varios caminos (latido + Detener).
    if (n.finalizado) return;
    n.cerrar(motivo === "error" ? "error" : motivo === "detenido" ? "detenido" : "manual");
    limpiarTemporizadores();
    try {
      puenteSttNativo()?.stop();
    } catch {
      /* el micrófono se libera igualmente al marcar la sesión como cerrada */
    }
    n.activo = false;
    const dicho = finalUtteranceText(n.actual);
    n.actual = EMPTY_UTTERANCE;
    n.base = EMPTY_UTTERANCE;
    console.log("[VOZ360][STT] cierre nativo", { motivo, caracteres: dicho.length });
    entregarTurno(dicho);
  }

  /** Cierra la sesión nativa SIN entregar nada (permiso denegado, motor sin voz). */
  function cerrarSesionNativaSinEntrega() {
    const n = sttNativoRef.current;
    n.cerrar("cancelado");
    n.actual = EMPTY_UTTERANCE;
    n.base = EMPTY_UTTERANCE;
    limpiarTemporizadores();
    setPreview("");
    setIsListening(false);
  }

  /**
   * Red de seguridad de la parada suave: si el puente no llega a emitir "stopped",
   * el turno se cierra igual con lo acumulado. Con la respuesta normal del puente
   * este temporizador no llega a dispararse.
   */
  function programarCierreNativoForzado() {
    if (temporizadorCierreNativoRef.current !== null) {
      window.clearTimeout(temporizadorCierreNativoRef.current);
    }
    temporizadorCierreNativoRef.current = window.setTimeout(() => {
      temporizadorCierreNativoRef.current = null;
      // `cerrarTurnoNativo` ya sale sin hacer nada si el turno estaba cerrado.
      cerrarTurnoNativo("manual");
    }, ESPERA_CIERRE_NATIVO_MS);
  }

  /**
   * Latido del turno NATIVO: decide el cierre sin depender de un temporizador de un
   * solo uso (que se perdería si el motor reinicia por el medio).
   *
   * Nunca cierra en el primer parcial: `finalizeReason` exige el suelo de
   * intervención, no cierra por silencio si aún no se ha oído nada y sólo dispara
   * por silencio real o por tope.
   */
  function arrancarLatidoNativo() {
    const n = sttNativoRef.current;
    if (n.latido !== null) window.clearInterval(n.latido);
    n.latido = window.setInterval(() => {
      const s = sttNativoRef.current;
      if (!s.activo || s.finalizado) return;
      const ahora = Date.now();
      const razon = finalizeReason({
        sinceLastSpeechMs: ahora - s.ultimaVoz,
        sinceStartMs: ahora - s.inicio,
        hasSpeech: !isEmptyUtterance(s.actual),
      });
      if (!razon) return;
      cerrarTurnoNativo(razon);
    }, HEARTBEAT_MS);
  }

  /**
   * Rearma el turno nativo cuando el puente arranca POR SU CUENTA.
   *
   * Sólo ocurre tras conceder RECORD_AUDIO: `requestPermission()` deja marcado
   * `arranquePendiente` y, en cuanto el usuario concede, el puente llama a su
   * `start()` y emite `listening`. Sin rearmar aquí, ese arranque llegaría con la
   * sesión ya cerrada y el latido apagado, así que el turno no se cerraría solo
   * (habría que pulsar Detener a mano). Rearmar NO cambia el flujo normal: si el
   * turno está vivo, esta función no se llama.
   */
  function rearmarTrasPermiso() {
    const n = sttNativoRef.current;
    if (n.activo && !n.finalizado) return;
    descartadoRef.current = false;
    entregaHechaRef.current = false;
    // Una sesión nueva y limpia (el permiso se acaba de conceder y el puente ha
    // arrancado por su cuenta): mismo estado que un arranque manual.
    n.abrir();
    setError(null);
    setPreview("");
    arrancarLatidoNativo();
  }

  /** Cierra el turno de la vía NAVEGADOR con todo lo acumulado. */
  function cerrarTurnoWeb(motivo: FinalizeReason | "manual") {
    const ws = wsRef.current;
    if (ws.finalizado) return;
    ws.finalizado = true;
    ws.sesionActiva = false;
    ws.keepListening = false;
    desarmarWatchdogArranqueWeb();
    if (ws.latido !== null) {
      window.clearInterval(ws.latido);
      ws.latido = null;
    }
    const recognition = reconocimientoRef.current;
    reconocimientoRef.current = null;
    if (recognition) {
      try {
        recognition.onend = null;
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.stop();
      } catch {
        /* ignore */
      }
    }
    const dicho = finalUtteranceText(ws.actual);
    ws.actual = EMPTY_UTTERANCE;
    ws.base = EMPTY_UTTERANCE;
    // Un turno SIN una sola palabra puede significar que el motor está mudo: se
    // cuenta para que la pulsación siguiente grabe y transcriba en el servidor en
    // vez de volver a un motor que no entrega nada nunca.
    turnosWebSinTextoRef.current = dicho.length > 0 ? 0 : turnosWebSinTextoRef.current + 1;
    console.log("[VOZ360][STT] cierre web", { motivo, caracteres: dicho.length });
    entregarTurno(dicho);
  }

  /** Desarma el watchdog de arranque de la Web Speech API (motor colgado). */
  function desarmarWatchdogArranqueWeb() {
    if (watchdogArranqueWebRef.current !== null) {
      window.clearTimeout(watchdogArranqueWebRef.current);
      watchdogArranqueWebRef.current = null;
    }
  }

  /**
   * ==========================================================================
   * CANAL ÚNICO DE EVENTOS DEL PUENTE NATIVO
   * ==========================================================================
   * `window.__electricistaSttEvent({type, text})` con
   * type ∈ listening | partial | final | error | cancelled | stopped | permission |
   * speechend. La semántica es la del puente probado en el POCO; el detalle está
   * en cada rama.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as any;

    const puenteNativo = !!(w.AndroidSTT && typeof w.AndroidSTT.start === "function");
    const webSpeech = w.SpeechRecognition || w.webkitSpeechRecognition;
    // ORDEN DE PRIORIDAD: puente nativo → Web Speech → FALLBACK de servidor.
    // "none" queda reservado para cuando no hay NI micrófono: si se puede grabar,
    // el dictado funciona por el fallback aunque no exista Web Speech.
    const resuelto: SttMode = puenteNativo
      ? "native"
      : webSpeech
        ? "web"
        : fallbackDisponible()
          ? "fallback"
          : "none";

    modoRef.current = resuelto;
    setMode(resuelto);

    // Diagnóstico explícito: aparece en la consola del navegador y en el logcat del móvil.
    console.log("[VOZ360][STT] deteccion", {
      puenteNativo,
      webSpeech: !!webSpeech,
      fallback: fallbackDisponible(),
      isSecureContext: w.isSecureContext,
      mediaDevices: typeof navigator?.mediaDevices,
      modo: resuelto,
    });

    if (!puenteNativo) return;

    w.__electricistaSttEvent = (payload: any) => {
      const tipo = String(payload?.type ?? "");
      const texto = String(payload?.text ?? "").trim();
      const n = sttNativoRef.current;

      /**
       * VOZ NUEVA: reinicia la ventana de silencio del latido Y calla al asistente.
       * Es la señal real de barge-in que sí existe dentro de la APK.
       */
      const hayVozNueva = () => {
        n.ultimaVoz = Date.now();
        interrumpirTts();
      };

      // Cancelar sella el turno: ningún evento posterior pinta nada.
      if (descartadoRef.current) return;

      // Cualquier evento cuenta como actividad de la sesión: es lo que distingue
      // una escucha VIVA de una COLGADA (autocuración de `start()` en el puente).
      n.marcarEvento();

      if (tipo === "listening") {
        // El puente confirma que está escuchando: el arranque es REAL y el núcleo
        // desarma su watchdog de confirmación.
        n.confirmarArranque();
        // Si llega con el turno YA cerrado es que ha arrancado solo (permiso recién
        // concedido): se rearma para que el latido vuelva a decidir el cierre.
        if (n.finalizado || !n.activo) rearmarTrasPermiso();
        setIsListening(true);
        return;
      }

      if (tipo === "partial") {
        // Hipótesis provisional: REEMPLAZA, nunca se concatena.
        if (n.finalizado || !texto) return;
        n.actual = { segments: n.actual.segments, interim: texto };
        setPreview(displayText(n.actual));
        hayVozNueva();
        return;
      }

      if (tipo === "speechend") {
        // El motor deja de oír voz EN ESTA ventana. NO se cierra el turno: en
        // Android esto llega en cada micro-pausa y era otra vía de corte.
        return;
      }

      if (tipo === "final") {
        // Un `final` nativo es un SEGMENTO cerrado, NO el fin del turno.
        if (n.finalizado || !texto) return;
        n.actual = mergeUtterances(
          n.actual,
          utteranceFromResults([{ transcript: texto, isFinal: true }])
        );
        setPreview(displayText(n.actual));
        hayVozNueva();
        return;
      }

      if (tipo === "stopped") {
        // El usuario ha pulsado Detener (o el puente agotó sus reanudaciones): se
        // cierra con TODO lo reconocido. Si el turno ya estaba cerrado (el latido
        // se adelantó), `cerrarTurnoNativo` sale sin entregar dos veces.
        cerrarTurnoNativo("detenido");
        return;
      }

      if (tipo === "cancelled") {
        // Cancelar = descartar. Nada se entrega, ni siquiera lo que llegue tarde.
        descartadoRef.current = true;
        cerrarSesionNativaSinEntrega();
        entregaHechaRef.current = true;
        onListeningEndRef.current?.();
        return;
      }

      if (tipo === "permission") {
        // Permiso denegado (o pedido y aún sin resolver): se INFORMA —nunca en
        // silencio— y se deja el teclado como salida. El turno queda cerrado, pero
        // NO sellado: si el usuario concede, el puente arranca y emite `listening`,
        // que rearma el turno (ver rearmarTrasPermiso).
        cerrarSesionNativaSinEntrega();
        setError(texto || PERMISO_DENEGADO_TEXTO);
        onListeningEndRef.current?.();
        return;
      }

      if (tipo === "error") {
        // Error de verdad: NO se tira lo ya reconocido. Si hay texto útil se cierra
        // el turno CON él; sólo si no hay nada se muestra el error.
        if (!isEmptyUtterance(n.actual)) {
          cerrarTurnoNativo("error");
          return;
        }
        descartadoRef.current = true;
        cerrarSesionNativaSinEntrega();
        entregaHechaRef.current = true;
        setError((texto || ERROR_VOZ_TEXTO) + " " + TECLADO_TEXTO);
        onListeningEndRef.current?.();
        return;
      }
    };

    return () => {
      limpiarTemporizadores();
      try {
        delete w.__electricistaSttEvent;
      } catch {
        /* ignore */
      }
    };
    // El canal se instala UNA vez: los manejadores sólo tocan refs y setters
    // estables, así que no necesitan recrearse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al desmontar, cortar el micrófono: no dejar ningún reconocedor escuchando.
  useEffect(() => {
    return () => {
      descartadoRef.current = true;
      entregaHechaRef.current = true;
      limpiarTemporizadores();
      desarmarWatchdogArranqueWeb();
      // La grabación de fallback también se cierra y libera su micrófono: si no,
      // al salir de la pantalla con una grabación abierta la pista quedaría viva.
      terminarGrabacion(false);
      liberarGrabacion();
      desactivarBargeInPorEnergia();
      try {
        (window as any).AndroidSTT?.cancel?.();
      } catch {
        /* ignore */
      }
      try {
        reconocimientoRef.current?.abort?.();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Arranca la escucha NATIVA.
   *
   * Se confía en la PRESENCIA del puente, no en `isAvailable()`: en Android 11+ el
   * filtrado de visibilidad de paquetes puede devolver un FALSO NEGATIVO aunque el
   * teléfono sí tenga reconocedor, y ese falso negativo fue un P0 real ("no tiene
   * reconocedor de voz instalado"). Si de verdad no hay motor, el puente lo dice
   * por el evento `error` y aquí se informa.
   *
   * El permiso lo gestiona el puente: si falta, emite `permission` y lo pide; al
   * concederse ARRANCA SOLO y emite `listening`. Así no hay dos diálogos ni dos
   * escuchas.
   */
  function iniciarEscuchaNativa() {
    const puente = puenteSttNativo();
    if (!puente || typeof puente.start !== "function") {
      setError(SIN_MOTOR_TEXTO);
      return;
    }
    const n = sttNativoRef.current;
    // Nunca dos escuchas a la vez: si ya hay una viva, esta pulsación no hace nada.
    if (n.activo && !n.finalizado) return;

    descartadoRef.current = false;
    entregaHechaRef.current = false;
    errorFatalRef.current = false;
    // El núcleo abre una sesión LIMPIA: es el estado exacto de un primer turno,
    // así que el segundo (y el décimo) turno funcionan igual que el primero.
    n.abrir();
    setPreview("");
    setIsListening(true);
    console.log("[VOZ360][STT] arranque nativo");

    try {
      puente.start();
    } catch {
      n.cerrar("error");
      setIsListening(false);
      setError("No se pudo iniciar el micrófono. " + TECLADO_TEXTO);
      onErrorRef.current?.("No se pudo iniciar el micrófono.");
      return;
    }

    arrancarLatidoNativo();
    // Y se exige confirmación: sin ella, el turno se corta y el micro se libera.
    n.programarConfirmacion();
  }

  /**
   * CAMBIA A GRABACIÓN DE SERVIDOR EN CALIENTE.
   *
   * Se usa cuando la Web Speech API falla (network / service-not-allowed /
   * not-allowed) o se queda colgada: en lugar de dejar al usuario sin dictado, se
   * cierra esa vía y se arranca el fallback en el mismo gesto.
   */
  function pasarAFallback(motivo: string) {
    if (fallbackIntentadoRef.current) return;
    if (!fallbackDisponible()) return;
    console.log("[VOZ360][STT] Web Speech no sirve, se pasa al fallback", { motivo });
    errorFatalRef.current = true;
    // Cierra la sesión de Web Speech SIN entregar nada (no había texto o era basura).
    const ws = wsRef.current;
    ws.finalizado = true;
    ws.sesionActiva = false;
    ws.keepListening = false;
    if (ws.latido !== null) {
      window.clearInterval(ws.latido);
      ws.latido = null;
    }
    desarmarWatchdogArranqueWeb();
    const recognition = reconocimientoRef.current;
    reconocimientoRef.current = null;
    if (recognition) {
      try {
        recognition.onend = null;
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.abort();
      } catch {
        /* ignore */
      }
    }
    ws.actual = EMPTY_UTTERANCE;
    ws.base = EMPTY_UTTERANCE;
    entregaHechaRef.current = false;
    modoRef.current = "fallback";
    setMode("fallback");
    setIsListening(false);
    void iniciarEscuchaFallback();
  }

  /**
   * Suelta el reconocedor de navegador que hubiera VIVO.
   *
   * POR QUÉ (ciclos repetidos): si el motor se queda colgado sin emitir `onstart`,
   * el botón sigue diciendo "Dictar" y el usuario vuelve a pulsarlo. Sin soltar el
   * anterior se creaban DOS reconocedores a la vez: el viejo quedaba vivo con el
   * micrófono tomado y el motor ocupado, y a partir de ahí el dictado ya no
   * arrancaba hasta recargar la aplicación.
   */
  function liberarReconocimientoWeb() {
    const recognition = reconocimientoRef.current;
    reconocimientoRef.current = null;
    if (!recognition) return;
    try {
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.abort();
    } catch {
      /* ignore */
    }
  }

  /** Arranca la escucha con la Web Speech API (escritorio / PWA). */
  function iniciarEscuchaWeb() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError(SIN_MOTOR_TEXTO);
      return;
    }
    // Bloqueo conocido por origen no seguro: si hay micrófono, se usa el fallback
    // (su audio SÍ viaja por HTTPS aunque el reconocedor local no exista).
    if (origenNoSeguro() && typeof navigator.mediaDevices === "undefined") {
      setError(mensajeMicrofonoBloqueado());
      return;
    }

    // AUTOCURACIÓN: se suelta CUALQUIER reconocedor anterior antes de abrir otro.
    // Sin esto, un motor colgado (sin `onstart`) dejaba el botón en "Dictar" y la
    // segunda pulsación creaba un SEGUNDO reconocedor: el viejo seguía vivo con el
    // micrófono tomado y el dictado ya no arrancaba hasta recargar.
    liberarReconocimientoWeb();
    desarmarWatchdogArranqueWeb();

    const ws = wsRef.current;
    ws.base = EMPTY_UTTERANCE;
    ws.actual = EMPTY_UTTERANCE;
    ws.reinicios = 0;
    ws.finalizado = false;
    ws.sesionActiva = true;
    ws.keepListening = true;
    ws.inicio = Date.now();
    ws.ultimaVoz = Date.now();
    descartadoRef.current = false;
    entregaHechaRef.current = false;
    errorFatalRef.current = false;
    setPreview("");

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = language;
      // Frases largas: no cortamos en la primera pausa y vemos el texto parcial.
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      /**
       * WATCHDOG DE ARRANQUE: la Web Speech API puede quedarse COLGADA sin emitir
       * ni un solo evento (no llama a onstart, no da error y el usuario habla al
       * vacío). Antes eso dejaba el botón "escuchando" para siempre. Si no hay
       * ninguna señal en ESPERA_ARRANQUE_WEB_MS, se pasa al fallback.
       */
      desarmarWatchdogArranqueWeb();
      watchdogArranqueWebRef.current = window.setTimeout(() => {
        watchdogArranqueWebRef.current = null;
        if (ws.sesionActiva && !ws.finalizado && !entregaHechaRef.current) {
          pasarAFallback("arranque_sin_señal");
        }
      }, ESPERA_ARRANQUE_WEB_MS);

      recognition.onstart = () => {
        // El motor ha arrancado de verdad: el watchdog ya no hace falta.
        desarmarWatchdogArranqueWeb();
        setIsListening(true);
      };

      recognition.onaudiostart = () => {
        ws.ultimaVoz = Date.now();
        interrumpirTts();
      };

      /** El usuario ha empezado a hablar: el TTS se calla AQUÍ, en la voz real. */
      recognition.onspeechstart = () => {
        ws.ultimaVoz = Date.now();
        interrumpirTts();
      };

      recognition.onspeechend = () => {
        // Micro-pausa: NO se cierra el turno. El latido sigue esperando.
      };

      recognition.onresult = (event: any) => {
        if (reconocimientoRef.current !== recognition || !ws.sesionActiva) return;
        // La lista de resultados de la Web Speech API es ACUMULATIVA dentro de la
        // sesión: se reconstruye la transcripción ENTERA desde cero en lugar de
        // acumular deltas. Es idempotente, así que no puede duplicar texto ya
        // cerrado ni depender de `resultIndex` (que cambia entre motores).
        const chunks: Array<{ transcript: string; isFinal: boolean }> = [];
        for (let i = 0; i < event.results.length; i += 1) {
          const item = event.results[i];
          chunks.push({
            transcript: item?.[0]?.transcript ?? "",
            isFinal: Boolean(item?.isFinal),
          });
        }
        const sesion = utteranceFromResults(chunks);
        const merged = mergeUtterances(ws.base, sesion);
        ws.actual = merged;
        setPreview(displayText(merged));
        // Sólo la VOZ reinicia la ventana de silencio: así una pausa natural a
        // mitad de frase nunca la corta.
        if (!isEmptyUtterance(sesion)) ws.ultimaVoz = Date.now();
      };

      recognition.onerror = (event: any) => {
        if (reconocimientoRef.current !== recognition) return;
        const code = String(event?.error ?? "");
        if (ERRORES_FATALES.has(code)) errorFatalRef.current = true;

        // Un error del motor NUNCA elimina texto ya reconocido: si hay algo
        // dictado, el turno se cierra CON ello en lugar de tirarlo.
        if (!isEmptyUtterance(ws.actual)) {
          cerrarTurnoWeb("manual");
          return;
        }

        /**
         * FALLO DEL MOTOR DE VOZ → SE PASA AL FALLBACK, NO SE ABANDONA.
         *
         * Éste era el fallo real en móvil: "network" (el servicio de voz del
         * navegador no está disponible) o "service-not-allowed" dejaban al usuario
         * con un mensaje de error y SIN texto, aunque el micrófono funcionara
         * perfectamente. Ahora se graba y se transcribe en el servidor.
         *
         * Si el usuario ha denegado el micrófono (`not-allowed` con permiso
         * denegado), el fallback tampoco podrá y dará el mensaje de permisos: no se
         * entra en bucle porque sólo se intenta UNA vez por dictado.
         */
        if (ERRORES_QUE_PASAN_A_FALLBACK.has(code) && fallbackDisponible() && !fallbackIntentadoRef.current) {
          pasarAFallback(code);
          return;
        }

        // "no-speech" y "aborted" son cierres normales y transitorios: la sesión
        // sigue viva y el latido decide el final del turno.
        if (!errorFatalRef.current) return;

        cerrarTurnoWeb("manual");
        setError(
          code === "not-allowed"
            ? mensajeMicrofonoBloqueado()
            : ERRORES_WEB[code] || "No se pudo usar el micrófono"
        );
      };

      recognition.onend = () => {
        // Ignorar el cierre de una sesión ya reemplazada o cerrada por nosotros.
        if (reconocimientoRef.current !== recognition) return;

        // Android/Chrome cierra la sesión cada cierto tiempo aunque continuous=true.
        // Reiniciar CONSERVANDO lo acumulado mantiene vivo el turno hasta que el
        // usuario termine de hablar o pulse Detener.
        if (ws.keepListening && ws.sesionActiva && !descartadoRef.current && !errorFatalRef.current) {
          if (ws.reinicios < MAX_RESTARTS) {
            ws.reinicios += 1;
            // Lo acumulado pasa a ser la base de la sesión nueva: el motor
            // reinicia su propia lista de resultados y sin esto se perdería justo
            // lo último dicho.
            ws.base = ws.actual;
            try {
              recognition.start();
              return;
            } catch {
              /* si no se puede reiniciar, se cierra con lo dictado (abajo) */
            }
          } else {
            cerrarTurnoWeb("timeout");
            return;
          }
        }

        if (ws.sesionActiva) {
          // El motor cerró la sesión definitivamente: NO se descarta lo dictado.
          cerrarTurnoWeb("silence");
          return;
        }

        reconocimientoRef.current = null;
        setIsListening(false);
      };

      reconocimientoRef.current = recognition;
      recognition.start();

      // Latido: cierra por silencio real o por tope, nunca en el primer parcial.
      if (ws.latido !== null) window.clearInterval(ws.latido);
      ws.latido = window.setInterval(() => {
        if (!ws.sesionActiva || ws.finalizado) return;
        const ahora = Date.now();
        const razon = finalizeReason({
          sinceLastSpeechMs: ahora - ws.ultimaVoz,
          sinceStartMs: ahora - ws.inicio,
          hasSpeech: !isEmptyUtterance(ws.actual),
        });
        if (razon) cerrarTurnoWeb(razon);
      }, HEARTBEAT_MS);

      // Barge-in por energía (sólo si ya hay permiso de micrófono concedido): es un
      // complemento del aviso `onspeechstart`, nunca un requisito para dictar.
      void activarBargeInPorEnergia();
    } catch {
      ws.sesionActiva = false;
      ws.keepListening = false;
      // El reconocedor que no ha podido arrancar se suelta: nunca queda vivo.
      liberarReconocimientoWeb();
      setIsListening(false);
      // Si el motor no arranca, todavía queda el fallback de servidor.
      if (fallbackDisponible() && !fallbackIntentadoRef.current) {
        pasarAFallback("start_fallido");
        return;
      }
      setError("No se pudo iniciar el reconocimiento de voz");
    }
  }

  const startListening = () => {
    if (disabled) return;
    setError(null);
    // Cada pulsación concede UN intento de fallback (nunca un bucle dentro del
    // mismo dictado, pero sí uno nuevo en la pulsación siguiente).
    fallbackIntentadoRef.current = false;
    descartadoRef.current = false;
    // Si el asistente está hablando, se corta AHORA: el usuario tiene la palabra.
    // (Interrupción natural: nunca se solapan la voz del asistente y la suya.)
    interrumpirTts();

    // 1) Reconocedor nativo del teléfono (Android WebView / APK).
    if (modoRef.current === "native") {
      iniciarEscuchaNativa();
      return;
    }

    // 2) Grabación + transcripción en el servidor (la vía que siempre queda).
    if (modoRef.current === "fallback") {
      void iniciarEscuchaFallback();
      return;
    }

    // 3) Sin micrófono ni reconocedor: aviso honesto, sin simular que escucha.
    if (modoRef.current === "none") {
      setError(SIN_MOTOR_TEXTO);
      return;
    }

    // 4) Web Speech API (navegador en contexto seguro). Si falla, salta el fallback.
    //
    // AUTOCURACIÓN DEL MOTOR MUDO: si el turno anterior se cerró sin UNA sola
    // palabra (arranca, no devuelve resultados y no da error), no se insiste con el
    // mismo motor: se graba y se transcribe en el servidor. Sin esto, un navegador
    // con el servicio de voz caído se quedaba "sin dictado" para siempre.
    if (turnosWebSinTextoRef.current > 0 && fallbackDisponible()) {
      pasarAFallback("web_sin_resultados");
      return;
    }
    iniciarEscuchaWeb();
  };

  const stopListening = () => {
    if (modoRef.current === "native") {
      const n = sttNativoRef.current;
      if (!n.activo || n.finalizado) {
        // No hay nada que parar (o ya se cerró): se asegura el estado.
        cerrarTurnoNativo("manual");
        return;
      }
      // PARADA SUAVE: el puente entrega el ÚLTIMO segmento y emite "stopped", que
      // cierra el turno con TODO lo acumulado. Entregar ya con la última parcial
      // perdería las últimas palabras.
      if (n.latido !== null) {
        window.clearInterval(n.latido);
        n.latido = null;
      }
      setIsListening(false);
      console.log("[VOZ360][STT] stop manual nativo");
      try {
        puenteSttNativo()?.stop();
      } catch {
        cerrarTurnoNativo("manual");
        return;
      }
      programarCierreNativoForzado();
      return;
    }

    // FALLBACK: Detener cierra la grabación y lanza la transcripción del audio
    // COMPLETO (nada de cortes a mitad de frase: no se pierden las últimas
    // palabras, que es justo lo que se perdía con los cierres prematuros).
    if (modoRef.current === "fallback" || fallbackActivoRef.current) {
      setIsListening(false);
      terminarGrabacion(true);
      return;
    }

    const ws = wsRef.current;
    if (ws.sesionActiva) {
      cerrarTurnoWeb("manual");
      return;
    }
    setIsListening(false);
    entregarTurno("");
  };

  /**
   * CANCELAR el dictado: cierra el micrófono y DESCARTA lo reconocido.
   *
   * Es la diferencia explícita con "Detener": Detener finaliza y entrega todo lo
   * reconocido; Cancelar no entrega nada (el usuario se ha equivocado y no quiere
   * ese texto en la orden).
   *
   * `descartadoRef` + `entregaHechaRef` son la garantía real: cualquier evento que
   * llegue DESPUÉS (parcial tardía, `stopped` del puente, onend de un rearme) se
   * ignora y no puede entregar ni una palabra.
   */
  const descartarEscucha = () => {
    descartadoRef.current = true;
    entregaHechaRef.current = true;
    setError(null);
    setPreview("");
    desactivarBargeInPorEnergia();

    const n = sttNativoRef.current;
    // Cancelar = descartar: el núcleo cierra la sesión (una sola vez) y libera.
    n.descartar();

    const ws = wsRef.current;
    ws.finalizado = true;
    ws.sesionActiva = false;
    ws.keepListening = false;
    ws.actual = EMPTY_UTTERANCE;
    ws.base = EMPTY_UTTERANCE;

    limpiarTemporizadores();
    setIsListening(false);

    // CANCELAR EN EL FALLBACK: se corta la grabación y NO se envía el audio.
    if (modoRef.current === "fallback" || fallbackActivoRef.current) {
      terminarGrabacion(false);
      liberarGrabacion();
      onListeningEndRef.current?.();
      return;
    }

    if (modoRef.current === "native") {
      const puente = puenteSttNativo();
      try {
        if (typeof puente?.cancel === "function") {
          // Cancelación DURA en el puente: descarta lo suyo y no emite texto.
          puente.cancel();
        } else {
          puente?.stop?.();
        }
      } catch {
        /* ignore */
      }
      onListeningEndRef.current?.();
      return;
    }

    const recognition = reconocimientoRef.current;
    reconocimientoRef.current = null;
    if (recognition) {
      try {
        // Sin callbacks: el reconocedor abortado no puede reconectar ni entregar.
        recognition.onend = null;
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.abort();
      } catch {
        /* ignore */
      }
    }
    onListeningEndRef.current?.();
  };

  const toggleListening = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  /**
   * ¿Hay una escucha VIVA ahora mismo?
   *
   * Se pregunta al estado REAL de cada vía (sesión nativa del núcleo de audio,
   * sesión de Web Speech o grabación de fallback) y no a `isListening`, que es una
   * copia de React y puede llegar con un render de retraso justo cuando llega la
   * petición externa.
   */
  function hayEscuchaViva(): boolean {
    if (modoRef.current === "native") {
      const n = sttNativoRef.current;
      return n.activo && !n.finalizado;
    }
    if (fallbackActivoRef.current) return true;
    return wsRef.current.sesionActiva;
  }

  const startListeningRef = useRef(startListening);
  startListeningRef.current = startListening;
  /** Última petición externa ya atendida (para no arrancar dos veces la misma). */
  const peticionAtendidaRef = useRef(escuchaSolicitada ?? 0);

  useEffect(() => {
    const peticion = escuchaSolicitada ?? 0;
    if (peticion === peticionAtendidaRef.current) return;
    peticionAtendidaRef.current = peticion;
    if (disabled) return;
    // Ya está escuchando: esta petición es redundante y NO debe reiniciar el
    // micrófono (reiniciarlo perdería lo que el usuario esté diciendo).
    if (hayEscuchaViva()) return;
    startListeningRef.current();
    // Sólo la petición externa y el bloqueo disparan esto: el estado interno de la
    // escucha se consulta en vivo con `hayEscuchaViva()`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escuchaSolicitada, disabled]);

  const sinMotor = mode === "none";
  const enFallback = mode === "fallback";
  const transcribiendo = faseFallback === "transcribiendo";

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <div className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={toggleListening}
          disabled={disabled || transcribiendo}
          aria-pressed={isListening}
          title={
            sinMotor
              ? SIN_MOTOR_TITULO
              : isListening
                ? "Escuchando… Pulsa para detener y transcribir"
                : enFallback
                  ? "Dictar por voz (grabación y transcripción en el servidor)"
                  : "Dictar por voz (Español)"
          }
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
            isListening
              ? "bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 animate-pulse ring-2 ring-rose-200 dark:ring-rose-900"
              : "bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white"
          } ${disabled || transcribiendo ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${className}`}
        >
          {sinMotor ? (
            <MicOff className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
          ) : (
            <Mic className={`h-3.5 w-3.5 ${isListening ? "text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"}`} />
          )}
          <span>{transcribiendo ? "Transcribiendo…" : isListening ? "Detener" : "Dictar"}</span>
        </button>

        {/* Cancelar: cierra el micrófono y DESCARTA lo reconocido. */}
        {isListening && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              descartarEscucha();
            }}
            title="Cancelar el dictado y descartar lo reconocido"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300"
          >
            <X className="h-3.5 w-3.5" />
            <span>Cancelar</span>
          </button>
        )}

        {error && (
          <span
            role="alert"
            className="text-xs text-rose-500 dark:text-rose-400 flex items-start gap-0.5 max-w-[16rem]"
            title={error}
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </span>
        )}
      </div>

      {/* Texto reconocido en directo: se conserva y solo se entrega al terminar. */}
      {isListening && (
        <span className="text-xs text-slate-500 dark:text-slate-400 italic max-w-[18rem] truncate" title={preview}>
          {preview ? `“${preview}”` : enFallback ? FALLBACK_GRABANDO_TEXTO : "Escuchando… habla con calma"}
        </span>
      )}
    </div>
  );
}
