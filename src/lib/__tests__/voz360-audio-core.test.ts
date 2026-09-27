/**
 * VOZ 360 — TESTS OBLIGATORIOS P0-1 (STT) y P0-2 (TTS).
 *
 * Se ejecutan sobre el NÚCLEO REAL que usa la aplicación
 * (`src/lib/assistant/voz360-audio-core.ts`) con un reloj falso: 10 ciclos
 * consecutivos de verdad, en microsegundos y sin dispositivo.
 *
 * Los mecanismos que viven en el puente nativo (watchdogs, destrucción del
 * reconocedor, fin idempotente del TTS) se fijan además por CONTRATO sobre el
 * propio código Java, porque un test de Node no puede ejecutar Android.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EMPTY_UTTERANCE } from "@/packages/voz360-client-sdk/utterance";
import {
  ESPERA_CONFIRMACION_MS,
  RelojFalso,
  SESION_COLGADA_MS,
  Voz360SttSession,
  Voz360TtsGuard,
  esperaLocucionMs,
} from "@/lib/assistant/voz360-audio-core";

const ROOT = process.cwd();
const NATIVE_STT = "android/app/src/main/java/com/electricista360/app/NativeStt.java";
const NATIVE_TTS = "android/app/src/main/java/com/electricista360/app/NativeTts.java";

function leer(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf-8");
}

/** Sesión de dictado con reloj falso, lista para simular turnos. */
function sesion(reloj: RelojFalso, onArranqueSinConfirmar?: () => void) {
  return new Voz360SttSession(EMPTY_UTTERANCE, { reloj, onArranqueSinConfirmar });
}

/** Guarda de TTS con reloj falso. */
function locucion(reloj: RelojFalso, onHablando?: (v: boolean) => void) {
  return new Voz360TtsGuard({ reloj, onHablando });
}

// ════════════════════════════════════════════════════════════════════════════
// P0-1 · MICRÓFONO
// ════════════════════════════════════════════════════════════════════════════

test("VOZ 360 · P0-1 micrófono — ciclos y recuperación", async (t) => {
  await t.test("1. start -> stop -> start (SEGUNDO CICLO de escucha)", () => {
    const reloj = new RelojFalso();
    const s = sesion(reloj);

    // Primer ciclo
    assert.equal(s.puedeArrancar(), true, "sin nada abierto se puede arrancar");
    s.abrir();
    s.programarConfirmacion();
    s.confirmarArranque();
    assert.equal(s.sesionViva(), true);
    assert.equal(s.cerrar("detenido"), true, "el primer cierre entrega el turno");
    assert.equal(s.cierresEfectivos, 1);
    assert.equal(reloj.pendientesCount, 0, "sin timers huérfanos tras cerrar");

    // Segundo ciclo: EXACTAMENTE igual de disponible que el primero
    assert.equal(s.puedeArrancar(), true, "tras Detener se puede volver a escuchar");
    s.abrir();
    assert.equal(s.activo, true);
    assert.equal(s.finalizado, false, "el fin del turno anterior no bloquea el nuevo");
    assert.equal(s.arranqueConfirmado, false, "y el arranque nuevo se confirma otra vez");
    s.confirmarArranque();
    assert.equal(s.sesionViva(), true, "el segundo ciclo escucha igual que el primero");
    assert.equal(s.cerrar("detenido"), true);
  });

  await t.test("2. cancel -> start: cancelar libera y la escucha siguiente funciona", () => {
    const reloj = new RelojFalso();
    const s = sesion(reloj);

    s.abrir();
    s.programarConfirmacion();
    s.confirmarArranque();
    s.descartar(); // Cancelar: no entrega nada y libera el micrófono

    assert.equal(s.sesionViva(), false, "tras cancelar no queda escucha viva");
    assert.equal(s.puedeArrancar(), true);
    assert.equal(reloj.pendientesCount, 0, "cancelar no deja temporizadores armados");

    s.abrir();
    s.programarConfirmacion();
    s.confirmarArranque();
    assert.equal(s.sesionViva(), true, "cancelar NO bloquea la escucha siguiente");
  });

  await t.test("3. timeout -> start: un arranque que no confirma se corta y se puede reintentar", () => {
    const reloj = new RelojFalso();
    let sinConfirmar = 0;
    const s = sesion(reloj, () => {
      sinConfirmar += 1;
    });

    s.abrir();
    s.programarConfirmacion();
    // El puente nunca contesta: vence el plazo de confirmación.
    reloj.avanzar(ESPERA_CONFIRMACION_MS);

    assert.equal(sinConfirmar, 1, "el núcleo avisa UNA vez de que el arranque no se confirmó");
    assert.equal(s.puedeArrancar(), true, "el intento cortado no bloquea el siguiente");

    // El llamador cierra el intento fallido y reintenta.
    s.descartar();
    s.abrir();
    s.programarConfirmacion();
    s.confirmarArranque();
    assert.equal(s.sesionViva(), true);

    // Y el aviso NO se repite para el arranque ya confirmado.
    reloj.avanzar(ESPERA_CONFIRMACION_MS * 2);
    assert.equal(sinConfirmar, 1, "un arranque confirmado no dispara el aviso de timeout");
  });

  await t.test("4. error -> start: un error libera recursos y deja el núcleo reutilizable", () => {
    const reloj = new RelojFalso();
    const s = sesion(reloj);

    s.abrir();
    s.programarConfirmacion();
    s.confirmarArranque();
    // El reconocedor falla de verdad: se cierra el turno con error.
    assert.equal(s.cerrar("error"), true);

    assert.equal(s.activo, false, "un error no deja la sesión abierta");
    assert.equal(s.sesionViva(), false);
    assert.equal(s.puedeArrancar(), true, "tras un error se puede volver a escuchar");
    assert.equal(reloj.pendientesCount, 0, "el error no deja timers huérfanos");

    s.abrir();
    s.programarConfirmacion();
    s.confirmarArranque();
    assert.equal(s.sesionViva(), true, "la escucha posterior al error funciona igual");
  });

  await t.test("5. DIEZ ciclos consecutivos de escucha sin reiniciar nada", () => {
    const reloj = new RelojFalso();
    const s = sesion(reloj);

    for (let ciclo = 1; ciclo <= 10; ciclo += 1) {
      assert.equal(s.puedeArrancar(), true, `ciclo ${ciclo}: debe poder arrancar`);

      s.abrir();
      s.programarConfirmacion();
      s.confirmarArranque();
      assert.equal(s.sesionViva(), true, `ciclo ${ciclo}: escuchando`);

      // El usuario habla (cada evento del puente renueva la actividad).
      reloj.avanzar(400);
      s.marcarEvento();

      assert.equal(s.cerrar("detenido"), true, `ciclo ${ciclo}: cierra una sola vez`);
      assert.equal(s.cierresEfectivos, 1, `ciclo ${ciclo}: sin doble cierre`);
      assert.equal(s.sesionViva(), false, `ciclo ${ciclo}: no queda escucha viva`);
      assert.equal(reloj.pendientesCount, 0, `ciclo ${ciclo}: sin timers huérfanos`);
    }
  });

  await t.test("6. Nunca dos escuchas a la vez, y una sesión colgada se puede cerrar a la fuerza", () => {
    const reloj = new RelojFalso();
    const s = sesion(reloj);

    s.abrir();
    s.programarConfirmacion();
    s.confirmarArranque();

    // Con la escucha VIVA, un segundo arranque está prohibido.
    assert.equal(s.puedeArrancar(), false, "no puede haber dos sesiones simultáneas");

    // El motor se queda mudo: sin eventos, la sesión pasa a COLGADA.
    reloj.avanzar(SESION_COLGADA_MS + 1);
    assert.equal(s.sesionViva(), false, "una sesión sin actividad está colgada");
    assert.equal(s.necesitaCierreForzado(), true, "y hay que cerrarla a la fuerza");
    assert.equal(s.puedeArrancar(), true, "start() autocurable: no se queda muerto");

    // La app cierra a la fuerza y arranca de nuevo (esto es lo que hace el puente).
    assert.equal(s.cerrar("colgada"), true);
    s.abrir();
    s.programarConfirmacion();
    s.confirmarArranque();
    assert.equal(s.sesionViva(), true, "tras la sesión colgada, la escucha vuelve");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// P0-2 · VOZ (TTS)
// ════════════════════════════════════════════════════════════════════════════

test("VOZ 360 · P0-2 voz — ciclos y recuperación", async (t) => {
  await t.test("7. speak -> fin -> speak (SEGUNDO ciclo de voz)", () => {
    const reloj = new RelojFalso();
    const estados: boolean[] = [];
    const g = locucion(reloj, (v) => estados.push(v));

    g.abrir("Primera respuesta.");
    assert.equal(g.estaHablando, true);
    assert.equal(g.finalizar("fin"), true, "el fin del motor cierra la locución");
    assert.equal(g.estaHablando, false, "y deja de estar hablando");
    assert.equal(reloj.pendientesCount, 0, "el watchdog se desarma al terminar");

    // Segundo ciclo: hablar otra vez funciona inmediatamente después
    assert.equal(g.puedeHablar(), true);
    g.abrir("Segunda respuesta.");
    assert.equal(g.estaHablando, true, "la segunda reproducción funciona");
    assert.equal(g.finalizar("fin"), true);
    assert.deepEqual(estados, [true, false, true, false], "el indicador sigue el ciclo real");
  });

  await t.test("8. cancel -> speak: cortar la voz no impide la siguiente", () => {
    const reloj = new RelojFalso();
    const g = locucion(reloj);

    g.abrir("Respuesta larga que el usuario corta.");
    assert.equal(g.cancelar(), true, "el usuario corta: cierre efectivo");
    assert.equal(g.estaHablando, false);
    assert.equal(reloj.pendientesCount, 0);

    g.abrir("Respuesta siguiente.");
    assert.equal(g.estaHablando, true, "tras cancelar se puede hablar otra vez");
    assert.equal(g.finalizar("fin"), true);
  });

  await t.test("9. error -> speak: un fallo del TTS limpia el estado y no bloquea", () => {
    const reloj = new RelojFalso();
    const g = locucion(reloj);

    g.abrir("Respuesta que el motor rechaza.");
    assert.equal(g.fallar(), true, "el error cierra la locución");
    assert.equal(g.estaHablando, false, "un error NO deja isSpeaking en true");
    assert.equal(reloj.pendientesCount, 0, "y desarma su watchdog");

    g.abrir("Otra respuesta.");
    assert.equal(g.estaHablando, true);
    assert.equal(g.finalizar("fin"), true);
  });

  await t.test("10. timeout -> speak: si Android no devuelve callback, el watchdog cierra", () => {
    const reloj = new RelojFalso();
    const g = locucion(reloj);
    const texto = "Respuesta de la que el motor nunca avisa.";

    g.abrir(texto);
    assert.equal(g.estaHablando, true);

    // El motor no llama a onDone: vence el watchdog proporcional al texto.
    reloj.avanzar(esperaLocucionMs(texto.length));

    assert.equal(g.estaHablando, false, "el watchdog limpia isSpeaking sin callback del motor");
    assert.equal(reloj.pendientesCount, 0);

    g.abrir("Respuesta siguiente.");
    assert.equal(g.estaHablando, true, "y se puede volver a hablar inmediatamente");
    assert.equal(g.finalizar("fin"), true);
  });

  await t.test("11. DIEZ respuestas consecutivas sin quedarse nunca en 'hablando'", () => {
    const reloj = new RelojFalso();
    const g = locucion(reloj);

    for (let ciclo = 1; ciclo <= 10; ciclo += 1) {
      const texto = `Respuesta numero ${ciclo} del asistente.`;
      g.abrir(texto);
      assert.equal(g.estaHablando, true, `ciclo ${ciclo}: hablando`);

      // Alterna los caminos de cierre: fin del motor, error y watchdog.
      if (ciclo % 3 === 0) {
        assert.equal(g.fallar(), true, `ciclo ${ciclo}: error`);
      } else if (ciclo % 3 === 1) {
        assert.equal(g.finalizar("fin"), true, `ciclo ${ciclo}: fin`);
      } else {
        reloj.avanzar(esperaLocucionMs(texto.length));
      }

      assert.equal(g.estaHablando, false, `ciclo ${ciclo}: nunca queda hablando`);
      assert.equal(reloj.pendientesCount, 0, `ciclo ${ciclo}: sin timers huérfanos`);
      assert.equal(g.cierresEfectivos <= 1, true, `ciclo ${ciclo}: un solo cierre`);
    }
  });

  await t.test("12. Una locución nueva corta la anterior y un cierre tardío no duplica", () => {
    const reloj = new RelojFalso();
    const g = locucion(reloj);

    g.abrir("Primera.");
    g.abrir("Segunda."); // corta la anterior
    assert.equal(g.estaHablando, true);

    // Fin de la primera (evento tardío) y fin de la segunda: un único cierre efectivo.
    assert.equal(g.finalizar("fin"), true, "el primer cierre efectivo es el de la locución viva");
    assert.equal(g.finalizar("fin"), false, "un segundo fin no vuelve a cerrar ni reejecuta nada");
    assert.equal(g.estaHablando, false);
    assert.equal(reloj.pendientesCount, 0, "sin watchdogs huérfanos de la locución cortada");
  });

  await t.test("13. STT y TTS no se pisan: al abrir el micrófono la voz queda cerrada", () => {
    const reloj = new RelojFalso();
    const s = sesion(reloj);
    const g = locucion(reloj);

    // El asistente está respondiendo y el usuario vuelve a hablar (barge-in).
    g.abrir("Respuesta en curso.");
    assert.equal(g.estaHablando, true);

    // Lo que hace la aplicación al arrancar el dictado: cortar la voz y escuchar.
    g.cancelar();
    s.abrir();
    s.programarConfirmacion();
    s.confirmarArranque();

    assert.equal(g.estaHablando, false, "no puede haber voz y micrófono a la vez");
    assert.equal(s.sesionViva(), true);
    assert.equal(reloj.pendientesCount, 0, "la locución cortada no deja timers");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CONTRATO DEL PUENTE NATIVO (lo que no puede ejecutar Node)
// ════════════════════════════════════════════════════════════════════════════

test("VOZ 360 · contrato del puente nativo (P0-1 y P0-2)", async (t) => {
  await t.test("14. NativeStt: start() autocurable, sin salida silenciosa", () => {
    const stt = leer(NATIVE_STT);

    assert.doesNotMatch(
      stt,
      /if \(activo\) return;/,
      "P0-1: start() ya no puede salir en silencio con una sesión pegada"
    );
    assert.match(stt, /private static final long SESION_COLGADA_MS/, "existe el criterio de sesión colgada");
    assert.match(
      stt,
      /if \(activo\) \{[\s\S]{0,260}cerrarPorFuerza\("start-con-sesion-colgada"\)/,
      "una sesión colgada se cierra a la fuerza y se arranca de nuevo"
    );
    assert.match(stt, /private void cerrarPorFuerza\(String motivo\)/, "existe el cierre forzado");
    assert.match(
      stt,
      /private void cerrarPorFuerza\(String motivo\) \{[\s\S]{0,400}activo = false;[\s\S]{0,400}emitir\("stopped"/,
      "el cierre forzado libera la escucha y avisa a la página"
    );
  });

  await t.test("15. NativeStt: watchdog de parada y liberación del reconocedor", () => {
    const stt = leer(NATIVE_STT);

    assert.match(stt, /private void programarWatchdogParada\(\)/, "hay watchdog de parada suave");
    assert.match(stt, /ui\.postDelayed\(watchdogParada, ESPERA_PARADA_MS\)/, "armado con retardo real");
    assert.match(
      stt,
      /if \(activo\) \{[\s\S]{0,80}cerrarPorFuerza\("watchdog-parada"\)/,
      "si el motor no contesta a stopListening, se cierra a la fuerza"
    );
    assert.match(stt, /private void cancelarWatchdogParada\(\)/, "el watchdog se puede cancelar");
    assert.match(stt, /ui\.removeCallbacks\(watchdogParada\)/, "y se retira del handler (sin huérfanos)");

    // Cancelar y error de verdad liberan el reconocedor y limpian callbacks.
    assert.match(
      stt,
      /public void cancel\(\) \{[\s\S]{0,900}destruirReconocedor\(\)/,
      "cancel() destruye el reconocedor: no deja el micrófono tomado"
    );
    assert.match(
      stt,
      /Error de verdad[\s\S]{0,200}activo = false;[\s\S]{0,200}destruirReconocedor\(\);[\s\S]{0,200}emitir\("error"/,
      "un error real suelta el reconocedor ANTES de informar"
    );
    assert.match(
      stt,
      /private void destruirReconocedor\(\) \{[\s\S]{0,300}setRecognitionListener\(null\)[\s\S]{0,120}\.destroy\(\)/,
      "limpiar callbacks y destruir el reconocedor"
    );
    assert.match(stt, /cancelarWatchdogParada\(\);\s*\n\s*destruirReconocedor\(\);/, "liberar() cancela el watchdog");
    assert.match(
      stt,
      /"stopped"\.equals\(tipo\) \|\| "error"\.equals\(tipo\) \|\| "cancelled"\.equals\(tipo\)[\s\S]{0,80}cancelarWatchdogParada\(\)/,
      "cualquier cierre entrega su temporizador cancelado"
    );
  });

  await t.test("16. NativeStt: el arranque real lo confirma el motor (onReadyForSpeech)", () => {
    const stt = leer(NATIVE_STT);
    const ready = stt.slice(
      stt.indexOf("public void onReadyForSpeech(Bundle params)"),
      stt.indexOf("public void onBeginningOfSpeech()")
    );

    assert.match(ready, /emitir\("listening", "Escuchando"\)/, "onReadyForSpeech confirma la escucha real");
  });

  await t.test("17. NativeTts: fin idempotente, watchdog y retorno de speak() comprobado", () => {
    const tts = leer(NATIVE_TTS);

    assert.match(tts, /private void finalizarLocucion\(String motivo\)/, "existe el cierre único");
    assert.match(
      tts,
      /private void finalizarLocucion\(String motivo\) \{[\s\S]{0,300}if \(locucionFinalizada\) return;/,
      "el fin es idempotente: no hay dobles callbacks"
    );
    assert.match(tts, /private void programarWatchdogLocucion\(/, "hay watchdog de locución");
    assert.match(tts, /ui\.postDelayed\(watchdogLocucion, espera\)/, "armado con retardo real");
    assert.match(tts, /private void cancelarWatchdogLocucion\(\)/, "y se puede cancelar");
    assert.match(tts, /LOCUCION_MAX_MS/, "acotado: nunca deja el ciclo colgado para siempre");
    assert.match(
      tts,
      /int resultado = tts\.speak\([\s\S]{0,200}resultado == TextToSpeech\.ERROR[\s\S]{0,340}emitir\("error", "speak"\)/,
      "P0-2: si el motor rechaza la locución, la página se entera"
    );
    assert.match(tts, /finalizarLocucion\("onDone"\)/, "onDone cierra la locución");
    assert.match(tts, /finalizarLocucion\("stop"\)/, "stop() del usuario también la cierra");
    assert.match(tts, /finalizarLocucion\("watchdog"\)/, "y el watchdog también");
    assert.match(
      tts,
      /public void liberar\(\) \{[\s\S]{0,200}cancelarWatchdogLocucion\(\)/,
      "liberar() no deja watchdogs vivos"
    );
  });
});
