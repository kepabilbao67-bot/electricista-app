/**
 * Voz 360 — DICTAR: CICLOS REPETIDOS Y AUTOCURACIÓN
 *
 * POR QUÉ EXISTE ESTE ARCHIVO
 * El requisito real de "Dictar" no es que funcione UNA vez, sino que el ciclo
 * `iniciar → escuchar → obtener texto → parar/cerrar → volver a iniciar` se pueda
 * repetir indefinidamente SIN recargar la aplicación y sin dejar estado residual.
 *
 * Los fallos que se corrigen aquí y que este archivo protege:
 *  1. `fetch` de transcripción colgado → estado "transcribiendo" para siempre y
 *     botón Dictar DESHABILITADO (no se podía volver a dictar).
 *  2. Arranque "fantasma" del fallback: el usuario cancelaba mientras el navegador
 *     pedía el permiso del micrófono y la grabación resucitaba por encima, dejando
 *     dos sesiones vivas con `fallbackActivoRef` a false (el botón decía "Dictar"
 *     mientras el micrófono seguía grabando).
 *  3. `MediaRecorder.onstop` que no llega → el cierre no ocurría y el botón se
 *     quedaba en "Detener" para siempre.
 *  4. Reconocedor de navegador ANTERIOR que quedaba vivo (motor colgado sin
 *     `onstart`): la segunda pulsación creaba un segundo reconocedor con el
 *     micrófono aún tomado por el viejo.
 *
 * La comprobación de COMPORTAMIENTO real con micrófono y servidor de verdad está en
 * `scripts/qa/dictar-browser-cycles.mjs` (Chrome real + audio real + 10 ciclos).
 * Aquí se fijan los invariantes del contrato del componente, que es lo que se puede
 * comprobar sin dispositivo.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const VOICE = "src/components/VoiceDictation.tsx";

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf-8");
}

describe("VOZ 360 · DICTAR — ciclos repetidos y autocuración", () => {
  test("1. La transcripción tiene TOPE y se aborta: un servidor mudo no bloquea el dictado", () => {
    const src = read(VOICE);
    assert.match(
      src,
      /const TIMEOUT_TRANSCRIPCION_MS = \d+/,
      "debe existir un tope explícito de la transcripción"
    );
    assert.match(
      src,
      /const controlador = new AbortController\(\);/,
      "el tope se implementa abortando la petición, no solo ignorándola"
    );
    assert.match(
      src,
      /signal: controlador\.signal/,
      "la señal tiene que llegar al fetch: si no, el abort no hace nada"
    );
    // SIN esto, el `finally` que libera la sesión no se ejecuta nunca y el botón
    // queda deshabilitado en "Transcribiendo…" de forma permanente.
    const transcripcion = src.slice(
      src.indexOf("async function transcribirGrabacion"),
      src.indexOf("function terminarGrabacion")
    );
    assert.match(transcripcion, /finally \{/, "la liberación va en un `finally`");
    assert.match(
      transcripcion,
      /finally \{[\s\S]{0,400}liberarGrabacion\(\);/,
      "pase lo que pase, la sesión de grabación se libera"
    );
    // Y si el usuario canceló, también se libera (antes se salía sin liberar y la
    // sesión quedaba marcada como activa para siempre).
    assert.match(
      transcripcion,
      /if \(descartadoRef\.current\) \{[\s\S]{0,120}liberarGrabacion\(\);[\s\S]{0,40}return;/,
      "el descarte también libera"
    );
  });

  test("2. El cierre de la grabación es IDEMPOTENTE y tiene red de seguridad", () => {
    const src = read(VOICE);
    const terminar = src.slice(
      src.indexOf("function terminarGrabacion"),
      src.indexOf("async function iniciarEscuchaFallback")
    );
    assert.match(
      terminar,
      /let cerrado = false;[\s\S]{0,200}if \(cerrado\) return;/,
      "el cierre no puede ejecutarse dos veces (audio duplicado al servidor)"
    );
    assert.match(
      src,
      /const ESPERA_CIERRE_GRABACION_MS = \d+/,
      "debe existir un plazo máximo para el cierre de la grabación"
    );
    assert.match(
      terminar,
      /g\.timerCierre = window\.setTimeout\(\(\) => \{[\s\S]{0,120}cerrar\(\);[\s\S]{0,40}\}, ESPERA_CIERRE_GRABACION_MS\)/,
      "si `onstop` no llega, el cierre ocurre igual: el botón no se queda en Detener"
    );
  });

  test("3. Un arranque del fallback que llega tarde NO puede resucitar la sesión", () => {
    const src = read(VOICE);
    // `liberarGrabacion` sube el token de sesión…
    assert.match(
      src,
      /function liberarGrabacion\(\) \{[\s\S]{0,400}g\.id \+= 1;/,
      "liberar invalida la sesión de grabación"
    );
    // …y el arranque compara el token que capturó antes de pedir el micrófono.
    const arranque = src.slice(
      src.indexOf("async function iniciarEscuchaFallback"),
      src.indexOf("ENTREGA ÚNICA del turno")
    );
    assert.match(arranque, /g\.id \+= 1;[\s\S]{0,120}const idSesion = g\.id;/, "cada arranque tiene su token");
    assert.match(
      arranque,
      /if \(descartadoRef\.current \|\| g\.id !== idSesion\) \{/,
      "tras pedir el permiso se comprueba que la sesión siga siendo la vigente"
    );
    assert.doesNotMatch(
      arranque,
      /if \(descartadoRef\.current\) \{\n\s+for \(const pista of stream\.getTracks\(\)\) pista\.stop\(\);\n\s+fallbackActivoRef\.current = false;/,
      "el arranque fantasma no puede tocar el estado de la sesión en curso"
    );
    // Y si el permiso falla en un arranque ya invalidado, no se pisa el estado actual.
    assert.match(
      arranque,
      /\} catch \(causa\) \{[\s\S]{0,300}if \(g\.id !== idSesion\) return;/,
      "un fallo de un arranque fantasma no informa de error del dictado actual"
    );
    assert.match(
      arranque,
      /errorFatalRef\.current = false;/,
      "cada arranque parte de estado limpio (ningún residuo del ciclo anterior)"
    );
  });

  test("4. Nunca queda un reconocedor de navegador ANTERIOR vivo", () => {
    const src = read(VOICE);
    assert.match(
      src,
      /function liberarReconocimientoWeb\(\) \{/,
      "debe existir una única forma de soltar el reconocedor"
    );
    const liberar = src.slice(
      src.indexOf("function liberarReconocimientoWeb"),
      src.indexOf("/** Arranca la escucha con la Web Speech API")
    );
    for (const handler of ["onstart", "onend", "onresult", "onerror"]) {
      assert.match(
        liberar,
        new RegExp(`recognition\\.${handler} = null;`),
        `el reconocedor soltado no puede seguir entregando eventos (${handler})`
      );
    }
    assert.match(liberar, /recognition\.abort\(\);/, "y hay que abortarlo (libera el micrófono)");
    // Se suelta SIEMPRE antes de abrir uno nuevo (era el fallo de los ciclos: dos
    // reconocedores vivos a la vez y el dictado muerto hasta recargar).
    const web = src.slice(
      src.indexOf("function iniciarEscuchaWeb"),
      src.indexOf("const startListening")
    );
    const posLiberar = web.indexOf("liberarReconocimientoWeb();");
    const posCrear = web.indexOf("const recognition = new SpeechRecognition();");
    assert.ok(posLiberar > 0 && posCrear > 0, "el arranque web debe soltar y crear");
    assert.ok(
      posLiberar < posCrear,
      "el reconocedor anterior se suelta ANTES de crear el nuevo"
    );
    assert.match(
      web,
      /\} catch \{[\s\S]{0,300}liberarReconocimientoWeb\(\);/,
      "un reconocedor que no arranca tampoco puede quedarse vivo"
    );
  });

  test("5. La entrega del texto sigue siendo ÚNICA y el ciclo queda reutilizable", () => {
    const src = read(VOICE);
    assert.equal(
      (src.match(/onTranscriptRef\.current\(/g) ?? []).length,
      1,
      "las correcciones no pueden añadir un segundo punto de entrega"
    );
    assert.match(
      src,
      /if \(entregaHechaRef\.current \|\| descartadoRef\.current\) return;/,
      "la entrega sigue siendo idempotente"
    );
    // Los recursos del fallback se liberan SIEMPRE al desmontar (cambiar de pantalla
    // no puede dejar el micrófono tomado).
    const desmontaje = src.slice(src.indexOf("// Al desmontar, cortar el micrófono"));
    assert.match(desmontaje, /terminarGrabacion\(false\);/, "al salir se corta la grabación");
    assert.match(desmontaje, /liberarGrabacion\(\);/, "y se liberan sus recursos");
    assert.match(desmontaje, /desarmarWatchdogArranqueWeb\(\);/, "sin watchdogs huérfanos");
  });

  /**
   * MEDIDO EN REAL (Chrome sin servicio de voz): el motor de navegador ARRANCA
   * (`onstart` sí llega), no devuelve NINGÚN resultado y tampoco da error. El turno
   * se cerraba con "no se ha reconocido nada" y la pulsación siguiente volvía a
   * usar el mismo motor mudo: el dictado quedaba inservible para siempre, aunque el
   * micrófono funcionara. Con esta escalada, la pulsación siguiente graba y
   * transcribe en el servidor.
   */
  test("6. Un motor de navegador MUDO no deja el dictado inservible", () => {
    const src = read(VOICE);
    assert.match(
      src,
      /const turnosWebSinTextoRef = useRef\(0\);/,
      "debe contarse cuántos turnos cierra el motor sin una sola palabra"
    );
    const cierreWeb = src.slice(
      src.indexOf("function cerrarTurnoWeb"),
      src.indexOf("function desarmarWatchdogArranqueWeb")
    );
    assert.match(
      cierreWeb,
      /turnosWebSinTextoRef\.current = dicho\.length > 0 \? 0 : turnosWebSinTextoRef\.current \+ 1;/,
      "el contador sube solo cuando NO hubo texto, y se resetea con voz reconocida"
    );
    const arranque = src.slice(src.indexOf("const startListening"), src.indexOf("const stopListening"));
    assert.match(
      arranque,
      /if \(turnosWebSinTextoRef\.current > 0 && fallbackDisponible\(\)\) \{\s*pasarAFallback\("web_sin_resultados"\);/,
      "tras un motor mudo, la pulsación siguiente graba en el servidor"
    );
    // El orden importa: la escalada va ANTES de volver a arrancar el motor mudo.
    assert.ok(
      arranque.indexOf("web_sin_resultados") < arranque.indexOf("iniciarEscuchaWeb();"),
      "no puede insistirse en el motor mudo antes de escalar"
    );
  });
});
