/**
 * VOZ 360 — NÚCLEO DE AUDIO (P0-1 STT + P0-2 TTS)
 *
 * POR QUÉ EXISTE
 * Los dos P0 de audio ("escucha una vez y se para", "habla una vez y el ciclo
 * queda bloqueado") se debían a estado de sesión que vivía suelto: banderas
 * mutables dentro del componente, temporizadores armados a mano y ningún sitio
 * donde estuviera escrito QUÉ transiciones eran legales. Ese estado no se podía
 * probar sin móvil, así que nadie lo probaba.
 *
 * Aquí vive la ÚNICA autoridad del ciclo de audio: una sesión de dictado y una
 * locución. Es lógica PURA (sin React, sin Android, sin timers del sistema): el
 * reloj y los temporizadores se INYECTAN, de modo que los 10 ciclos consecutivos
 * se pueden ejecutar de verdad en un test, en microsegundos y sin dispositivo.
 *
 * INVARIANTES QUE GARANTIZA
 *  - Nunca hay dos sesiones de dictado a la vez, y una sesión COLGADA (sin eventos)
 *    no puede bloquear el arranque siguiente: se cierra a la fuerza.
 *  - Nunca hay dos locuciones a la vez: abrir una corta la anterior.
 *  - El fin de locución es IDEMPOTENTE: fin normal, error, cancelación o watchdog
 *    producen un solo cierre.
 *  - `hablando` nunca puede quedarse en true: siempre hay un watchdog que cierra.
 *  - Todo cierre limpia sus temporizadores: no quedan timers huérfanos.
 *  - Cualquier error deja el núcleo REUTILIZABLE (mismo estado que tras un cierre).
 */

import type { Utterance } from "@/packages/voz360-client-sdk/utterance";

/** Reloj inyectable: los tests usan uno falso, la app usa el del navegador. */
export interface RelojVoz {
  ahora(): number;
  programar(fn: () => void, ms: number): number;
  cancelar(id: number): void;
}

/** Reloj real (navegador / WebView). */
export const relojNavegador: RelojVoz = {
  ahora: () => Date.now(),
  programar: (fn, ms) => (typeof window === "undefined" ? 0 : window.setTimeout(fn, ms)),
  cancelar: (id) => {
    if (typeof window !== "undefined" && id) window.clearTimeout(id);
  },
};

/** Reloj determinista para tests y para simulación (avanza a mano). */
export class RelojFalso implements RelojVoz {
  private t = 0;
  private siguienteId = 1;
  private pendientes = new Map<number, { en: number; fn: () => void }>();

  ahora(): number {
    return this.t;
  }

  programar(fn: () => void, ms: number): number {
    const id = this.siguienteId++;
    this.pendientes.set(id, { en: this.t + Math.max(0, ms), fn });
    return id;
  }

  cancelar(id: number): void {
    this.pendientes.delete(id);
  }

  /** Temporizadores vivos: sirve para demostrar que no quedan huérfanos. */
  get pendientesCount(): number {
    return this.pendientes.size;
  }

  /** Avanza el tiempo disparando los temporizadores que vencen. */
  avanzar(ms: number): void {
    const destino = this.t + ms;
    for (;;) {
      const proximo = [...this.pendientes.entries()]
        .filter(([, tarea]) => tarea.en <= destino)
        .sort((a, b) => a[1].en - b[1].en)[0];
      if (!proximo) break;
      const [id, tarea] = proximo;
      this.pendientes.delete(id);
      this.t = tarea.en;
      tarea.fn();
    }
    this.t = destino;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// P0-1 · SESIÓN DE DICTADO
// ────────────────────────────────────────────────────────────────────────────

/** Una sesión sin eventos durante este tiempo está COLGADA (el motor no contesta). */
export const SESION_COLGADA_MS = 1000;
/** Espera máxima de la confirmación de arranque que envía el puente nativo. */
export const ESPERA_CONFIRMACION_MS = 3500;

export type MotivoCierreStt =
  | "manual"
  | "detenido"
  | "silencio"
  | "timeout"
  | "error"
  | "cancelado"
  | "colgada";

export interface Voz360SttSessionOpciones {
  reloj?: RelojVoz;
  /** Se llama si el puente no confirma el arranque dentro de `ESPERA_CONFIRMACION_MS`. */
  onArranqueSinConfirmar?: () => void;
}

/**
 * Sesión de dictado (vía nativa). Mantiene EXACTAMENTE los mismos campos que
 * antes vivían en el ref del componente (`activo`, `finalizado`, `base`, `actual`,
 * `inicio`, `ultimaVoz`, `latido`) para no cambiar el contrato que consume la
 * pantalla, pero las reglas del ciclo son métodos y se pueden probar.
 */
export class Voz360SttSession {
  /** ¿Hay una escucha abierta? */
  activo = false;
  /** ¿Se ha cerrado el turno? (evita entregar dos veces) */
  finalizado = false;
  /** Lo acumulado antes de un reinicio del motor. */
  base: Utterance;
  /** Lo reconocido en la sesión actual. */
  actual: Utterance;
  inicio = 0;
  ultimaVoz = 0;
  latido: number | null = null;

  private readonly reloj: RelojVoz;
  private readonly onArranqueSinConfirmar?: () => void;
  /** Último evento recibido del puente (para detectar sesiones colgadas). */
  private ultimoEvento = 0;
  /** ¿El puente ha confirmado que está escuchando de verdad? */
  private confirmada = false;
  private temporizadorConfirmacion: number | null = null;
  /** Cierres solicitados: sirve para demostrar la idempotencia en los tests. */
  private cierres = 0;

  constructor(vacio: Utterance, opciones: Voz360SttSessionOpciones = {}) {
    this.base = vacio;
    this.actual = vacio;
    this.reloj = opciones.reloj ?? relojNavegador;
    this.onArranqueSinConfirmar = opciones.onArranqueSinConfirmar;
  }

  /** Número de cierres efectivos (0 o 1 por turno). */
  get cierresEfectivos(): number {
    return this.cierres;
  }

  /** ¿La sesión está viva (abierta y con actividad reciente)? */
  sesionViva(): boolean {
    return this.activo && !this.finalizado && this.reloj.ahora() - this.ultimoEvento < SESION_COLGADA_MS;
  }

  /**
   * ¿Se puede arrancar una escucha nueva?
   *  - `false`: hay una escucha VIVA (nunca dos a la vez).
   *  - `true`:  no hay nada, o lo que hay está COLGADO y el llamador debe cerrarlo
   *             a la fuerza antes de arrancar (esto es P0-1: "start() autocurable").
   */
  puedeArrancar(): boolean {
    return !this.sesionViva();
  }

  /** ¿Hay que cerrar a la fuerza antes de arrancar (sesión colgada)? */
  necesitaCierreForzado(): boolean {
    return this.activo && !this.sesionViva();
  }

  /** Abre una sesión limpia: es el estado EXACTO de un primer turno. */
  abrir(): void {
    this.limpiarTemporizadores();
    this.activo = true;
    this.finalizado = false;
    this.confirmada = false;
    this.cierres = 0;
    this.inicio = this.reloj.ahora();
    this.ultimaVoz = this.inicio;
    this.ultimoEvento = this.inicio;
  }

  /** Cualquier evento del puente cuenta como actividad (anti-colgado). */
  marcarEvento(): void {
    this.ultimoEvento = this.reloj.ahora();
  }

  /** El puente ha confirmado que está escuchando: el arranque es REAL. */
  confirmarArranque(): void {
    this.confirmada = true;
    this.marcarEvento();
    this.cancelarConfirmacion();
  }

  get arranqueConfirmado(): boolean {
    return this.confirmada;
  }

  /**
   * Exige confirmación de arranque: si el puente no dice nada, se avisa por
   * callback para que la pantalla corte el intento y LIBERE el micrófono.
   */
  programarConfirmacion(): void {
    this.cancelarConfirmacion();
    this.temporizadorConfirmacion = this.reloj.programar(() => {
      this.temporizadorConfirmacion = null;
      if (this.confirmada || this.finalizado || !this.activo) return;
      this.onArranqueSinConfirmar?.();
    }, ESPERA_CONFIRMACION_MS);
  }

  /**
   * Cierra la sesión UNA sola vez. Es idempotente, así que da igual cuántos
   * caminos concurran (Detener, latido, watchdog, error, cancelar).
   * Devuelve `true` si este llamador ha cerrado la sesión (y debe entregar).
   */
  cerrar(_motivo: MotivoCierreStt): boolean {
    this.limpiarTemporizadores();
    if (this.finalizado) return false;
    this.finalizado = true;
    this.activo = false;
    this.confirmada = false;
    this.cierres += 1;
    return true;
  }

  /** Cierra sin entregar nada y descarta lo reconocido (cancelar / permiso). */
  descartar(): void {
    this.cerrar("cancelado");
    this.actual = this.base;
  }

  /** Deja la sesión como recién creada (tras entregar el turno). */
  reiniciar(vacio: Utterance): void {
    this.limpiarTemporizadores();
    this.activo = false;
    this.finalizado = false;
    this.confirmada = false;
    this.cierres = 0;
    this.base = vacio;
    this.actual = vacio;
    this.inicio = 0;
    this.ultimaVoz = 0;
  }

  /** Cancela TODOS los temporizadores de la sesión (latido y confirmación). */
  limpiarTemporizadores(): void {
    if (this.latido !== null) {
      clearIntervalSeguro(this.latido);
      this.latido = null;
    }
    this.cancelarConfirmacion();
  }

  private cancelarConfirmacion(): void {
    if (this.temporizadorConfirmacion !== null) {
      this.reloj.cancelar(this.temporizadorConfirmacion);
      this.temporizadorConfirmacion = null;
    }
  }
}

/** El latido es un intervalo real; se aísla para poder limpiarlo sin depender del DOM. */
function clearIntervalSeguro(id: number): void {
  if (typeof window !== "undefined" && id) window.clearInterval(id);
}

// ────────────────────────────────────────────────────────────────────────────
// P0-2 · LOCUCIÓN (TTS)
// ────────────────────────────────────────────────────────────────────────────

/** Margen del watchdog de locución: crece con el texto y está acotado. */
export function esperaLocucionMs(caracteres: number): number {
  const estimado = 2500 + Math.max(0, caracteres) * 160;
  return Math.min(estimado, 65000);
}

export interface Voz360TtsGuardOpciones {
  reloj?: RelojVoz;
  /** La pantalla enciende/apaga su indicador con esto (nunca se queda encendido). */
  onHablando?: (hablando: boolean) => void;
}

/**
 * Guarda de la locución: una sola activa, fin idempotente y watchdog.
 *
 * El motor de TTS de Android no garantiza `onDone` (y puede devolver ERROR sin
 * llamar a nadie). Sin esta guarda, `speaking` se quedaba en true para siempre y
 * el ciclo de voz dejaba de responder: es la causa raíz de P0-2.
 */
export class Voz360TtsGuard {
  private readonly reloj: RelojVoz;
  private readonly onHablando?: (hablando: boolean) => void;
  private hablando = false;
  private watchdog: number | null = null;
  private finalizaciones = 0;
  private inicio = 0;
  private caracteres = 0;

  constructor(opciones: Voz360TtsGuardOpciones = {}) {
    this.reloj = opciones.reloj ?? relojNavegador;
    this.onHablando = opciones.onHablando;
  }

  get estaHablando(): boolean {
    return this.hablando;
  }

  /** Cierres efectivos de la locución en curso (0 o 1): lo comprueban los tests. */
  get cierresEfectivos(): number {
    return this.finalizaciones;
  }

  /** ¿Se puede empezar a hablar? Siempre: abrir corta la locución anterior. */
  puedeHablar(): boolean {
    return true;
  }

  /**
   * Abre una locución nueva (corta la anterior si la hubiera) y arma el watchdog.
   * Devuelve el número de locución, para poder descartar eventos tardíos.
   */
  abrir(texto: string): number {
    if (this.hablando) this.finalizar("reemplazada");
    this.caracteres = texto.length;
    this.inicio = this.reloj.ahora();
    this.hablando = true;
    this.finalizaciones = 0;
    this.onHablando?.(true);
    this.armarWatchdog();
    return this.inicio;
  }

  /** Marca el arranque real informado por el motor (idempotente). */
  iniciar(): void {
    if (this.hablando) return;
    this.hablando = true;
    this.onHablando?.(true);
  }

  /**
   * Cierra la locución UNA sola vez (fin, error, cancelación o watchdog).
   * Devuelve `true` si este llamador la cerró.
   */
  finalizar(_motivo: "fin" | "error" | "cancelada" | "watchdog" | "reemplazada"): boolean {
    this.desarmarWatchdog();
    if (!this.hablando) return false;
    this.hablando = false;
    this.finalizaciones += 1;
    this.onHablando?.(false);
    return true;
  }

  /** El motor ha fallado: se cierra la locución (la respuesta queda en pantalla). */
  fallar(): boolean {
    return this.finalizar("error");
  }

  /** El usuario corta la voz: la locución queda cerrada y el ciclo reutilizable. */
  cancelar(): boolean {
    return this.finalizar("cancelada");
  }

  /** Milisegundos que lleva sonando la locución actual (0 si no habla). */
  duracionMs(): number {
    return this.hablando ? this.reloj.ahora() - this.inicio : 0;
  }

  private armarWatchdog(): void {
    this.desarmarWatchdog();
    this.watchdog = this.reloj.programar(
      () => {
        this.watchdog = null;
        this.finalizar("watchdog");
      },
      esperaLocucionMs(this.caracteres),
    );
  }

  private desarmarWatchdog(): void {
    if (this.watchdog !== null) {
      this.reloj.cancelar(this.watchdog);
      this.watchdog = null;
    }
  }
}
