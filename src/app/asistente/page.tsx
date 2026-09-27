"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Check,
  Mic,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import VoiceDictation from "@/components/VoiceDictation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Voz360TtsGuard, esperaLocucionMs } from "@/lib/assistant/voz360-audio-core";
import { defaultGeminiLiveClient } from "@/lib/assistant/gemini-live-client";
import { SesionLivePcm, clasificarErrorPcm, type DiagnosticoPcm } from "@/lib/assistant/gemini-live-pcm";
import type { EstadoPcm } from "@/lib/assistant/pcm-audio";
import type { Voice360Draft, Voice360Item, Voice360PendingAction } from "@/lib/assistant/types";

interface Totals {
  subtotal: number;
  tax_amount: number;
  total: number;
  incomplete: string[];
}

/**
 * Procedencia de la respuesta del motor, tal como la devuelve
 * `/api/asistente/voice360`. Permite mostrar en pantalla si la respuesta la ha
 * dado la IA real o el motor determinista (transparencia para el usuario).
 */
type AnswerSource = "engine" | "safety" | "crm-data" | "app-knowledge" | "ai" | "local";

const SOURCE_LABELS: Record<AnswerSource, string> = {
  engine: "Motor Voz 360",
  safety: "Seguridad eléctrica",
  "crm-data": "Datos reales",
  "app-knowledge": "Guía de la app",
  ai: "IA",
  local: "Modo local",
};

/**
 * Estados del flujo por voz. El orden importa: NUNCA se puede pasar de PARSING a
 * SAVED. Para escribir hace falta DRAFT_READY → AWAITING_CONFIRMATION → SAVED
 * (una confirmación explícita del usuario).
 */
type Fase =
  | "IDLE"
  | "LISTENING"
  | "TRANSCRIBED"
  | "PARSING"
  | "DRAFT_READY"
  | "AWAITING_CONFIRMATION"
  | "SAVING"
  | "SAVED"
  | "CANCELLED"
  | "ERROR";

const FASE_ESTILO: Record<Fase, { texto: string; clase: string }> = {
  IDLE: { texto: "Listo", clase: "bg-slate-800 text-slate-300 border-slate-700" },
  LISTENING: { texto: "LISTENING · escuchando", clase: "bg-rose-950/60 text-rose-200 border-rose-700" },
  TRANSCRIBED: { texto: "TRANSCRIBED · texto reconocido", clase: "bg-sky-950/60 text-sky-200 border-sky-700" },
  PARSING: { texto: "PARSING · interpretando", clase: "bg-amber-950/60 text-amber-200 border-amber-700" },
  DRAFT_READY: { texto: "DRAFT_READY · borrador sin guardar", clase: "bg-emerald-950/60 text-emerald-200 border-emerald-700" },
  AWAITING_CONFIRMATION: {
    texto: "AWAITING_CONFIRMATION · falta tu confirmación",
    clase: "bg-amber-950/60 text-amber-200 border-amber-600",
  },
  SAVING: { texto: "SAVING · guardando", clase: "bg-amber-950/60 text-amber-200 border-amber-700" },
  SAVED: { texto: "SAVED · guardado", clase: "bg-emerald-900/60 text-emerald-200 border-emerald-600" },
  CANCELLED: { texto: "CANCELLED · descartado", clase: "bg-slate-800 text-slate-300 border-slate-600" },
  ERROR: { texto: "ERROR", clase: "bg-rose-950/60 text-rose-200 border-rose-700" },
};

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  result?: unknown;
  source?: AnswerSource;
}

const SUGGESTIONS = [
  "Presupuesto para Juan Pérez: 4 enchufes a 18 euros y 2 horas de trabajo a 50 euros",
  "¿Qué partes de trabajo tengo?",
  "Busca el cliente García",
  "¿Qué facturas tengo pendientes?",
];

function nuevoId(prefijo: string): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function euros(valor: number): string {
  return `${valor.toFixed(2).replace(".", ",")} €`;
}

/**
 * Recalcula los totales del borrador EN PANTALLA, con la misma fórmula que el
 * servidor. Sirve para que editar una línea se refleje al instante; el importe
 * que se guarda lo vuelve a calcular el servidor (nunca se fía del cliente).
 */
function recalcular(draft: Voice360Draft | null): Totals | null {
  if (!draft || draft.items.length === 0) return null;
  const incomplete: string[] = [];
  let subtotal = 0;

  for (const item of draft.items) {
    const precio = item.unit_price;
    if (precio === null || precio === undefined) incomplete.push(item.description);
    else subtotal += item.quantity * precio;
  }

  const tipo = Number(draft.tax_rate ?? 21);
  const tax = Math.round(subtotal * (tipo / 100) * 100) / 100;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax_amount: tax,
    total: Math.round((subtotal + tax) * 100) / 100,
    incomplete,
  };
}

export default function Voice360Page() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text:
        "Soy Voz 360 para Electricista360. Habla o escribe. Preparo el presupuesto como BORRADOR (nunca se guarda solo): " +
        "lo revisas, lo corriges y solo se guarda cuando lo confirmas.",
    },
  ]);
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<Voice360Draft | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [pending, setPending] = useState<Voice360PendingAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  /**
   * Respuesta hablada ACTIVADA por defecto.
   *
   * Antes nacía en `false` y `readAloud()` hace `if (!speak) return;`, así que el
   * asistente escribía la respuesta pero NUNCA la pronunciaba: había que descubrir
   * y pulsar el botón de altavoz (un icono sin texto) para oírlo. Es un asistente
   * de VOZ, así que arranca hablando; el botón sigue sirviendo para silenciarlo.
   */
  const [speak, setSpeak] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  /**
   * CONVERSACIÓN CONTINUA ("manos libres").
   *
   * Nace APAGADA a propósito: con ella encendida el asistente decide solo cuándo
   * abre el micrófono, y eso no debe cambiar el comportamiento ya probado sin que
   * el usuario lo pida. Encendida, el ciclo es el del encargo:
   *
   *   hablar → STT → intención → acción real → respuesta → TTS → vuelve a escuchar
   *
   * sin pulsar nada entre turnos.
   */
  const [manosLibres, setManosLibres] = useState(false);
  /** Contador de peticiones de escucha: cada subida arranca el micrófono. */
  const [escuchaSolicitada, setEscuchaSolicitada] = useState(0);
  /** Motivo por el que manos libres se ha apagado solo (nunca se apaga en silencio). */
  const [avisoManosLibres, setAvisoManosLibres] = useState("");
  const [online, setOnline] = useState(true);
  const [showDraft, setShowDraft] = useState(false);
  const [fase, setFase] = useState<Fase>("IDLE");
  const [editando, setEditando] = useState(false);
  /**
   * ESTADO QA DEL CAMINO PCM (Gemini Live con micrófono real).
   *
   * Se muestra en pantalla a propósito mientras se valida en el móvil: sin esto
   * no hay forma de saber si el fallo está en la captura, en el turno o en la
   * reproducción. Es temporal y sólo informa.
   */
  const [estadoLive, setEstadoLive] = useState<EstadoPcm>("DISCONNECTED");
  const [tasaHardware, setTasaHardware] = useState<number | null>(null);
  const [avisoLive, setAvisoLive] = useState("");
  /**
   * Diagnóstico EN VIVO del camino de voz (se refresca solo mientras hay sesión).
   * Es la evidencia que permite separar "Gemini no manda audio" de "el móvil no
   * lo reproduce" sin adivinar.
   */
  const [diag, setDiag] = useState<DiagnosticoPcm | null>(null);
  const sesionLiveRef = useRef<SesionLivePcm | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  /** Último texto enviado por el usuario: permite reintentar tras un error. */
  const lastUserTextRef = useRef("");
  /** Evita que un doble click/enter dispare dos peticiones a la vez. */
  const enviandoRef = useRef(false);
  /**
   * IDEMPOTENCIA (cerrojo de confirmación).
   *
   * `disabled={loading}` NO basta: setLoading es asíncrono, así que dos clicks
   * dentro del MISMO tick verían ambos loading=false y dispararían dos POST de
   * confirmación. El token de un solo uso ya impide un segundo presupuesto, pero
   * el segundo POST producía un error confuso en pantalla. Este ref cierra la
   * ventana antes de que exista.
   */
  const confirmandoRef = useRef(false);
  /**
   * Identifica la locución (TTS) vigente: los eventos tardíos de una locución
   * cancelada no deben apagar el indicador de la nueva.
   */
  const speechTokenRef = useRef(0);
  /**
   * GUARDA DE LOCUCIÓN (P0-2). Es la autoridad de "una sola locución activa" y
   * del FIN GARANTIZADO: fin del motor, error, cancelación o watchdog. Sin ella
   * `speaking` podía quedarse encendido para siempre (el motor de Android no
   * garantiza `onDone`) y el ciclo de voz dejaba de responder tras la primera
   * respuesta hablada. El watchdog vive aquí Y en el puente nativo: el primero
   * que llegue cierra.
   */
  const ttsGuardRef = useRef<Voz360TtsGuard | null>(null);
  /** Espejo de `manosLibres` para los callbacks: nunca leen estado rancio. */
  const manosLibresRef = useRef(false);
  /** Espejo de `loading`: mientras se procesa una orden NO se abre el micrófono. */
  const loadingRef = useRef(false);
  /**
   * ¿El turno que acaba de terminar dejó texto reconocido?
   *
   * En manos libres, un turno sin texto (silencio, ruido, motor mudo) NO puede
   * volver a escuchar para siempre: se cuentan los vacíos seguidos y, al llegar al
   * tope, el modo se apaga en vez de girar en bucle.
   */
  const transcriptRecibidoRef = useRef(false);
  const intentosVaciosRef = useRef(0);
  /** Red de seguridad de la vuelta a escuchar (ver `programarVueltaAEscuchar`). */
  const vueltaEscucharRef = useRef<number | null>(null);
  if (ttsGuardRef.current === null) {
    ttsGuardRef.current = new Voz360TtsGuard({
      onHablando: (hablando) => {
        setSpeaking(hablando);
        // La locución ha TERMINADO (fin, error, cancelación o watchdog): es el
        // único momento correcto para reabrir el micrófono. Hacerlo antes grabaría
        // la propia voz del asistente y provocaría una interrupción falsa.
        if (!hablando) pedirEscuchaSiProcede();
      },
    });
  }

  // Online / Offline detection
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, draft]);

  /**
   * Refresco periódico del diagnóstico mientras la sesión Live está en marcha.
   *
   * Sin esto, los contadores (chunks/start/ended) serían una foto fija del
   * arranque y no se vería si el audio AVANZA o se queda clavado.
   */
  useEffect(() => {
    const id = window.setInterval(() => {
      const s = sesionLiveRef.current;
      if (s) setDiag(s.diagnostico);
    }, 400);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => () => defaultGeminiLiveClient.close(), []);

  /**
   * Al desmontar, se retira la red de seguridad de la vuelta a escuchar: un
   * temporizador vivo podría abrir el micrófono de una pantalla que ya no existe.
   */
  useEffect(() => () => cancelarVueltaAEscuchar(), []);

  /**
   * Eventos del TTS NATIVO (window.__electricistaTtsEvent).
   *
   * En la APK la WebView no implementa `speechSynthesis`, así que quien habla es
   * el sintetizador del teléfono a través de `window.AndroidTTS` (ver
   * NativeTts.java). Como esa vía es asíncrona y no tiene `onend` de JS, el
   * indicador de "hablando" se apaga con estos eventos; sin ellos se quedaría
   * encendido para siempre.
   */
  useEffect(() => {
    const w = window as unknown as {
      __electricistaTtsEvent?: (e: { type?: string }) => void;
    };
    w.__electricistaTtsEvent = (evento) => {
      const tipo = evento?.type ?? "";
      const guarda = ttsGuardRef.current;
      if (tipo === "start") {
        // El motor confirma que ha empezado: la guarda queda como "hablando".
        guarda?.iniciar();
        setSpeaking(true);
      } else if (tipo === "done") {
        // Fin real de la locución: cierre idempotente y vuelta a IDLE.
        guarda?.finalizar("fin");
        setSpeaking(false);
      } else if (tipo === "error") {
        // El motor ha fallado: la respuesta está en pantalla y el ciclo sigue.
        guarda?.fallar();
        setSpeaking(false);
      }
    };
    return () => {
      delete w.__electricistaTtsEvent;
    };
  }, []);

  const mostrarPanel = Boolean(draft && draft.items.length > 0);
  useEffect(() => {
    if (mostrarPanel) setShowDraft(true);
  }, [mostrarPanel]);

  const observaciones = useMemo(() => (draft?.notes ?? []).join("\n"), [draft]);

  /**
   * Corta la respuesta hablada en curso.
   *
   * Se usa en tres momentos (cancelar/interrumpir):
   *  - el usuario pulsa el botón de detener;
   *  - el usuario vuelve a hablar (VoiceDictation.onListeningStart);
   *  - el usuario envía una orden nueva.
   * `cancel()` es síncrono y seguro aunque no haya nada sonando.
   */
  function stopSpeaking() {
    // La locución en curso queda invalidada: `cancel()` dispara su `onend` más
    // tarde y, sin esta marca, apagaría el indicador de una locución NUEVA.
    speechTokenRef.current += 1;
    // La guarda cierra la locución (desarma su watchdog y apaga `speaking`):
    // así cortar la voz nunca deja el ciclo bloqueado.
    ttsGuardRef.current?.cancelar();
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* sin soporte de síntesis: no hay nada que cortar */
    }
    try {
      (window as unknown as { AndroidTTS?: { stop?: () => void } }).AndroidTTS?.stop?.();
    } catch {
      /* sin puente nativo: nada que cortar */
    }
    setSpeaking(false);
  }

  function readAloud(text: string) {
    if (!speak) {
      // Voz silenciada: no hay nada que esperar para volver a escuchar.
      programarVueltaAEscuchar(600);
      return;
    }
    // Los importes y los nombres se leen mejor con puntuación explícita y sin
    // marcas de Markdown, que el sintetizador leería en voz alta.
    const limpio = text.replace(/[*#_`|]/g, "").replace(/\n+/g, ". ");

    // 1) TTS NATIVO (APK). Dentro de la WebView de Android NO existe
    //    `speechSynthesis`, así que sin esta vía la respuesta no se oiría.
    const nativo = (window as unknown as { AndroidTTS?: { speak?: (t: string) => void } }).AndroidTTS;
    if (nativo && typeof nativo.speak === "function") {
      speechTokenRef.current += 1;
      // Abre la locución ANTES de pedirla: si el puente no contesta (ni `start`
      // ni `done`), el watchdog cierra igual y `speaking` no se queda encendido.
      ttsGuardRef.current?.abrir(limpio);
      nativo.speak(limpio);
      programarVueltaAEscuchar(esperaLocucionMs(limpio.length) + 1200);
      return;
    }

    // 2) Navegador.
    if (!("speechSynthesis" in window)) {
      // Sin motor de síntesis en esta WebView: la respuesta queda en pantalla y el
      // ciclo vuelve a escuchar igual (si no, manos libres moriría aquí).
      programarVueltaAEscuchar(600);
      return;
    }
    // `cancel()` SÓLO si hay algo en cola. Cancelar y volver a llamar a `speak()`
    // en el mismo tick es el patrón que en Chrome puede dejar la locución sin
    // sonar (la cola se vacía después de encolar). Si no hay nada sonando no se
    // toca la cola; si lo hay, cortar sigue siendo lo correcto.
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
    }
    const token = speechTokenRef.current + 1;
    speechTokenRef.current = token;
    ttsGuardRef.current?.abrir(limpio);
    const utterance = new SpeechSynthesisUtterance(limpio);
    utterance.lang = "es-ES";
    utterance.rate = 0.95;
    utterance.onstart = () => {
      if (speechTokenRef.current === token) setSpeaking(true);
    };
    utterance.onend = () => {
      setSpeaking(false);
      if (speechTokenRef.current !== token) return;
      ttsGuardRef.current?.finalizar("fin");
    };
    utterance.onerror = () => {
      setSpeaking(false);
      if (speechTokenRef.current !== token) return;
      ttsGuardRef.current?.fallar();
    };
    window.speechSynthesis.speak(utterance);
    programarVueltaAEscuchar(esperaLocucionMs(limpio.length) + 1200);
  }

  // ── ESCUCHA CONTINUA (manos libres) ──────────────────────────────────────
  // Los espejos se refrescan en cada render para que los callbacks del motor de
  // audio (que viven fuera de React) nunca lean un valor antiguo.
  manosLibresRef.current = manosLibres;
  loadingRef.current = loading;

  /**
   * Enciende o apaga la conversación continua.
   *
   * Al ENCENDER se abre el micrófono en el acto (el propio clic es el gesto, así
   * que el permiso y el AudioContext se resuelven dentro del gesto). Al APAGAR se
   * corta la red de seguridad y la escucha en curso se deja terminar sola: nunca
   * se descarta lo que el usuario esté diciendo.
   */
  function alternarManosLibres() {
    if (manosLibresRef.current) {
      setManosLibres(false);
      setAvisoManosLibres("");
      cancelarVueltaAEscuchar();
      return;
    }
    intentosVaciosRef.current = 0;
    transcriptRecibidoRef.current = false;
    setAvisoManosLibres("");
    setManosLibres(true);
    // Síncrono dentro del gesto: es lo que hace que el arranque sea fiable.
    setEscuchaSolicitada((n) => n + 1);
  }

  /**
   * VUELVE A ESCUCHAR, si el modo manos libres está encendido.
   *
   * Es la pieza que cierra el ciclo del encargo:
   *   hablar → STT → intención → acción real → respuesta → TTS → VUELVE A ESCUCHAR
   *
   * SE LLAMA SÓLO CUANDO LA LOCUCIÓN HA TERMINADO y no hay ninguna orden en curso.
   * Abrir el micrófono antes tiene dos consecuencias reales y ambas malas: se
   * graba la propia voz del asistente (y el turno se cortaría solo con un
   * barge-in falso), o se pisa la orden que se está procesando.
   */
  function pedirEscuchaSiProcede(): void {
    if (!manosLibresRef.current) return;
    if (loadingRef.current || enviandoRef.current || confirmandoRef.current) return;
    if (ttsGuardRef.current?.estaHablando) return;
    setEscuchaSolicitada((n) => n + 1);
  }

  /**
   * RED DE SEGURIDAD de la vuelta a escuchar.
   *
   * El disparador normal es el fin de la locución (watchdog de la guarda TTS). Si
   * NO hay motor de voz disponible (WebView sin `speechSynthesis` y sin puente
   * nativo) o el TTS está silenciado, la guarda nunca llega a abrirse y ese aviso
   * no existiría: sin este temporizador, el modo manos libres se quedaría mudo en
   * el primer turno. Con motor, el plazo es el del watchdog + margen, así que sólo
   * actúa si de verdad nadie avisó.
   */
  function programarVueltaAEscuchar(ms: number): void {
    if (vueltaEscucharRef.current !== null) window.clearTimeout(vueltaEscucharRef.current);
    vueltaEscucharRef.current = window.setTimeout(() => {
      vueltaEscucharRef.current = null;
      pedirEscuchaSiProcede();
    }, ms);
  }

  function cancelarVueltaAEscuchar(): void {
    if (vueltaEscucharRef.current !== null) {
      window.clearTimeout(vueltaEscucharRef.current);
      vueltaEscucharRef.current = null;
    }
  }

  /** Añade una respuesta del asistente a la conversación. */
  function anadirMensajeAsistente(texto: string, result?: unknown, source?: AnswerSource) {
    setMessages((current) => [
      ...current,
      { id: nuevoId("msg"), role: "assistant", text: texto, result, source },
    ]);
  }

  async function send(textValue = input) {
    const text = textValue.trim();
    if (!text) return;
    // Blindaje contra doble envío (doble click, Enter repetido, doble evento STT).
    if (enviandoRef.current || loading) return;

    try {
      enviandoRef.current = true;
      stopSpeaking();
      lastUserTextRef.current = text;

      setMessages((current) => [...current, { id: nuevoId("msg"), role: "user", text }]);
      setInput("");
      setLoading(true);
      setError("");
      setPending(null);
      setFase("PARSING");

      const response = await fetch("/api/asistente/voice360", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: text, draft }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "No se pudo procesar la orden");

      // El servidor SIEMPRE manda `draft` (y `null` sólo para descartarlo de
      // verdad, p. ej. al cancelar). Si por lo que sea el campo no viniera, se
      // CONSERVA el borrador que ya estaba en pantalla: una respuesta que no
      // habla del borrador no puede hacerlo desaparecer. Antes un `data.draft
      // ?? null` incondicional borraba el presupuesto a medio dictar en cuanto
      // llegaba un turno de consulta, y el siguiente decía "no hay borrador".
      const traeDraft = Object.prototype.hasOwnProperty.call(data, "draft");
      const draftNuevo: Voice360Draft | null = traeDraft ? (data.draft ?? null) : draft;
      const totalsNuevo: Totals | null = traeDraft
        ? (data.totals ?? recalcular(draftNuevo))
        : totals;

      setDraft(draftNuevo);
      setTotals(totalsNuevo);
      setPending(data.pending_action ?? null);
      anadirMensajeAsistente(data.answer, data.result, (data.source as AnswerSource) ?? "engine");

      // Transición de estado: NUNCA de PARSING a SAVED.
      if (data.pending_action) {
        setFase("AWAITING_CONFIRMATION");
      } else if (draftNuevo && draftNuevo.items.length > 0) {
        setFase("DRAFT_READY");
      } else if (data.intent === "electricista:budget_cancel") {
        setFase("CANCELLED");
        setEditando(false);
      } else {
        setFase("IDLE");
      }

      readAloud(data.answer);
    } catch (cause) {
      setFase("ERROR");
      setError(cause instanceof Error ? cause.message : "Error de conexión");
    } finally {
      setLoading(false);
      enviandoRef.current = false;
    }
  }

  /**
   * Guarda el borrador tras la confirmación explícita.
   *
   * Se envía el borrador ACTUAL (puede haber sido editado a mano después de
   * abrir la puerta) junto con el token. El servidor recalcula los importes y
   * consume el token UNA sola vez: repetir la llamada no duplica el presupuesto.
   */
  async function confirmAction() {
    // Cerrojo síncrono: una confirmación como máximo, aunque se pulse varias
    // veces en el mismo tick o el navegador reintente la petición.
    if (confirmandoRef.current) return;
    if (!pending || loading) return;
    confirmandoRef.current = true;
    const action = pending;
    try {
      setLoading(true);
      setFase("SAVING");
      setError("");

      const response = await fetch("/api/asistente/voice360", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm_token: action.token, draft }),
      });
      const data = await response.json();

      if (!response.ok) {
        // P. ej. precios pendientes: NO se ha guardado nada y el token sigue vivo.
        setFase(data.draft ? "DRAFT_READY" : "ERROR");
        if (data.draft) setDraft(data.draft);
        throw new Error(data.error || "No se pudo confirmar la acción");
      }

      setPending(null);
      setEditando(false);
      setFase("SAVED");
      anadirMensajeAsistente(data.answer, data.result, "engine");
      // El borrador ya está guardado: se retira de pantalla para no confundir.
      setDraft(null);
      setTotals(null);
      setShowDraft(false);
      readAloud(data.answer);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error al confirmar");
    } finally {
      setLoading(false);
      // Se libera SIEMPRE: si la confirmación falló (p. ej. precios pendientes) el
      // token sigue vivo y el usuario debe poder reintentar.
      confirmandoRef.current = false;
    }
  }

  /** [Cancelar]: descarta el borrador en memoria. No escribe nada. */
  async function cancelarBorrador() {
    setPending(null);
    setEditando(false);
    setDraft(null);
    setTotals(null);
    setShowDraft(false);
    setFase("CANCELLED");
    await send("cancela");
  }

  /** [Guardar presupuesto]: abre la puerta de confirmación. NO guarda aún. */
  async function pedirConfirmacion() {
    if (!draft || draft.items.length === 0) return;
    if (totals && totals.incomplete.length > 0) {
      setError(
        `Faltan precios para: ${totals.incomplete.join(", ")}. Complétalos antes de guardar (puedes decirlo por voz).`
      );
      setFase("ERROR");
      return;
    }
    setEditando(false);
    await send("guardar");
  }

  // ── Edición manual del borrador (acciones visibles [Editar]) ───────────
  function actualizarDraft(mutar: (copia: Voice360Draft) => Voice360Draft) {
    setDraft((actual) => {
      if (!actual) return actual;
      const copia: Voice360Draft = {
        ...actual,
        items: actual.items.map((item) => ({ ...item })),
        notes: [...(actual.notes ?? [])],
      };
      const siguiente = mutar(copia);
      siguiente.revision = (actual.revision ?? 0) + 1;
      setTotals(recalcular(siguiente));
      return siguiente;
    });
    setFase("DRAFT_READY");
  }

  function cambiarLinea(id: string, campo: keyof Voice360Item, valor: string) {
    actualizarDraft((copia) => {
      copia.items = copia.items.map((item) => {
        if (item.id !== id) return item;
        if (campo === "description") return { ...item, description: valor };
        if (campo === "unit") return { ...item, unit: valor };
        if (campo === "quantity") {
          const cantidad = Number(valor.replace(",", "."));
          return { ...item, quantity: Number.isFinite(cantidad) && cantidad > 0 ? cantidad : item.quantity };
        }
        const precio = valor.trim() === "" ? null : Number(valor.replace(",", "."));
        return {
          ...item,
          unit_price: precio !== null && Number.isFinite(precio) && precio >= 0 ? precio : null,
        };
      });
      return copia;
    });
  }

  function quitarLinea(id: string) {
    actualizarDraft((copia) => {
      copia.items = copia.items.filter((item) => item.id !== id);
      return copia;
    });
  }

  function anadirLinea() {
    actualizarDraft((copia) => {
      copia.items = [
        ...copia.items,
        { id: nuevoId("line"), description: "Nueva línea", quantity: 1, unit: "ud", unit_price: null },
      ];
      return copia;
    });
  }

  function cambiarIva(valor: string) {
    const tipo = Number(valor.replace(",", "."));
    if (!Number.isFinite(tipo) || tipo < 0 || tipo > 100) return;
    actualizarDraft((copia) => {
      copia.tax_rate = tipo;
      return copia;
    });
  }

  function cambiarObservaciones(texto: string) {
    actualizarDraft((copia) => {
      copia.notes = texto.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
      return copia;
    });
  }

  // ── GEMINI LIVE CON PCM REAL ─────────────────────────────────────────────
  // micrófono -> 16 kHz Int16 LE -> Gemini -> 24 kHz -> altavoz.
  // NO hace ninguna acción de negocio: sólo audio.
  /**
   * Arranca la sesión Live.
   *
   * IMPORTANTE: la parte de AUDIO es SÍNCRONA y ocurre dentro del gesto del clic.
   * El AudioContext tiene que nacer aquí: si se crea después de los `await` (token,
   * WebSocket, permiso de micrófono) la activación por gesto ya expiró, el contexto
   * queda `suspended` y la reproducción NO SUENA aunque todo lo demás funcione.
   * Ésa era la causa del "escucha y reconoce pero no se oye a Gemini".
   */
  /**
   * Devuelve la sesión Live, creándola si aún no existe.
   *
   * Se crea SIN arrancarla a propósito: así el botón «PROBAR ALTAVOZ» puede usar
   * el MISMO AudioContext y destination que usará Gemini, sin abrir sesión ni
   * gastar token. La prueba de altavoz y la conversación comparten instancia.
   */
  function obtenerSesionLive(): SesionLivePcm {
    if (sesionLiveRef.current) return sesionLiveRef.current;
    const sesion = new SesionLivePcm({
      onEstado: (e) => setEstadoLive(e),
      onError: (codigo) => {
        // Se muestra la FAMILIA del error (permiso, conexión, token, captura,
        // reproducción, formato) y un mensaje accionable. Nunca tokens ni claves.
        const { mensaje } = clasificarErrorPcm(codigo);
        setAvisoLive(mensaje);
      },
      onTranscripcion: (t) => {
        if (t.salida) anadirMensajeAsistente(t.salida, undefined, "engine");
      },
      onMetricas: (m) => {
        setAvisoLive(
          `setup ${m.setup_ms ?? "?"} ms · 1er audio ${m.first_audio_output_ms ?? "?"} ms · ` +
            `chunks in ${m.input_chunks} / out ${m.output_chunks}`
        );
      },
    });
    sesionLiveRef.current = sesion;
    return sesion;
  }

  function iniciarLive(): void {
    // No se solapa con la voz de Voz 360 ni con su motor.
    stopSpeaking();
    const sesion = obtenerSesionLive();

    // ── DENTRO DEL GESTO (síncrono, antes de cualquier await) ────────────────
    sesion.prepararAudioEnGesto();
    setTasaHardware(sesion.sampleRateHardware || null);
    setDiag(sesion.diagnostico);

    const yaActiva = sesion.estado !== "DISCONNECTED" && sesion.estado !== "ERROR";
    if (yaActiva) return;

    setAvisoLive("");
    // El resto del arranque sí es asíncrono.
    void sesion
      .iniciar()
      .then(() => {
        setTasaHardware(sesion.sampleRateHardware);
        setDiag(sesion.diagnostico);
      })
      .catch((causa) => {
        setEstadoLive("DISCONNECTED");
        const codigo = causa instanceof Error ? causa.message : String(causa);
        setAvisoLive(clasificarErrorPcm(codigo).mensaje);
      });
  }

  /**
   * PRUEBA DE ALTAVOZ (diagnóstico, sin Gemini).
   *
   * Separa en segundos los dos mundos que se confunden:
   *   - el tono SUENA  -> el móvil puede reproducir; el fallo está en el camino
   *     de Gemini (formato/cola/chunks);
   *   - el tono NO suena -> el problema es AudioContext/WebView/routing/volumen,
   *     y ninguna corrección en Gemini lo arreglaría.
   *
   * Usa el MISMO AudioContext y destination que Gemini. Síncrono en el gesto.
   */
  function probarAltavoz(): void {
    const sesion = obtenerSesionLive();
    sesion.prepararAudioEnGesto();
    sesion.probarAltavoz();
    setTasaHardware(sesion.sampleRateHardware || null);
    setDiag(sesion.diagnostico);
    // Se relee al momento y un poco después: así se ve si `onended` llegó
    // (señal de que el RELOJ de audio avanza de verdad).
    setTimeout(() => setDiag(sesionLiveRef.current?.diagnostico ?? null), 250);
    setTimeout(() => setDiag(sesionLiveRef.current?.diagnostico ?? null), 1400);
  }

  /**
   * Diagnóstico A-O en UNA línea, para poder leerlo desde el móvil.
   * Es la evidencia de si el audio llega y si llega a sonar.
   */
  function resumenDiagnostico(d: DiagnosticoPcm): string {
    return (
      `A gemini=${d.geminiGeneraAudio ? "SÍ" : "NO"} · ` +
      `B/C chunks=${d.chunksRecibidos} (reproducidos ${d.chunksReproducidos}) · ` +
      `D bytes=${d.bytesRecibidos} · E mime=${d.mimeTypeReal ?? "—"} · ` +
      `F rate=${d.sampleRateReal ?? "—"} · G int16=${d.conversionInt16Ok ? "OK" : "NO"} · ` +
      `H buffers=${d.audioBuffersCreados} · I start=${d.startEjecutados} · ` +
      `J ctx=${d.audioContextState} · K dest=${d.conectadoADestination ? "SÍ" : "NO"} · ` +
      `L err=${d.erroresReproduccion.length ? d.erroresReproduccion[0] : "ninguno"} · ` +
      `M autoplay=${d.autoplay} · N gain=${d.gain} · O speaking=${d.llegoASpeaking ? "SÍ" : "NO"}`
    );
  }

  /**
   * Botón único: abre o cierra la sesión.
   *
   * Con la ESCUCHA CONTINUA ya no hace falta un toque por turno: mientras la
   * sesión está abierta, la captura va sola y el turno se cierra por silencio
   * (1,5 s) volviendo después a LISTENING sobre la misma conexión.
   */
  function alternarLive() {
    const actual = estadoLive;
    if (actual === "DISCONNECTED" || actual === "ERROR") {
      // SIN await: iniciarLive() crea el AudioContext de forma síncrona dentro de
      // este gesto. Si se esperara aquí, el contexto nacería suspendido.
      iniciarLive();
      return;
    }
    // Cualquier otro estado: se cierra la sesión (cortando audio y soltando el micro).
    sesionLiveRef.current?.cancelar();
    sesionLiveRef.current = null;
    setEstadoLive("DISCONNECTED");
    setAvisoLive("");
  }

  function reset() {
    stopSpeaking();
    cancelarVueltaAEscuchar();
    setManosLibres(false);
    setAvisoManosLibres("");
    transcriptRecibidoRef.current = false;
    intentosVaciosRef.current = 0;
    setDraft(null);
    setTotals(null);
    setPending(null);
    setInput("");
    setError("");
    setShowDraft(false);
    setEditando(false);
    setFase("IDLE");
    setMessages([
      { id: nuevoId("msg"), role: "assistant", text: "Nueva conversación. ¿Qué necesitas?" },
    ]);
  }

  const estiloFase = FASE_ESTILO[fase];

  // ── Panel del borrador (overlay en móvil, columna en desktop) ──────────
  const draftPanel = (
    <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-white">
          {draft && draft.items.length > 0 ? (
            <span className="text-emerald-300">📝 BORRADOR — SIN GUARDAR</span>
          ) : (
            "📋 Borrador"
          )}
        </h2>
        <div className="flex items-center gap-2">
          {draft && <span className="text-xs text-slate-400">v{draft.revision}</span>}
          <button
            type="button"
            onClick={() => setShowDraft(false)}
            className="lg:hidden rounded-lg border border-slate-700 p-1 text-slate-400"
            aria-label="Cerrar borrador"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!draft || draft.items.length === 0 ? (
        <p className="text-sm text-slate-400">
          Aún no hay borrador. Dicta por ejemplo: «Presupuesto para Juan Pérez: 4 enchufes a 18 euros».
          Nada se guarda hasta que lo confirmes.
        </p>
      ) : (
        <>
          {/* Cliente */}
          <div className="rounded-xl bg-slate-950 p-3 text-sm text-slate-300">
            <p className="flex items-center justify-between gap-2">
              <span>
                <strong>Cliente:</strong>{" "}
                {draft.client_name ? (
                  draft.client_name
                ) : (
                  <span className="text-amber-300">Sin indicar — di «el cliente es …»</span>
                )}
              </span>
            </p>
            {draft.client_candidates.length > 1 && (
              <p className="mt-1 text-xs text-amber-300">
                Posibles coincidencias: {draft.client_candidates.map((c, i) => `${i + 1}. ${c.name}`).join(" · ")}
              </p>
            )}
          </div>

          {/* Líneas */}
          <div className="space-y-2">
            {draft.items.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-700 p-3 text-sm">
                {editando ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        value={item.description}
                        onChange={(e) => cambiarLinea(item.id, "description", e.target.value)}
                        className="min-h-[44px] w-full rounded-lg border border-slate-600 bg-slate-950 px-2 text-white"
                        aria-label="Descripción de la línea"
                      />
                      <button
                        type="button"
                        onClick={() => quitarLinea(item.id)}
                        className="min-h-[44px] shrink-0 rounded-lg border border-rose-700 px-3 text-rose-300"
                        aria-label="Quitar línea"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="text-xs text-slate-400">
                        Cantidad
                        <input
                          value={String(item.quantity)}
                          onChange={(e) => cambiarLinea(item.id, "quantity", e.target.value)}
                          inputMode="decimal"
                          className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-600 bg-slate-950 px-2 text-white"
                        />
                      </label>
                      <label className="text-xs text-slate-400">
                        Unidad
                        <input
                          value={item.unit}
                          onChange={(e) => cambiarLinea(item.id, "unit", e.target.value)}
                          className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-600 bg-slate-950 px-2 text-white"
                        />
                      </label>
                      <label className="text-xs text-slate-400">
                        €/ud
                        <input
                          value={item.unit_price === null || item.unit_price === undefined ? "" : String(item.unit_price)}
                          onChange={(e) => cambiarLinea(item.id, "unit_price", e.target.value)}
                          inputMode="decimal"
                          placeholder="pendiente"
                          className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-600 bg-slate-950 px-2 text-white"
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="font-medium text-white leading-snug">
                      {item.quantity} {item.unit} · {item.description}
                    </p>
                    <p
                      className={
                        item.unit_price === null || item.unit_price === undefined
                          ? "text-amber-300 text-xs mt-0.5"
                          : "text-emerald-300 text-xs mt-0.5"
                      }
                    >
                      {item.unit_price === null || item.unit_price === undefined
                        ? "⚠️ Precio pendiente — dilo por voz: «el detector son 25 euros»"
                        : `${euros(item.unit_price)}/ud · Subtotal: ${euros(item.unit_price * item.quantity)}`}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>

          {editando && (
            <button
              type="button"
              onClick={anadirLinea}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-slate-600 text-sm text-slate-200"
            >
              <Plus className="h-4 w-4" />
              Añadir línea
            </button>
          )}

          {/* Totales */}
          <div className="rounded-xl bg-slate-950 p-3 text-sm text-slate-300 space-y-1">
            <p className="flex justify-between">
              <span>Base imponible</span>
              <span>{totals ? euros(totals.subtotal) : "—"}</span>
            </p>
            <p className="flex items-center justify-between gap-2">
              <span>IVA</span>
              {editando ? (
                <span className="flex items-center gap-1">
                  <input
                    value={String(draft.tax_rate)}
                    onChange={(e) => cambiarIva(e.target.value)}
                    inputMode="decimal"
                    className="min-h-[40px] w-20 rounded-lg border border-slate-600 bg-slate-900 px-2 text-right text-white"
                    aria-label="Tipo de IVA"
                  />
                  <span>%</span>
                </span>
              ) : (
                <span>
                  {draft.tax_rate} % · {totals ? euros(totals.tax_amount) : "—"}
                </span>
              )}
            </p>
            <p className="mt-1 flex justify-between text-xl font-black text-white">
              <span>Total</span>
              <span>{totals ? euros(totals.total) : "—"}</span>
            </p>
            {totals && totals.incomplete.length > 0 && (
              <p className="text-amber-300 text-xs">
                ⚠️ Sin precio: {totals.incomplete.join(", ")}. El total no está completo.
              </p>
            )}
          </div>

          {/* Observaciones */}
          <label className="block text-xs text-slate-400">
            Observaciones
            <textarea
              value={observaciones}
              onChange={(e) => cambiarObservaciones(e.target.value)}
              rows={2}
              placeholder="Notas para el presupuesto (opcional)"
              className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-950 p-2 text-sm text-white outline-none focus:border-emerald-500 resize-none"
            />
          </label>

          {/* Acciones: [Editar] [Guardar presupuesto] [Cancelar] */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setEditando((v) => !v)}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-600 text-sm text-slate-200"
            >
              <Pencil className="h-4 w-4" />
              {editando ? "Hecho" : "Editar"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void pedirConfirmacion()}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-bold text-white disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Guardar presupuesto
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void cancelarBorrador()}
              className="col-span-2 min-h-[48px] rounded-xl border border-slate-600 text-sm text-slate-200"
            >
              Cancelar
            </button>
          </div>
        </>
      )}

      {/* Confirmación obligatoria antes de escribir */}
      {pending && (
        <div className="rounded-xl border border-amber-600 bg-amber-950/40 p-3">
          <p className="text-xs font-bold uppercase text-amber-300 mb-1">
            ⚠️ Confirmación requerida — todavía NO se ha guardado
          </p>
          <p className="text-sm text-white mb-3 whitespace-pre-line">{pending.label}</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void confirmAction()}
              className="inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-sm font-bold text-white disabled:opacity-50 active:scale-95 transition-transform"
            >
              <Check className="h-4 w-4" />
              Confirmar y guardar
            </button>
            <button
              type="button"
              onClick={() => {
                setPending(null);
                setFase("DRAFT_READY");
              }}
              className="min-h-[48px] rounded-xl border border-slate-600 px-3 text-sm text-slate-200 active:scale-95 transition-transform"
            >
              No guardar
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-3 pb-24">
      {/* Header.
          MÓVIL (393 px): título arriba y controles debajo, con `flex-wrap`, para
          que NINGÚN botón de voz se salga de la pantalla. Antes era una sola fila
          `justify-between` sin wrap y los controles (GEMINI, PROBAR ALTAVOZ,
          Detener voz, Nueva conversación, Borrador) desbordaban el viewport. */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Breadcrumbs items={[{ label: "Asistente Voz 360" }]} />
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-black text-white sm:text-3xl">
            <Sparkles className="text-emerald-400" />
            Voz 360
          </h1>
          <p className="mt-0.5 text-xs text-slate-400">
            Electricista360 · Nada se guarda sin tu confirmación
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* Estado online/offline */}
          <span
            className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
              online ? "bg-emerald-900/50 text-emerald-300" : "bg-rose-900/50 text-rose-300"
            }`}
          >
            {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            <span className="hidden sm:inline">{online ? "Online" : "Sin conexión"}</span>
          </span>

          {/* TTS toggle */}
          <button
            type="button"
            onClick={() => {
              setSpeak((v) => {
                const next = !v;
                if (!next) stopSpeaking();
                return next;
              });
            }}
            className="rounded-xl border border-slate-700 p-2.5 text-slate-300 hover:border-slate-500 transition-colors"
            aria-label="Respuesta por voz"
          >
            {speak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>

          {/* GEMINI LIVE CON PCM REAL — estado QA visible mientras se valida en móvil */}
          <span
            className={`hidden sm:inline rounded-full px-2 py-1 text-xs font-medium ${
              estadoLive === "ERROR"
                ? "bg-rose-900/50 text-rose-300"
                : estadoLive === "DISCONNECTED"
                  ? "bg-slate-800 text-slate-400"
                  : "bg-indigo-900/50 text-indigo-200"
            }`}
            title="Estado del camino PCM: micrófono -> 16 kHz -> Gemini -> 24 kHz"
          >
            LIVE: {estadoLive}
            {tasaHardware ? ` · HW ${tasaHardware} Hz` : ""}
          </span>
          <button
            type="button"
            onClick={() => alternarLive()}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
              estadoLive === "LISTENING"
                ? "border-indigo-500 bg-indigo-950/60 text-indigo-200"
                : estadoLive === "DISCONNECTED"
                  ? "border-indigo-700 bg-indigo-900/30 text-indigo-200 hover:border-indigo-500"
                  : "border-indigo-500 bg-indigo-900/50 text-indigo-100"
            }`}
            aria-label="Hablar con Gemini (audio nativo)"
            title="HABLAR CON GEMINI (audio nativo). Pulsa una vez y habla: la respuesta se OYE y al terminar vuelve a escuchar solo. El micrófono de abajo es el dictado de Voz 360 (escribe texto, NO habla con Gemini)."
          >
            <Radio className="h-4 w-4" />
            GEMINI
          </button>

          {/* PRUEBA DE ALTAVOZ — diagnóstico sin Gemini */}
          <button
            type="button"
            onClick={() => probarAltavoz()}
            className="rounded-xl border border-amber-700/70 px-2.5 py-2 text-[11px] font-semibold text-amber-300 hover:border-amber-500 transition-colors"
            aria-label="Probar altavoz con un tono local"
            title="PROBAR ALTAVOZ: emite un tono corto por el MISMO AudioContext que usa Gemini. Sirve para saber si el problema es del móvil o de Gemini."
          >
            🔊 PROBAR ALTAVOZ
          </button>

          {/* CONVERSACIÓN CONTINUA (manos libres) */}
          <button
            type="button"
            onClick={() => alternarManosLibres()}
            aria-pressed={manosLibres}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
              manosLibres
                ? "border-emerald-500 bg-emerald-900/60 text-emerald-200"
                : "border-slate-600 bg-slate-900 text-slate-300 hover:border-emerald-600 hover:text-emerald-300"
            }`}
            aria-label="Conversación continua manos libres"
            title="MANOS LIBRES: al terminar de hablarte, el asistente vuelve a escuchar solo. Habla, espera la respuesta hablada y sigue hablando, sin tocar la pantalla. Para cuando quieras."
          >
            <Mic className="h-4 w-4" />
            {manosLibres ? "MANOS LIBRES: SÍ" : "MANOS LIBRES"}
          </button>

          {/* Cancelar/interrumpir la respuesta hablada */}
          {speaking && (
            <button
              type="button"
              onClick={stopSpeaking}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-700 bg-rose-950/60 px-3 py-2 text-xs font-medium text-rose-200 hover:border-rose-500 transition-colors"
              aria-label="Detener la respuesta por voz"
              title="Detener la respuesta por voz"
            >
              <Square className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Detener voz</span>
            </button>
          )}

          {/* Nueva conversación */}
          <button
            type="button"
            onClick={reset}
            className="rounded-xl border border-slate-700 p-2.5 text-slate-300 hover:border-slate-500 transition-colors"
            aria-label="Nueva conversación"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          {/* Mostrar borrador en móvil */}
          {draft && (
            <button
              type="button"
              onClick={() => setShowDraft((v) => !v)}
              className="lg:hidden rounded-xl border border-emerald-700 bg-emerald-900/40 px-3 py-2 text-xs font-medium text-emerald-300"
            >
              Borrador
            </button>
          )}
        </div>
      </header>

      {/* ── DIAGNÓSTICO DE VOZ (temporal, para validar en el móvil) ──────────
          Permite separar sin adivinar: "Gemini no manda audio" de "el móvil no
          lo reproduce". Lectura:
            · GEMINI AUDIO=NO            -> el problema está ANTES del reproductor
            · CHUNKS>0 y START=0         -> fallo en decoder/cola/playback
            · START sube y ENDED no      -> el reloj de audio está bloqueado
            · START y ENDED suben y no se oye -> routing/volumen/destination
            · CTX != running             -> AudioContext suspendido (autoplay)
      */}
      {(diag !== null || estadoLive !== "DISCONNECTED") && (
        <div className="rounded-xl border border-indigo-800/60 bg-slate-950 px-3 py-2 font-mono text-[11px] leading-5 text-indigo-200">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-bold text-indigo-300">DIAGNÓSTICO VOZ · Gemini Live</span>
            <span className="text-slate-400">{tasaHardware ? `HW ${tasaHardware} Hz` : "HW —"}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-3">
            <span>STATE=<b>{estadoLive}</b></span>
            <span>WS={diag?.wsEstado ?? "—"}</span>
            <span>CTX={diag?.audioContextState ?? "—"}</span>
            <span>MIC={diag?.micEstado ?? "—"}</span>
            <span>GEMINI AUDIO={diag?.geminiGeneraAudio ? "YES" : "NO"}</span>
            <span>CHUNKS={diag?.chunksRecibidos ?? 0}</span>
            <span>BYTES={diag?.bytesRecibidos ?? 0}</span>
            <span>BUFFERS={diag?.audioBuffersCreados ?? 0}</span>
            <span>START={diag?.startEjecutados ?? 0}</span>
            <span>ENDED={diag?.chunksReproducidos ?? 0}</span>
            <span>DESTINATION={diag?.conectadoADestination ? "YES" : "NO"}</span>
            <span>OUTPUT RATE={diag?.sampleRateReal ?? "—"}</span>
            <span>PLAYING={diag?.playing ? "YES" : "NO"}</span>
            <span className={(diag?.erroresReproduccion.length ?? 0) > 0 ? "text-rose-300" : ""}>
              ERROR={diag?.erroresReproduccion.length ? diag.erroresReproduccion[0] : "NONE"}
            </span>
          </div>
          <div className="mt-1 text-amber-300">
            PROBAR ALTAVOZ:{" "}
            {diag?.tono.lanzado
              ? diag.tono.terminado
                ? "SONÓ (el reloj de audio avanza)"
                : "lanzado SIN onended (reproductor bloqueado)"
              : "no probado"}
            {diag?.tono.error ? ` · error: ${diag.tono.error}` : ""}
          </div>
        </div>
      )}

      {/* Estado del flujo */}
      <div className={`rounded-xl border px-3 py-2 text-xs font-medium ${estiloFase.clase}`}>
        {estiloFase.texto}
      </div>

      {/* Estado de la conversación continua: nunca cambia en silencio. */}
      {(manosLibres || avisoManosLibres) && (
        <div
          className={`rounded-xl border px-3 py-2 text-xs ${
            avisoManosLibres
              ? "border-amber-700 bg-amber-950/40 text-amber-200"
              : "border-emerald-700/70 bg-emerald-950/30 text-emerald-200"
          }`}
        >
          {avisoManosLibres
            ? `⚠️ ${avisoManosLibres}`
            : "🎙️ Manos libres ACTIVO: habla y el asistente te responde en voz alta y vuelve a escuchar solo. Pulsa MANOS LIBRES para parar."}
        </div>
      )}

      {/* Sugerencias rápidas */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            disabled={loading}
            onClick={() => void send(s)}
            className="shrink-0 rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 hover:border-emerald-600 hover:text-emerald-300 transition-colors disabled:opacity-40"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Layout principal */}
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        {/* Panel de chat */}
        <section className="flex min-h-[32rem] flex-col rounded-2xl border border-slate-700 bg-slate-900/90 p-3 sm:p-5">
          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" && (
                  <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-700">
                    <Bot className="h-4 w-4" />
                  </span>
                )}
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                    message.role === "user"
                      ? "bg-emerald-700 text-white"
                      : "border border-slate-700 bg-slate-800 text-slate-200"
                  }`}
                >
                  {message.text}
                  {message.role === "assistant" && message.source && (
                    <span
                      className={`mt-2 block text-[10px] font-medium uppercase tracking-wide ${
                        message.source === "ai" ? "text-emerald-400" : "text-slate-500"
                      }`}
                    >
                      {SOURCE_LABELS[message.source] ?? message.source}
                    </span>
                  )}
                  {Array.isArray(message.result) && (
                    <div className="mt-2 space-y-1 border-t border-slate-600 pt-2 text-xs">
                      {(message.result as Record<string, unknown>[]).map((row, i) => (
                        <div key={i}>
                          {Object.entries(row)
                            .filter(([, v]) => v !== null)
                            .map(([k, v]) => `${k}: ${String(v)}`)
                            .join(" · ")}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2 justify-start">
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-700">
                  <Bot className="h-4 w-4" />
                </span>
                <div className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-2 w-2 rounded-full bg-emerald-400 animate-bounce"
                        style={{ animationDelay: `${i * 120}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Error + recuperación: se puede reintentar sin volver a dictar */}
          {error && (
            <div
              role="alert"
              className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-rose-950 p-3 text-sm text-rose-200"
            >
              <span className="flex-1">⚠️ {error}</span>
              {lastUserTextRef.current && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void send(lastUserTextRef.current)}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-rose-700 px-3 text-xs font-medium text-rose-100 disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reintentar
                </button>
              )}
            </div>
          )}

          {/* Formulario */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="mt-4 border-t border-slate-700 pt-3"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              disabled={loading}
              rows={2}
              placeholder="Habla o escribe tu orden…"
              className="w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-base text-white outline-none focus:border-emerald-500 resize-none"
            />
            <div className="mt-2 flex gap-2">
              <VoiceDictation
                escuchaSolicitada={escuchaSolicitada}
                onTranscriptComplete={(transcript) => {
                  setInput((prev) => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
                  transcriptRecibidoRef.current = true;
                  intentosVaciosRef.current = 0;
                  setFase("TRANSCRIBED");
                  if (manosLibresRef.current) {
                    setInput("");
                    const enviarVoz = send;
                    void enviarVoz(transcript);
                    return;
                  }
                  textareaRef.current?.focus();
                }}
                onListeningStart={() => {
                  stopSpeaking();
                  setFase("LISTENING");
                  // P0.1: prueba únicamente la sesión/protocolo. Si el flag está
                  // apagado o Gemini falla, el dictado Voz360 continúa igual.
                  void defaultGeminiLiveClient.connect().catch(() => undefined);
                }}
                onListeningEnd={() => {
                  setFase((actual) => (actual === "LISTENING" ? "TRANSCRIBED" : actual));
                  if (!manosLibresRef.current) return;
                  // El turno se cerró SIN texto (silencio, ruido, motor mudo): en
                  // manos libres hay que volver a escuchar, pero con tope. Sin tope,
                  // un micrófono que no reconoce nada giraría en bucle para siempre.
                  if (transcriptRecibidoRef.current) {
                    transcriptRecibidoRef.current = false;
                    return;
                  }
                  if (loadingRef.current) return;
                  intentosVaciosRef.current += 1;
                  if (intentosVaciosRef.current > 3) {
                    setManosLibres(false);
                    setAvisoManosLibres("No te he oído en varios turnos. Manos libres desactivado.");
                    return;
                  }
                  setEscuchaSolicitada((n) => n + 1);
                }}
                onError={(mensaje) => {
                  // El dictado falló (permiso, motor sin respuesta, error del
                  // reconocedor): se informa y se corta cualquier voz, para que el
                  // estado quede recuperable y el micro se pueda volver a pulsar.
                  stopSpeaking();
                  cancelarVueltaAEscuchar();
                  setError(mensaje);
                  setFase("ERROR");
                  // Un error (permiso denegado, sin motor) NO se reintenta solo:
                  // volver a escuchar en bucle sólo repetiría el mismo fallo.
                  if (manosLibresRef.current) {
                    setManosLibres(false);
                    setAvisoManosLibres("Manos libres desactivado por un error del micrófono.");
                  }
                }}
                disabled={loading}
                className="min-h-[52px] px-5 text-sm flex-shrink-0"
              />
              <button
                disabled={loading || !input.trim()}
                className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 font-bold text-white disabled:opacity-50 active:scale-95 transition-transform"
              >
                <Send className="h-4 w-4" />
                Enviar
              </button>
            </div>
          </form>
        </section>

        {/* Panel de borrador — visible en desktop siempre, en móvil sólo cuando showDraft */}
        <div className={`${showDraft ? "block" : "hidden"} lg:block`}>{draftPanel}</div>
      </div>

      {/* Nota de estado offline */}
      {!online && (
        <div className="rounded-xl border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">
          <WifiOff className="inline h-4 w-4 mr-1" />
          Sin conexión. El asistente no puede procesar órdenes hasta que se restablezca la conexión.
        </div>
      )}

      {/* Indicador de proyecto */}
      <p className="text-center text-xs text-slate-600">
        Electricista360 · Voz 360 · Motor autónomo local
      </p>
    </div>
  );
}
