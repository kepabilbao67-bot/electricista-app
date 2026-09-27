/**
 * Voz 360 — invariantes del dictado (P0 micrófono)
 *
 * QUÉ CAMBIÓ (y por qué este archivo es distinto del anterior):
 * El dictado de la APK se ha sustituido por el núcleo de voz PROBADO en el POCO.
 * La vía nativa ya no inventa su propia máquina de estados en JS ni encadena
 * «tramos» con un vigilante: ahora hay UN solo canal de eventos
 * (`window.__electricistaSttEvent`), el texto se acumula con el SDK
 * (`mergeUtterances` sobre SEGMENTOS) y el cierre lo decide `finalizeReason` desde
 * un latido. La vía externa de dictado del sistema (ACTION_RECOGNIZE_SPEECH por
 * startActivityForResult) se ha ELIMINADO: abría una ventana fuera de la app y era
 * un modo de fallo real.
 *
 * Estos tests protegen los INVARIANTES, no la forma antigua del código:
 *  1. una pausa natural de 2,5-3 s NO termina el turno;
 *  2. los segmentos se acumulan sin perder ni duplicar palabras;
 *  3. DETENER entrega todo UNA sola vez;
 *  4. CANCELAR no entrega nada, ni siquiera después;
 *  5. el permiso denegado INFORMA y nunca falla en silencio;
 *  6. RECORD_AUDIO está declarado y se pide en runtime;
 *  7. solo puede haber UNA escucha activa a la vez.
 *
 * Los invariantes que son lógica pura se comprueban EJECUTANDO el SDK de verdad
 * (import real, no una aserción sobre el texto fuente). Lo que sólo se puede
 * comprobar leyendo el fuente (el cableado del puente y del componente) se
 * comprueba leyendo el fuente, con la intención declarada en cada aserción.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  EMPTY_UTTERANCE,
  END_OF_SPEECH_SILENCE_MS,
  HEARTBEAT_MS,
  MAX_UTTERANCE_MS,
  MIN_UTTERANCE_MS,
  committedText,
  displayText,
  finalizeReason,
  finalUtteranceText,
  isEmptyUtterance,
  mergeUtterances,
  utteranceFromResults,
  type Utterance,
} from "@/packages/voz360-client-sdk/utterance";
import { DEFAULT_UTTERANCE_CONFIG } from "@/packages/voz360-client-sdk/utterance-endpointer";

const ROOT = process.cwd();
const VOICE = "src/components/VoiceDictation.tsx";
const ASISTENTE = "src/app/asistente/page.tsx";
const MANIFEST = "android/app/src/main/AndroidManifest.xml";
const NATIVE = "android/app/src/main/java/com/electricista360/app/NativeStt.java";
const ACTIVITY = "android/app/src/main/java/com/electricista360/app/MainActivity.java";

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf-8");
}

/**
 * MODELO DEL TURNO NATIVO — el mismo que ejecuta el componente.
 *
 * Reproduce, con el SDK REAL, lo que hace `window.__electricistaSttEvent`:
 *  - `partial` → REEMPLAZA la hipótesis provisional (nunca concatena);
 *  - `final`   → MERGE como SEGMENTO (`mergeUtterances`);
 *  - latido    → `finalizeReason` decide el cierre;
 *  - al cerrar → `finalUtteranceText`, UNA sola vez (`entregado`).
 *
 * Sirve para comprobar el COMPORTAMIENTO (pausas, acumulación, duplicados,
 * entrega única) sin navegador ni micrófono. El cableado real del componente se
 * comprueba además leyendo el fuente, más abajo.
 */
function crearTurnoNativo() {
  const estado = {
    actual: EMPTY_UTTERANCE as Utterance,
    base: EMPTY_UTTERANCE as Utterance,
    entregado: false,
    entregas: [] as string[],
  };
  let inicio = 0;
  let ultimaVoz = 0;
  let reloj = 0;

  const hayVozNueva = () => {
    ultimaVoz = reloj;
  };

  return {
    /** Arranca el turno (equivale a pulsar Dictar). */
    arrancar(ms = 0) {
      reloj = ms;
      inicio = ms;
      ultimaVoz = ms;
      estado.actual = EMPTY_UTTERANCE;
      estado.base = EMPTY_UTTERANCE;
      estado.entregado = false;
    },
    avanzar(ms: number) {
      reloj += ms;
    },
    /** Evento `partial` del puente. */
    partial(texto: string) {
      estado.actual = { segments: estado.actual.segments, interim: texto };
      hayVozNueva();
    },
    /** Evento `final` del puente: un SEGMENTO, no el fin del turno. */
    final(texto: string) {
      estado.actual = mergeUtterances(
        estado.actual,
        utteranceFromResults([{ transcript: texto, isFinal: true }])
      );
      hayVozNueva();
    },
    /** Un reinicio del reconocedor: lo acumulado pasa a ser base. */
    reiniciarMotor() {
      estado.base = mergeUtterances(estado.base, estado.actual);
      estado.actual = estado.base;
    },
    /** Un tick del latido. Devuelve el motivo de cierre, o null si sigue vivo. */
    latido() {
      return finalizeReason({
        sinceLastSpeechMs: reloj - ultimaVoz,
        sinceStartMs: reloj - inicio,
        hasSpeech: !isEmptyUtterance(estado.actual),
      });
    },
    /** Cierre del turno: entrega UNA sola vez (como `entregarTurno`). */
    cerrar(): string {
      if (estado.entregado) return "";
      estado.entregado = true;
      const dicho = finalUtteranceText(estado.actual);
      estado.actual = EMPTY_UTTERANCE;
      estado.base = EMPTY_UTTERANCE;
      if (dicho) estado.entregas.push(dicho);
      return dicho;
    },
    /** Cancelar: descarta y sella (no puede entregarse nada después). */
    cancelar() {
      estado.entregado = true;
      estado.actual = EMPTY_UTTERANCE;
      estado.base = EMPTY_UTTERANCE;
    },
    get entregas() {
      return estado.entregas;
    },
    get actual() {
      return estado.actual;
    },
  };
}

describe("Voz 360 — dictado: invariantes de comportamiento", () => {
  test("1. El reconocimiento del navegador es continuo y con resultados interinos", () => {
    const src = read(VOICE);
    assert.match(
      src,
      /recognition\.continuous\s*=\s*true/,
      "continuous debe ser true: con false el dictado se corta en la primera pausa"
    );
    assert.match(
      src,
      /recognition\.interimResults\s*=\s*true/,
      "interimResults debe ser true para poder mostrar el texto mientras se habla"
    );
  });

  test("2. /asistente NO envía automáticamente la transcripción", () => {
    const src = read(ASISTENTE);
    assert.doesNotMatch(
      src,
      /void\s+send\s*\(\s*transcript\s*\)/,
      "la transcripción no debe enviarse sola: el usuario revisa y pulsa Enviar"
    );
    assert.match(
      src,
      /onTranscriptComplete=\{\(transcript\) => \{[\s\S]{0,200}setInput\(/,
      "la transcripción dictada debe caer en el cuadro de texto"
    );
  });

  test("3. El dictado del navegador distingue el bloqueo por origen no seguro", () => {
    const src = read(VOICE);
    assert.match(src, /isSecureContext/, "debe comprobarse window.isSecureContext");
    assert.match(
      src,
      /no es segura \(HTTP por IP\)/,
      "el mensaje debe explicar que el origen HTTP por IP bloquea el micrófono"
    );
  });

  test("4. El texto se entrega una sola vez, al TERMINAR el turno", () => {
    const src = read(VOICE);
    const entregar = src.slice(src.indexOf("function entregarTurno"), src.indexOf("function cerrarTurnoNativo"));
    assert.match(
      entregar,
      /if \(entregaHechaRef\.current \|\| descartadoRef\.current\) return;/,
      "la entrega debe ser idempotente y quedar sellada al cancelar"
    );
    assert.equal(
      (src.match(/onTranscriptRef\.current\(/g) ?? []).length,
      1,
      "la entrega al llamador debe ocurrir en UN único sitio (entregarTurno)"
    );
    // Ningún evento intermedio entrega texto: ni un parcial ni un segmento.
    const canal = src.slice(
      src.indexOf("w.__electricistaSttEvent ="),
      src.indexOf("return () => {\n      limpiarTemporizadores();")
    );
    assert.doesNotMatch(
      canal,
      /onTranscriptRef\.current\(/,
      "ni `partial` ni `final` pueden entregar texto: solo el cierre del turno entrega"
    );
  });

  test("5. Se conserva el fallback a teclado cuando no hay motor de voz", () => {
    const src = read(VOICE);
    assert.match(src, /SIN_MOTOR_TEXTO/, "debe existir el modo sin motor con aviso explícito");
    assert.match(src, /AndroidSTT/, "debe conservarse el puente nativo para la APK");
    assert.match(src, /TECLADO_TEXTO/, "el aviso debe recordar que se puede escribir");
  });

  test("6. El AndroidManifest declara RECORD_AUDIO y la visibilidad de paquetes", () => {
    const manifest = read(MANIFEST);
    assert.match(
      manifest,
      /android\.permission\.RECORD_AUDIO/,
      "el manifiesto DEBE declarar RECORD_AUDIO o el micrófono se deniega siempre"
    );
    assert.match(
      manifest,
      /android\.permission\.MODIFY_AUDIO_SETTINGS/,
      "Capacitor pide las dos juntas cuando la WebView solicita AUDIO_CAPTURE"
    );
    assert.match(
      manifest,
      /<queries>[\s\S]*android\.speech\.RecognitionService/,
      "sin <queries> Android 11+ puede devolver un FALSO NEGATIVO de isRecognitionAvailable()"
    );
  });

  test("7. El puente nativo usa SOLO SpeechRecognizer (ninguna ventana externa)", () => {
    const native = read(NATIVE);
    assert.match(
      native,
      /SpeechRecognizer\.createSpeechRecognizer/,
      "el reconocedor debe ser in-process"
    );
    assert.match(
      native,
      /SpeechRecognizer\.isRecognitionAvailable/,
      "debe poder consultarse la disponibilidad del servicio"
    );
    // El intent se usa como CONFIGURACIÓN de startListening, nunca lanzado como
    // Activity: la ventana externa de Google fue un modo de fallo real. (La
    // llamada, no la mención en un comentario: el comentario explica el porqué.)
    assert.doesNotMatch(
      native,
      /activity\s*\.\s*startActivityForResult/,
      "no puede abrirse ninguna Activity de dictado: sacaba al usuario de la app"
    );
    assert.doesNotMatch(native, /REQ_STT/, "el request code del dictado externo debe haber desaparecido");
    assert.doesNotMatch(
      native,
      /\bstartActivity\(/,
      "el puente no puede abrir ninguna pantalla: solo habla con el reconocedor"
    );
    assert.doesNotMatch(
      native,
      /ActivityNotFoundException/,
      "sin vía externa no hay Activity que resolver"
    );
    assert.doesNotMatch(
      native,
      /public void startDirect/,
      "solo hay UNA vía de escucha: no debe quedar el fallback externo"
    );
  });

  test("8. Un solo canal de eventos, con el conjunto de tipos probado", () => {
    const native = read(NATIVE);
    const voice = read(VOICE);
    assert.match(
      native,
      /window\.__electricistaSttEvent && window\.__electricistaSttEvent\(/,
      "el puente emite por el canal único __electricistaSttEvent"
    );
    for (const tipo of [
      "listening",
      "partial",
      "final",
      "error",
      "cancelled",
      "stopped",
      "permission",
      "speechend",
    ]) {
      assert.match(
        native,
        new RegExp(`emitir\\("${tipo}"`),
        `el puente debe emitir el evento ${tipo}`
      );
      assert.match(
        voice,
        new RegExp(`tipo === "${tipo}"`),
        `el cliente debe manejar el evento ${tipo}`
      );
    }
    // Los canales antiguos (uno por callback) ya no existen.
    assert.doesNotMatch(voice, /__onNativeStt/, "los canales sueltos antiguos deben haber desaparecido");
    assert.doesNotMatch(native, /__onNativeStt/, "el puente ya no emite por canales sueltos");
  });

  test("9. RECORD_AUDIO se comprueba y se pide en tiempo de ejecución", () => {
    const native = read(NATIVE);
    assert.match(native, /hasPermission/, "debe comprobarse el permiso concedido");
    assert.match(native, /activity\.requestPermissions/, "debe solicitarse el permiso en runtime");
    assert.match(
      native,
      /Manifest\.permission\.RECORD_AUDIO/,
      "debe solicitarse exactamente RECORD_AUDIO"
    );
    const activity = read(ACTIVITY);
    assert.match(
      activity,
      /onRequestPermissionsResult[\s\S]{0,400}onPermissionResult\(concedido\)/,
      "MainActivity debe reenviar el resultado del permiso al puente"
    );
    assert.match(
      activity,
      /requestCode == NativeStt\.REQ_PERMISO_AUDIO/,
      "el reenvío debe filtrar por el request code del micrófono"
    );
  });

  test("10. Nunca se inicia una escucha sin permiso (y el permiso concedido auto-arranca)", () => {
    const native = read(NATIVE);
    const start = native.slice(native.indexOf("public void start()"), native.indexOf("public void stop()"));
    assert.match(start, /if \(!hasPermission\(\)\)/, "start() debe comprobar el permiso ANTES de escuchar");
    assert.match(
      start,
      /emitir\("permission"/,
      "sin permiso debe INFORMARSE por el canal de eventos (nunca en silencio)"
    );
    assert.match(start, /requestPermission\(\)/, "y debe pedirse el permiso");
    // Conceder el permiso arranca la escucha sola: no hay que pulsar dos veces.
    const permiso = native.slice(
      native.indexOf("public void onPermissionResult"),
      native.indexOf("public void liberar()")
    );
    assert.match(permiso, /arranquePendiente/, "debe recordarse que el arranque estaba pendiente");
    assert.match(permiso, /start\(\)/, "al concederse el permiso debe arrancar la escucha");
    assert.match(
      permiso,
      /emitir\("permission", "Permiso de micrófono denegado/,
      "al denegarse debe INFORMAR de que puede escribirse en el cuadro de texto"
    );
  });

  test("11. Doble escucha imposible: una sola sesión activa a la vez (y autocuración)", () => {
    const native = read(NATIVE);
    const start = native.slice(native.indexOf("public void start()"), native.indexOf("public void stop()"));
    // El INVARIANTE sigue siendo el mismo: una escucha VIVA impide abrir otra.
    assert.match(
      start,
      /if \(activo\) \{[\s\S]{0,140}if \(inactividad < SESION_COLGADA_MS\) \{[\s\S]{0,40}return;/,
      "start() debe respetar la escucha en curso (nunca dos sesiones a la vez)"
    );
    // …pero una sesión COLGADA (el motor no entrega NADA) ya no puede dejar el
    // micrófono muerto: se cierra a la fuerza y se arranca de nuevo. Es el P0
    // "Dictar funciona una vez y luego ya no", que antes salía en silencio.
    assert.match(
      start,
      /cerrarPorFuerza\("start-con-sesion-colgada"\)/,
      "una sesión colgada se cierra a la fuerza y el arranque continúa"
    );
    assert.doesNotMatch(
      start,
      /if \(activo\) return;/,
      "no puede quedar una salida silenciosa que deje el botón muerto"
    );
    const voice = read(VOICE);
    const arranque = voice.slice(
      voice.indexOf("function iniciarEscuchaNativa"),
      voice.indexOf("function iniciarEscuchaWeb")
    );
    assert.match(
      arranque,
      /if \(n\.activo && !n\.finalizado\) return;/,
      "el cliente tampoco puede lanzar dos escuchas nativas seguidas"
    );
    assert.match(arranque, /puente\.start\(\)/, "y solo puede arrancar por el canal del puente");
  });

  test("12. onResults es un SEGMENTO: se reanuda la escucha, no se cierra el turno", () => {
    const native = read(NATIVE);
    const onResults = native.slice(
      native.indexOf("public void onResults(Bundle results)"),
      native.indexOf("public void onError(int error)")
    );
    assert.match(onResults, /emitir\("final", texto\)/, "el resultado del tramo se entrega como segmento");
    assert.match(onResults, /reanudar\(\);/, "y la escucha se REANUDA conservando lo acumulado");
    assert.match(
      onResults,
      /if \(usuarioPidioParar\)[\s\S]{0,120}emitir\("stopped"/,
      "solo si el usuario pidió parar se cierra el turno"
    );
    assert.match(native, /private void reanudar\(\)/, "debe existir la reanudación del reconocedor");
    assert.match(native, /MAX_REINICIOS = 60/, "con un tope de reanudaciones que evite bucles");
    // La reanudación no destruye el reconocedor: reutiliza el mismo si sigue vivo.
    const reanudar = native.slice(native.indexOf("private void reanudar()"));
    assert.match(reanudar, /reconocedor\.startListening\(intentDictado\(\)\)/);
    assert.match(
      reanudar,
      /reinicios >= MAX_REINICIOS[\s\S]{0,120}emitir\("stopped"/,
      "al agotar las reanudaciones se cierra el turno (entrega lo acumulado)"
    );
  });

  test("13. SPEECH_TIMEOUT, NO_MATCH y CLIENT son fin de locución, NO un fallo", () => {
    const native = read(NATIVE);
    const onError = native.slice(native.indexOf("public void onError(int error)"));
    assert.match(onError, /ERROR_SPEECH_TIMEOUT/, "el timeout de habla es un fin normal");
    assert.match(onError, /ERROR_NO_MATCH/, "no entender nada también es un fin normal");
    assert.match(onError, /ERROR_CLIENT/, "el cierre del cliente también");
    assert.match(
      onError,
      /boolean finPorSilencio =[\s\S]{0,300}ERROR_CLIENT/,
      "los tres códigos deben ir juntos en la decisión `finPorSilencio`"
    );
    // Con fin por silencio se entrega lo parcial y se sigue escuchando: jamás se
    // muestra un error ni se pierde lo dicho.
    assert.match(
      onError,
      /if \(finPorSilencio\)[\s\S]{0,400}!ultimoParcial\.isEmpty\(\)[\s\S]{0,200}emitir\("final", texto\)/,
      "la parcial retenida se entrega como segmento en vez de perderse"
    );
    assert.match(
      onError,
      /if \(finPorSilencio\)[\s\S]{0,600}reanudar\(\);/,
      "y tras el fin por silencio la escucha continúa"
    );
    // Solo un error de verdad (permisos, audio, red) cierra la sesión.
    assert.match(
      onError,
      /\/\/ Error de verdad[\s\S]{0,200}activo = false;[\s\S]{0,200}emitir\("error"/,
      "solo el error real cierra la sesión y se comunica"
    );
  });

  test("14. onEndOfSpeech NO cierra: emite speechend y el turno sigue vivo", () => {
    const native = read(NATIVE);
    const finHabla = native.slice(
      native.indexOf("public void onEndOfSpeech()"),
      native.indexOf("public void onPartialResults")
    );
    assert.match(finHabla, /emitir\("speechend", ""\)/);
    assert.doesNotMatch(finHabla, /reanudar\(\)/, "no se rearma por una micro-pausa");
    assert.doesNotMatch(finHabla, /emitir\("stopped"/, "y desde luego no cierra el turno");
    const voice = read(VOICE);
    const rama = voice.slice(voice.indexOf('tipo === "speechend"'), voice.indexOf('tipo === "final"'));
    assert.match(rama, /return;/, "el cliente solo anota la pausa");
    assert.doesNotMatch(
      rama,
      /cerrarTurnoNativo|entregarTurno/,
      "una micro-pausa del motor no puede cerrar el turno (era una vía del corte)"
    );
  });

  test("15. stop() es parada suave; cancel() descarta sin entregar nada", () => {
    const native = read(NATIVE);
    const stop = native.slice(native.indexOf("public void stop()"), native.indexOf("public void cancel()"));
    assert.match(stop, /usuarioPidioParar = true;/, "Detener marca que el usuario ha terminado");
    assert.match(
      stop,
      /reconocedor\.stopListening\(\)/,
      "y deja que el motor entregue el último segmento antes de cerrar"
    );
    const cancel = native.slice(native.indexOf("public void cancel()"), native.indexOf("public void onPermissionResult"));
    assert.match(cancel, /cancelado = true;/, "Cancelar sella el turno");
    assert.match(cancel, /reconocedor\.cancel\(\)/, "y cancela de verdad el reconocedor");
    assert.match(cancel, /emitir\("cancelled", ""\)/, "avisando por el canal único");
    // Antes de escuchar nunca se emite texto: cancelar no entrega resultado.
    assert.doesNotMatch(cancel, /emitir\("final"/, "cancelar no puede entregar ningún segmento");

    const voice = read(VOICE);
    const descartar = voice.slice(voice.indexOf("const descartarEscucha"), voice.indexOf("const toggleListening"));
    assert.match(descartar, /descartadoRef\.current = true;/, "cancelar SELLA la sesión");
    assert.match(descartar, /entregaHechaRef\.current = true;/, "y bloquea cualquier entrega");
    assert.doesNotMatch(descartar, /onTranscriptRef\.current\(/, "cancelar NO entrega texto");
    assert.match(descartar, /puente\.cancel\(\)/, "cancelar descarta también en el puente nativo");
    assert.match(descartar, /recognition\.abort\(\)/, "y aborta el reconocedor del navegador");
    // Un `cancelled` tardío del puente tampoco puede resucitar el turno.
    const ramaCancelado = voice.slice(voice.indexOf('tipo === "cancelled"'), voice.indexOf('tipo === "permission"'));
    assert.match(ramaCancelado, /descartadoRef\.current = true;/);
    assert.doesNotMatch(ramaCancelado, /entregarTurno\(/);
  });
});

/**
 * COMPORTAMIENTO REAL (SDK, no texto fuente): una frase larga dictada con pausas
 * naturales llega COMPLETA y UNA sola vez; nada se pierde y nada se duplica.
 */
describe("Voz 360 — turno nativo: pausas, acumulación y entrega única", () => {
  test("16. Una pausa de 2,5-3 s NO cierra el turno", () => {
    // El umbral probado tolera la pausa natural más larga exigida (3 s).
    assert.ok(
      END_OF_SPEECH_SILENCE_MS >= 3000,
      `el umbral (${END_OF_SPEECH_SILENCE_MS} ms) debe cubrir pausas naturales de hasta 3 s`
    );
    assert.equal(DEFAULT_UTTERANCE_CONFIG.silenceMs, END_OF_SPEECH_SILENCE_MS);
    assert.equal(HEARTBEAT_MS, 250, "el cierre se decide por latido, no por un temporizador de un solo uso");

    const turno = crearTurnoNativo();
    turno.arrancar();
    turno.final("presupuesto para Juan Pérez");
    turno.avanzar(2500); // pausa natural al pensar la frase siguiente
    assert.equal(turno.latido(), null, "2,5 s de pausa NO pueden cerrar el turno");
    turno.final("cuatro enchufes a dieciocho euros");
    turno.avanzar(2900);
    assert.equal(turno.latido(), null, "ni 2,9 s");
    turno.avanzar(200);
    assert.equal(turno.latido(), "silence", "al callar de verdad (3 s) sí se cierra");
  });

  test("17. Los segmentos se ACUMULAN sin perder ni duplicar palabras", () => {
    const turno = crearTurnoNativo();
    turno.arrancar();
    const trozos = [
      "presupuesto para Juan Pérez",
      "cuatro enchufes a dieciocho euros",
      "tres metros de cable a cuatro euros",
      "y dos horas de trabajo a cincuenta euros",
      "el total con IVA incluido",
    ];
    for (const t of trozos) {
      turno.final(t);
      turno.avanzar(1500); // pausa natural entre tramos: el turno sigue vivo
      assert.equal(turno.latido(), null, `no debe cerrarse tras «${t}»`);
    }
    assert.equal(turno.cerrar(), trozos.join(" "), "la frase llega completa y en orden");
    assert.deepEqual(turno.entregas, [trozos.join(" ")], "y se entrega UNA sola vez");
  });

  test("18. Un reinicio del motor no duplica ni pierde lo ya cerrado", () => {
    const turno = crearTurnoNativo();
    turno.arrancar();
    turno.final("cuatro enchufes a dieciocho");
    turno.reiniciarMotor();
    // El motor reemite el mismo texto al reanudarse: la guarda lo descarta.
    turno.final("cuatro enchufes a dieciocho");
    turno.final("y dos horas de trabajo");
    assert.equal(
      turno.cerrar(),
      "cuatro enchufes a dieciocho y dos horas de trabajo",
      "el texto reemitido no puede duplicarse"
    );
  });

  test("19. El parcial REEMPLAZA y no se pierde si el motor nunca cierra el segmento", () => {
    const turno = crearTurnoNativo();
    turno.arrancar();
    turno.partial("cua");
    turno.partial("cuatro");
    turno.partial("cuatro enchufes");
    assert.equal(
      displayText(turno.actual),
      "cuatro enchufes",
      "las hipótesis provisionales se reemplazan, nunca se concatenan"
    );
    // El motor cerró sin marcar ningún final: la hipótesis es lo único que hay y
    // NO puede perderse.
    turno.avanzar(END_OF_SPEECH_SILENCE_MS);
    assert.equal(turno.latido(), "silence");
    assert.equal(turno.cerrar(), "cuatro enchufes", "lo último dicho se entrega igualmente");
  });

  test("20. DETENER entrega todo UNA vez; un cierre tardío no duplica nada", () => {
    const turno = crearTurnoNativo();
    turno.arrancar();
    turno.final("presupuesto para Ana");
    turno.final("con dos horas");
    const enviado = turno.cerrar(); // el latido o el botón Detener
    assert.equal(enviado, "presupuesto para Ana con dos horas");
    // El puente puede entregar un segmento más y luego su "stopped": nada de eso
    // puede producir una segunda entrega.
    turno.final("con dos horas");
    assert.equal(turno.cerrar(), "", "la entrega debe estar sellada");
    assert.deepEqual(turno.entregas, ["presupuesto para Ana con dos horas"]);
  });

  test("21. CANCELAR descarta el turno y no entrega nada", () => {
    const turno = crearTurnoNativo();
    turno.arrancar();
    turno.partial("presupuesto para");
    turno.final("presupuesto para Luis");
    turno.cancelar();
    turno.avanzar(MAX_UTTERANCE_MS);
    assert.equal(turno.cerrar(), "", "cancelar no puede entregar nada, ni siquiera al llegar el tope");
    assert.deepEqual(turno.entregas, []);
  });

  test("22. El suelo de intervención evita cerrar una frase recién empezada", () => {
    const turno = crearTurnoNativo();
    turno.arrancar();
    turno.final("cuatro");
    // El motor entrega un resultado y calla de inmediato: la frase acaba de
    // empezar y NO se cierra hasta pasar el suelo de intervención.
    turno.avanzar(MIN_UTTERANCE_MS - 1);
    assert.equal(turno.latido(), null, "por debajo del mínimo de duración no se cierra");
    turno.avanzar(1);
    assert.equal(turno.latido(), null, "el silencio aún no ha cumplido su ventana");
  });

  test("23. El cierre por tope CONSERVA lo dictado (no descarta)", () => {
    const turno = crearTurnoNativo();
    turno.arrancar();
    turno.final("presupuesto para Juan");
    // Intervención larguísima con voz reciente (el silencio NO ha vencido): el
    // tope por intervención es lo único que puede cerrarla.
    turno.avanzar(MAX_UTTERANCE_MS - 1000);
    turno.final("y dos horas de trabajo");
    turno.avanzar(2000);
    assert.equal(turno.latido(), "timeout", "el tope por intervención cierra el turno");
    assert.equal(
      turno.cerrar(),
      "presupuesto para Juan y dos horas de trabajo",
      "y lo dictado hasta ahí se conserva entero"
    );
  });

  test("24. El latido nunca cierra sin habla: una pulsación en falso no gasta el turno", () => {
    const turno = crearTurnoNativo();
    turno.arrancar();
    turno.avanzar(END_OF_SPEECH_SILENCE_MS * 3);
    assert.equal(turno.latido(), null, "sin nada reconocido no se cierra por silencio");
    turno.avanzar(MAX_UTTERANCE_MS);
    assert.equal(turno.latido(), "timeout", "solo el tope absoluto lo cierra");
  });

  test("25. El cliente usa el SDK y el latido (no acumula a mano)", () => {
    const src = read(VOICE);
    assert.match(
      src,
      /from "@\/packages\/voz360-client-sdk\/utterance"/,
      "el componente debe usar el SDK de voz probado"
    );
    for (const usado of [
      "mergeUtterances",
      "utteranceFromResults",
      "displayText",
      "finalizeReason",
      "finalUtteranceText",
      "isEmptyUtterance",
      "EMPTY_UTTERANCE",
      "HEARTBEAT_MS",
    ]) {
      assert.match(src, new RegExp(`\\b${usado}\\b`), `el SDK debe aportar ${usado}`);
    }
    assert.match(src, /finalizeReason\(\{/, "el cierre debe decidirlo finalizeReason");
    assert.match(src, /HEARTBEAT_MS\)/, "desde un latido periódico");
    // El latido del turno nativo sólo cierra cuando finalizeReason lo dice.
    const latido = src.slice(src.indexOf("function arrancarLatidoNativo"), src.indexOf("function cerrarTurnoWeb"));
    assert.match(latido, /if \(!razon\) return;/, "el latido no cierra mientras no haya motivo");
    assert.match(latido, /cerrarTurnoNativo\(razon\)/, "y cierra con el motivo que decide el SDK");
    // La acumulación nativa es la del SDK: SEGMENTOS que se fusionan.
    const ramaFinal = src.slice(src.indexOf('tipo === "final"'), src.indexOf('tipo === "stopped"'));
    assert.match(
      ramaFinal,
      /mergeUtterances\(\s*n\.actual,\s*utteranceFromResults\(\[\{ transcript: texto, isFinal: true \}\]\)\s*\)/,
      "un final nativo se fusiona como segmento"
    );
    const ramaPartial = src.slice(src.indexOf('tipo === "partial"'), src.indexOf('tipo === "speechend"'));
    assert.match(
      ramaPartial,
      /n\.actual = \{ segments: n\.actual\.segments, interim: texto \};/,
      "un parcial REEMPLAZA la hipótesis: nunca se concatena"
    );
  });

  test("26. Los silencios del motor nativo se amplían para no cortar frases normales", () => {
    const native = read(NATIVE);
    assert.match(
      native,
      /EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 4000L/,
      "el silencio de cierre debe ser 4000 ms (el valor por defecto del sistema corta antes)"
    );
    assert.match(
      native,
      /EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 4000L/,
      "el silencio de posible cierre también se amplía"
    );
    assert.match(
      native,
      /EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 1000L/,
      "y se exige una duración mínima de la locución"
    );
    assert.match(
      native,
      /EXTRA_PARTIAL_RESULTS, true/,
      "las parciales son imprescindibles para no perder lo ya dicho"
    );
    assert.match(native, /EXTRA_LANGUAGE, "es-ES"/, "el dictado es en español");
    assert.match(
      native,
      /private Intent intentDictado\(\)/,
      "el intent debe construirse en un único sitio (se usa como configuración de startListening)"
    );
  });

  test("27. /asistente muestra el estado del flujo y el borrador como «SIN GUARDAR»", () => {
    const page = read(ASISTENTE);
    for (const estado of [
      "LISTENING",
      "TRANSCRIBED",
      "PARSING",
      "DRAFT_READY",
      "AWAITING_CONFIRMATION",
      "SAVING",
      "SAVED",
      "CANCELLED",
      "ERROR",
    ]) {
      assert.match(page, new RegExp(estado), `falta el estado ${estado}`);
    }
    assert.match(page, /BORRADOR — SIN GUARDAR/, "el borrador debe anunciarse como no guardado");
    assert.match(page, /Base imponible/, "el borrador debe mostrar la base imponible");
    assert.match(page, /Total/, "el borrador debe mostrar el total");
    assert.match(page, /Observaciones/, "el borrador debe incluir observaciones");
    assert.match(page, /Guardar presupuesto/, "debe existir la acción de guardar");
    assert.match(page, /Editar/, "debe existir la acción de editar");
    assert.match(page, /Confirmar y guardar/, "el guardado exige confirmación explícita");
    // El guardado NO puede dispararse desde PARSING: sólo desde la confirmación.
    assert.match(
      page,
      /async function confirmAction\(\)/,
      "la escritura ocurre únicamente en la confirmación"
    );
    const confirmar = page.slice(page.indexOf("async function confirmAction"));
    assert.match(confirmar, /confirm_token: action\.token/, "se envía el token de un solo uso");
    assert.match(confirmar, /draft/, "se envía el borrador tal como quedó en pantalla");
  });
});

/**
 * CONTRATO DEL COMPONENTE Y DEL PUENTE (lo que no se puede ejecutar sin APK).
 * Cada aserción declara el invariante que protege, no la forma del código.
 */
describe("Voz 360 — contrato del componente y del puente nativo", () => {
  test("28. El TTS se calla en cuanto el usuario habla (barge-in real)", () => {
    const src = read(VOICE);
    // El corte efectivo lo hace /asistente en onListeningStart (speechSynthesis.cancel).
    const interrumpir = src.slice(src.indexOf("function interrumpirTts"), src.indexOf("async function activarBargeInPorEnergia"));
    assert.match(interrumpir, /onListeningStartRef\.current\?\.\(\)/);
    // Vía NATIVA: cada voz nueva (parcial o segmento) reinicia el silencio Y calla
    // al asistente. Es el ÚNICO barge-in que existe dentro de la APK.
    const canal = src.slice(src.indexOf("w.__electricistaSttEvent ="), src.indexOf('tipo === "stopped"'));
    assert.match(canal, /const hayVozNueva = \(\) => \{\s*n\.ultimaVoz = Date\.now\(\);\s*interrumpirTts\(\);/);
    assert.equal(
      (canal.match(/hayVozNueva\(\);/g) ?? []).length,
      2,
      "tanto `partial` como `final` deben marcar voz nueva (y callar el TTS)"
    );
    // Vía NAVEGADOR: onspeechstart / onaudiotart.
    assert.match(src, /recognition\.onspeechstart/, "la vía del navegador también avisa al empezar la voz");
    // Y el módulo BargeInManager deja de ser código muerto: detector de energía.
    assert.match(src, /from "@\/lib\/assistant\/barge-in-manager"/, "debe reutilizarse el módulo existente");
    assert.match(src, /new BargeInManager\(\)/);
    assert.match(src, /manager\.onBargeIn\(/, "su detección debe disparar el corte del TTS");
    assert.match(src, /getUserMedia/, "sólo puede activarse si hay micrófono accesible");
    assert.match(src, /desactivarBargeInPorEnergia\(\)/, "y hay que soltarlo al terminar");
  });

  test("29. DETENER libera el micrófono ANTES de entregar y no pierde nada", () => {
    const src = read(VOICE);
    const stop = src.slice(src.indexOf("const stopListening"), src.indexOf("const descartarEscucha"));
    assert.match(stop, /puenteSttNativo\(\)\?\.stop\(\)/, "Detener para el micrófono en el acto");
    assert.match(
      stop,
      /programarCierreNativoForzado\(\)/,
      "y deja una red de seguridad por si el puente no contesta"
    );
    // El cierre llama a stop() ANTES de entregar: así no se sigue captando ni se
    // realimenta la respuesta hablada.
    const cierre = src.slice(src.indexOf("function cerrarTurnoNativo"), src.indexOf("function cerrarSesionNativaSinEntrega"));
    const posicionStop = cierre.indexOf("puenteSttNativo()?.stop()");
    const posicionEntrega = cierre.indexOf("entregarTurno(dicho)");
    assert.ok(posicionStop > 0 && posicionEntrega > 0, "el cierre debe parar el micrófono y entregar");
    assert.ok(
      posicionStop < posicionEntrega,
      "el micrófono se libera SIEMPRE antes de entregar el texto"
    );
    assert.match(cierre, /finalUtteranceText\(n\.actual\)/, "se entrega TODO lo acumulado");
    // La entrega no puede ocurrir dos veces por mucho que concurran los caminos.
    assert.match(cierre, /if \(n\.finalizado\) return;/);
  });

  test("30. Una sesión colgada no deja el botón muerto", () => {
    const src = read(VOICE);
    assert.match(src, /ESPERA_CIERRE_NATIVO_MS/, "debe existir un plazo máximo de cierre nativo");
    assert.match(
      src,
      /temporizadorCierreNativoRef\.current = window\.setTimeout\(/,
      "armado como temporizador real"
    );
    assert.match(src, /function limpiarTemporizadores\(\)/, "y hay que limpiarlo al cerrar");
    // El tope absoluto del latido también acota cualquier sesión: si el motor se
    // queda mudo, finalizeReason cierra por `timeout`.
    assert.ok(MAX_UTTERANCE_MS >= 30000, `el tope debe cubrir frases de 20-30 s (${MAX_UTTERANCE_MS} ms)`);
  });

  test("31. El permiso se pide por el puente y el arranque se rearma al concederse", () => {
    const src = read(VOICE);
    // El puente gestiona el permiso: si falta, pide y arranca solo al conceder.
    assert.match(src, /puente\.start\(\)/, "el cliente arranca por el puente");
    assert.doesNotMatch(
      src,
      /pedirPermisoNativo/,
      "ya no hay un canal de permiso aparte en JS: lo gestiona el puente"
    );
    assert.match(
      src,
      /function rearmarTrasPermiso\(\)/,
      "un `listening` con el turno cerrado es el arranque automático tras conceder"
    );
    const rama = src.slice(src.indexOf('tipo === "listening"'), src.indexOf('tipo === "partial"'));
    assert.match(rama, /if \(n\.finalizado \|\| !n\.activo\) rearmarTrasPermiso\(\);/);
    assert.match(rama, /setIsListening\(true\)/, "y la escucha queda marcada como activa");
  });

  test("32. El puente se registra en onCreate y suelta el micrófono en onDestroy", () => {
    const activity = read(ACTIVITY);
    assert.match(
      activity,
      /onCreate\(Bundle savedInstanceState\) \{[\s\S]{0,200}registrarPuenteDeVoz\(\)/,
      "el puente debe exponerse al WebView en onCreate"
    );
    assert.match(
      activity,
      /addJavascriptInterface\(nativeStt, "AndroidSTT"\)/,
      "el nombre JS AndroidSTT es el contrato que consume VoiceDictation.tsx"
    );
    const construcciones = activity.match(/new NativeStt\(/g) || [];
    assert.equal(construcciones.length, 1, "el puente debe construirse en un único lugar");
    assert.match(
      activity,
      /onDestroy\(\) \{[\s\S]{0,120}nativeStt\.liberar\(\)/,
      "onDestroy debe liberar el reconocedor (si no, el micrófono se queda tomado)"
    );
    // Sin vía externa no hay resultado de Activity que reenviar.
    assert.doesNotMatch(activity, /REQ_STT/, "ya no existe el request code del dictado externo");
    assert.doesNotMatch(
      activity,
      /onActivityResult/,
      "sin ACTION_RECOGNIZE_SPEECH no hay onActivityResult propio que gestionar"
    );
  });

  test("33. El manifiesto conserva los permisos y la visibilidad que ya funcionaban", () => {
    const manifest = read(MANIFEST);
    assert.match(manifest, /android\.permission\.INTERNET/);
    assert.match(manifest, /android\.hardware\.microphone/);
    assert.match(
      manifest,
      /android:name="\.MainActivity"/,
      "la Activity principal no puede desaparecer"
    );
    assert.match(manifest, /launchMode="singleTask"/);
  });

  test("34. La puerta al diccionario de errores del puente sigue siendo útil", () => {
    const native = read(NATIVE);
    // Todos los mensajes que el puente manda en `text` son accionables en español.
    assert.match(native, /mensajeError\(int codigo\)/, "debe existir la traducción de códigos");
    assert.match(native, /ERROR_INSUFFICIENT_PERMISSIONS/, "el permiso se distingue");
    assert.match(native, /ERROR_NETWORK/, "la red se distingue");
    assert.match(native, /ERROR_RECOGNIZER_BUSY/, "el reconocedor ocupado se distingue");
    assert.match(
      native,
      /"Este teléfono no tiene reconocimiento de voz disponible\."/,
      "sin reconocedor se dice claramente (y queda el teclado)"
    );
  });
});
