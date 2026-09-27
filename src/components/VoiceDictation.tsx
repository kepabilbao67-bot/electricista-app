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
 *  - "native": puente Android (window.AndroidSTT) → reconocedor del propio teléfono.
 *  - "web":    Web Speech API (navegador en contexto seguro).
 *  - "none":   no hay ningún motor; se avisa en pantalla, NO se simula éxito.
 *
 * CONTEXTO SEGURO (causa raíz del fallo en móvil):
 * El navegador solo permite el micrófono en contextos seguros (https, localhost
 * o 127.0.0.1). Servida por http://IP-de-LAN, la página tiene
 * window.isSecureContext === false y navigator.mediaDevices es undefined, así que
 * Chrome deniega el micrófono y la Web Speech API responde "not-allowed".
 * En ese caso NO se puede arreglar por código: se avisa con un mensaje claro y se
 * deja el teclado como alternativa. En la APK el dictado va por el puente nativo
 * (AndroidSTT) y por eso sí funciona sobre HTTP.
 */
type SttMode = "native" | "web" | "none";

const SIN_MOTOR_TEXTO = "Dictado no disponible aquí";
const SIN_MOTOR_TITULO =
  "Este WebView no expone la Web Speech API y no hay puente nativo. " +
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

  const reconocimientoRef = useRef<any>(null);
  const modoRef = useRef<SttMode>("web");
  /** Error irrecuperable: no se reintenta ni se reconecta. */
  const errorFatalRef = useRef(false);
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
    console.log("[VOZ360][STT] cierre web", { motivo, caracteres: dicho.length });
    entregarTurno(dicho);
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
    const resuelto: SttMode = puenteNativo ? "native" : webSpeech ? "web" : "none";

    modoRef.current = resuelto;
    setMode(resuelto);

    // Diagnóstico explícito: aparece en la consola del navegador y en el logcat del móvil.
    console.log("[VOZ360][STT] deteccion", {
      puenteNativo,
      webSpeech: !!webSpeech,
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

  /** Arranca la escucha con la Web Speech API (escritorio / PWA). */
  function iniciarEscuchaWeb() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError(SIN_MOTOR_TEXTO);
      return;
    }
    // Bloqueo conocido por origen no seguro: avisamos sin intentarlo.
    if (origenNoSeguro() && typeof navigator.mediaDevices === "undefined") {
      setError(mensajeMicrofonoBloqueado());
      return;
    }

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

      recognition.onstart = () => {
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
      reconocimientoRef.current = null;
      setIsListening(false);
      setError("No se pudo iniciar el reconocimiento de voz");
    }
  }

  const startListening = () => {
    if (disabled) return;
    setError(null);
    // Si el asistente está hablando, se corta AHORA: el usuario tiene la palabra.
    // (Interrupción natural: nunca se solapan la voz del asistente y la suya.)
    interrumpirTts();

    // 1) Reconocedor nativo del teléfono (Android WebView / APK).
    if (modoRef.current === "native") {
      iniciarEscuchaNativa();
      return;
    }

    // 2) Sin motor disponible: aviso honesto, sin simular que escucha.
    if (modoRef.current === "none") {
      setError(SIN_MOTOR_TEXTO);
      return;
    }

    // 3) Web Speech API (navegador en contexto seguro).
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
   * Se pregunta al estado REAL de cada vía (sesión nativa del núcleo de audio o
   * sesión de Web Speech) y no a `isListening`, que es una copia de React y puede
   * llegar con un render de retraso justo cuando llega la petición externa.
   */
  function hayEscuchaViva(): boolean {
    if (modoRef.current === "native") {
      const n = sttNativoRef.current;
      return n.activo && !n.finalizado;
    }
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

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <div className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={toggleListening}
          disabled={disabled}
          aria-pressed={isListening}
          title={
            sinMotor
              ? SIN_MOTOR_TITULO
              : isListening
                ? "Escuchando… Pulsa para detener y usar el texto"
                : "Dictar por voz (Español)"
          }
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
            isListening
              ? "bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 animate-pulse ring-2 ring-rose-200 dark:ring-rose-900"
              : "bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${className}`}
        >
          {sinMotor ? (
            <MicOff className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
          ) : (
            <Mic className={`h-3.5 w-3.5 ${isListening ? "text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"}`} />
          )}
          <span>{isListening ? "Detener" : "Dictar"}</span>
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
          {preview ? `“${preview}”` : "Escuchando… habla con calma"}
        </span>
      )}
    </div>
  );
}
