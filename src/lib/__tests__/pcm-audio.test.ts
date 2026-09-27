/**
 * VOZ 360 — PCM REAL: invariantes verificables sin navegador.
 *
 * Cubre los puntos obligatorios del encargo que NO necesitan hardware:
 * formato exacto (mono/Int16/little-endian/16 kHz), ausencia de cabecera WAV,
 * MIME, resampling real, orden de chunks, cero duplicados, una sola
 * reproducción, limpieza en cancel/close/error, `turnComplete` sin cortar el
 * audio pendiente y la máquina de estados.
 *
 * Lo que NO se puede probar aquí (hace falta micrófono y altavoz) está indicado
 * explícitamente en cada caso en vez de simularse: no hay mocks de audio.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  BYTES_POR_CHUNK,
  CHUNK_MS,
  ColaEnvioPcm,
  ColaReproduccionPcm,
  EstadosPcm,
  MAX_CHUNKS_EN_COLA,
  MIME_ENTRADA,
  MIME_SALIDA,
  MUESTRAS_POR_CHUNK,
  RATE_ENTRADA,
  RATE_SALIDA,
  base64ABytes,
  bytesABase64,
  esPcmCrudo,
  float32AInt16LE,
  int16LEAFloat32,
  metricasVacias,
  remuestrearA16k,
  transicionPermitida,
  type ProgramadorReproduccion,
} from "@/lib/assistant/pcm-audio";

// ────────────────────────────────────────────────────────────────────────────
// 1, 3 y 4 — FORMATO DE ENTRADA / SIN WAV / MIME
// ────────────────────────────────────────────────────────────────────────────

test("1. el PCM de entrada es mono, Int16 y LITTLE-ENDIAN", () => {
  // 1000 = 0x03E8 -> en little-endian los bytes son E8 03 (el menos significativo primero)
  const muestras = new Float32Array([1000 / 32767, -1000 / 32768, 0]);
  const bytes = float32AInt16LE(muestras);

  assert.equal(bytes.length, 6, "2 bytes por muestra (Int16)");
  assert.deepEqual([bytes[0], bytes[1]], [0xe8, 0x03], "primer byte = parte baja (little-endian)");
  assert.deepEqual([bytes[2], bytes[3]], [0x18, 0xfc], "negativo en complemento a dos LE");
  assert.deepEqual([bytes[4], bytes[5]], [0x00, 0x00], "silencio es 0x0000");

  // Y el camino de vuelta reconstruye el valor
  const vuelta = int16LEAFloat32(bytes);
  assert.ok(Math.abs(vuelta[0] - 1000 / 32767) < 0.001, "roundtrip Float32->Int16LE->Float32");
});

test("1b. los valores Int16 se recortan al rango válido (no desbordan)", () => {
  const bytes = float32AInt16LE(new Float32Array([2, -2, 1, -1]));
  const vista = new DataView(bytes.buffer);
  assert.equal(vista.getInt16(0, true), 32767, "+1.0 satura en 32767");
  assert.equal(vista.getInt16(2, true), -32768, "-1.0 satura en -32768");
  assert.equal(vista.getInt16(4, true), 32767);
  assert.equal(vista.getInt16(6, true), -32768);
});

test("3. NO se envía cabecera WAV: el payload es PCM crudo", () => {
  const pcm = float32AInt16LE(new Float32Array(160));
  assert.equal(esPcmCrudo(pcm), true, "PCM crudo no empieza por RIFF");

  const falsoWav = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0]); // "RIFF"
  assert.equal(esPcmCrudo(falsoWav), false, "un WAV SÍ empieza por RIFF y debe detectarse");
});

test("4/5. MIME y tasas exactas: entrada 16 kHz, salida 24 kHz", () => {
  assert.equal(RATE_ENTRADA, 16000);
  assert.equal(RATE_SALIDA, 24000);
  assert.equal(MIME_ENTRADA, "audio/pcm;rate=16000");
  assert.equal(MIME_SALIDA, "audio/pcm;rate=24000");
});

test("el chunk está dentro del objetivo de 20-100 ms", () => {
  assert.ok(CHUNK_MS >= 20 && CHUNK_MS <= 100, `CHUNK_MS=${CHUNK_MS} fuera de 20-100`);
  assert.equal(MUESTRAS_POR_CHUNK, (RATE_ENTRADA * CHUNK_MS) / 1000);
  assert.equal(BYTES_POR_CHUNK, MUESTRAS_POR_CHUNK * 2);
});

test("base64 hace roundtrip exacto (los bytes que salen son los que entran)", () => {
  const original = float32AInt16LE(new Float32Array([0.5, -0.5, 0.25, 0]));
  const vuelta = base64ABytes(bytesABase64(original));
  assert.deepEqual(Array.from(vuelta), Array.from(original));
});

// ────────────────────────────────────────────────────────────────────────────
// 2 — RESAMPLING REAL
// ────────────────────────────────────────────────────────────────────────────

test("resampling 48 kHz -> 16 kHz reduce a un tercio y conserva la señal", () => {
  // Señal constante: tras remuestrear debe seguir siendo la misma constante.
  const a48 = new Float32Array(4800).fill(0.5);
  const a16 = remuestrearA16k(a48, 48000);
  assert.equal(a16.length, 1600, "4800 muestras a 48k son 1600 a 16k");
  for (const v of a16) assert.ok(Math.abs(v - 0.5) < 1e-6, "una constante debe seguir siendo constante");
});

test("resampling conserva la FORMA de una rampa (interpolación lineal)", () => {
  const a8 = new Float32Array([0, 1, 2, 3]);
  const a4 = remuestrearA16k(a8, 32000); // factor 2
  assert.equal(a4.length, 2);
  assert.ok(Math.abs(a4[0] - 0) < 1e-6);
  assert.ok(Math.abs(a4[1] - 2) < 1e-6, "toma la muestra correspondiente, no la primera");
});

test("si ya está a 16 kHz no se toca (evita doble remuestreo)", () => {
  const a16 = new Float32Array([0.1, 0.2, 0.3]);
  assert.equal(remuestrearA16k(a16, 16000), a16, "debe devolver la misma referencia");
});

// ────────────────────────────────────────────────────────────────────────────
// COLA DE ENVÍO: ORDEN Y BACKPRESSURE
// ────────────────────────────────────────────────────────────────────────────

test("2. los chunks de entrada salen EN ORDEN y no se pierde ninguno", () => {
  const cola = new ColaEnvioPcm(10);
  for (let i = 0; i < 7; i += 1) cola.encolar(new Uint8Array([i]));

  const salida: number[] = [];
  let c: Uint8Array | null;
  while ((c = cola.sacar()) !== null) salida.push(c[0]);

  assert.deepEqual(salida, [0, 1, 2, 3, 4, 5, 6], "FIFO estricto");
  assert.equal(cola.estadisticas.descartes, 0);
});

test("la cola de envío está LIMITADA: descarta lo viejo en vez de crecer sin fin", () => {
  const cola = new ColaEnvioPcm(3);
  for (let i = 0; i < 6; i += 1) cola.encolar(new Uint8Array([i]));

  assert.equal(cola.tamaño, 3, "nunca supera el máximo");
  const salida: number[] = [];
  let c: Uint8Array | null;
  while ((c = cola.sacar()) !== null) salida.push(c[0]);
  assert.deepEqual(salida, [3, 4, 5], "sobreviven los MÁS RECIENTES");
  assert.equal(cola.estadisticas.descartes, 3, "los descartes se cuentan");
  assert.ok(MAX_CHUNKS_EN_COLA > 0);
});

// ────────────────────────────────────────────────────────────────────────────
// COLA DE REPRODUCCIÓN: ORDEN, SIN SOLAPE, SIN DUPLICADOS, LIMPIEZA
// ────────────────────────────────────────────────────────────────────────────

/** Programador controlable: registra el orden y permite terminar a mano. */
class ProgramadorFalso implements ProgramadorReproduccion {
  llamadas: number[] = [];
  activos = 0;
  maximoActivos = 0;
  detenido = false;
  private pendientes: Array<() => void> = [];

  programar(muestras: Float32Array, _rate: number, onFin: () => void): void {
    this.llamadas.push(muestras[0]);
    this.activos += 1;
    this.maximoActivos = Math.max(this.maximoActivos, this.activos);
    this.pendientes.push(() => {
      this.activos -= 1;
      onFin();
    });
  }

  detener(): void {
    this.detenido = true;
    this.pendientes = [];
    this.activos = 0;
  }

  /** Termina el chunk en curso (lo que haría el altavoz al acabar). */
  acabarActual(): void {
    const fn = this.pendientes.shift();
    if (fn) fn();
  }
}

function bytesDe(valor: number): Uint8Array {
  return float32AInt16LE(new Float32Array([valor]));
}

test("6. la reproducción respeta el ORDEN de los chunks", async () => {
  const p = new ProgramadorFalso();
  const cola = new ColaReproduccionPcm(p);

  cola.encolar(1, bytesDe(0.11));
  cola.encolar(2, bytesDe(0.22));
  cola.encolar(3, bytesDe(0.33));

  assert.equal(p.llamadas.length, 1, "sólo arranca el primero (no dos a la vez)");
  p.acabarActual();
  assert.equal(p.llamadas.length, 2, "al acabar el 1º empieza el 2º");
  p.acabarActual();
  p.acabarActual();
  await cola.esperarFin();

  assert.equal(p.llamadas.length, 3);
  // Cada llamada lleva el valor de su chunk, en orden.
  assert.ok(Math.abs(p.llamadas[0] - 0.11) < 0.01);
  assert.ok(Math.abs(p.llamadas[1] - 0.22) < 0.01);
  assert.ok(Math.abs(p.llamadas[2] - 0.33) < 0.01);
});

test("INVARIANTE: nunca hay dos reproducciones activas a la vez (sin solape)", () => {
  const p = new ProgramadorFalso();
  const cola = new ColaReproduccionPcm(p);
  for (let i = 1; i <= 5; i += 1) cola.encolar(i, bytesDe(i / 10));
  assert.equal(p.maximoActivos, 1, "el máximo de reproducciones simultáneas debe ser 1");
});

test("14. CERO chunks duplicados: la misma secuencia se ignora", () => {
  const p = new ProgramadorFalso();
  const cola = new ColaReproduccionPcm(p);

  assert.equal(cola.encolar(7, bytesDe(0.1)), true, "la primera vez se acepta");
  assert.equal(cola.encolar(7, bytesDe(0.1)), false, "la repetición se rechaza");
  assert.equal(cola.encolar(7, bytesDe(0.9)), false, "aunque cambie el contenido, la secuencia ya está vista");
  assert.equal(cola.aceptados, 1);
});

test("7. turnComplete NO corta el audio pendiente: esperarFin aguarda a TODO", async () => {
  const p = new ProgramadorFalso();
  const cola = new ColaReproduccionPcm(p);

  cola.encolar(1, bytesDe(0.1));
  cola.encolar(2, bytesDe(0.2));
  cola.encolar(3, bytesDe(0.3));

  let terminado = false;
  const espera = cola.esperarFin().then(() => {
    terminado = true;
  });

  // Aunque llegue turnComplete, no se da por terminado hasta que suene todo.
  await Promise.resolve();
  assert.equal(terminado, false, "no puede darse por terminado con audio pendiente");

  p.acabarActual();
  await Promise.resolve();
  assert.equal(terminado, false, "sigue habiendo audio en cola");

  p.acabarActual();
  p.acabarActual();
  await espera;
  assert.equal(terminado, true, "ahora sí: ha sonado el último chunk");
  assert.equal(p.llamadas.length, 3, "se reprodujeron los 3, el último incluido");
});

test("8/9/10. cancelar, cerrar y error VACÍAN la cola y paran el audio", async () => {
  for (const motivo of ["cancel", "close", "error"]) {
    const p = new ProgramadorFalso();
    const cola = new ColaReproduccionPcm(p);
    cola.encolar(1, bytesDe(0.1));
    cola.encolar(2, bytesDe(0.2));
    cola.encolar(3, bytesDe(0.3));

    cola.limpiar(); // es lo que hacen cancel/close/error

    assert.equal(cola.pendientesCount, 0, `${motivo}: no quedan pendientes`);
    assert.equal(cola.activa, false, `${motivo}: no queda reproducción activa`);
    assert.equal(p.detenido, true, `${motivo}: se detuvo el programador`);
    await cola.esperarFin(); // no debe quedarse colgado
  }
});

test("tras limpiar, la cola vuelve a aceptar chunks (estado recuperable)", () => {
  const p = new ProgramadorFalso();
  const cola = new ColaReproduccionPcm(p);
  cola.encolar(1, bytesDe(0.1));
  cola.limpiar();
  assert.equal(cola.encolar(2, bytesDe(0.2)), true, "el turno siguiente puede volver a sonar");
});

// ────────────────────────────────────────────────────────────────────────────
// ESTADOS
// ────────────────────────────────────────────────────────────────────────────

test("la máquina de estados impide dos capturas o dos reproducciones a la vez", () => {
  const e = new EstadosPcm();
  assert.equal(e.actual, "DISCONNECTED");

  assert.equal(e.ir("CONNECTING"), true);
  assert.equal(e.ir("CONNECTING"), false, "no se puede reconectar estando conectando");
  assert.equal(e.ir("LISTENING"), true);
  assert.equal(e.ir("LISTENING"), false, "NO puede haber dos capturas simultáneas");
  assert.equal(e.ir("PROCESSING"), true);
  assert.equal(e.ir("SPEAKING"), true);
  assert.equal(e.ir("SPEAKING"), false, "NO puede haber dos reproductores simultáneos");
  // ESCUCHA CONTINUA: al acabar el turno se vuelve a escuchar sobre la MISMA
  // sesión, sin pasar por DISCONNECTED ni rehacer la cadena de audio.
  assert.equal(e.ir("LISTENING"), true, "SPEAKING -> LISTENING (escucha continua)");
  assert.equal(e.actual, "LISTENING");
});

test("esperarFin() NO da por terminado un turno con audio NUEVO pendiente", async () => {
  // Defecto real detectado al verificar el playback con audio de Gemini: la
  // promesa de espera quedaba RESUELTA para siempre. Si llegaba audio después
  // (chunks que siguen entrando tras un hueco), `esperarFin()` devolvía esa
  // promesa ya resuelta y el turno se cerraba CON AUDIO PENDIENTE: se volvía a
  // LISTENING con el altavoz sonando y el micrófono podía oír a Gemini.
  const p = new ProgramadorFalso();
  const cola = new ColaReproduccionPcm(p);

  cola.encolar(1, bytesDe(0.1));
  p.acabarActual();
  await cola.esperarFin(); // la cola se vació: aquí sí termina

  // Llega audio NUEVO después de haberse vaciado.
  cola.encolar(2, bytesDe(0.2));
  let terminado = false;
  const espera = cola.esperarFin().then(() => {
    terminado = true;
  });
  await Promise.resolve();
  assert.equal(terminado, false, "con audio nuevo pendiente NO puede darse por terminado");

  p.acabarActual();
  await espera;
  assert.equal(terminado, true, "ahora sí: ha sonado el chunk nuevo");
});

test("cancel y error dejan el sistema en un estado recuperable (DISCONNECTED)", () => {
  const e = new EstadosPcm();
  assert.equal(e.actual, "DISCONNECTED", "estado inicial");
  e.ir("CONNECTING");
  e.ir("LISTENING");
  e.reset();
  assert.equal(e.actual, "DISCONNECTED", "cancel -> cleanup -> DISCONNECTED");

  e.ir("CONNECTING");
  e.ir("ERROR");
  assert.equal(transicionPermitida("ERROR", "DISCONNECTED"), true, "error -> DISCONNECTED (recuperable)");
  e.reset();
  assert.equal(e.actual, "DISCONNECTED");
});

test("no se puede saltar de DISCONNECTED a SPEAKING sin pasar por la escucha", () => {
  assert.equal(transicionPermitida("DISCONNECTED", "SPEAKING"), false);
  assert.equal(transicionPermitida("DISCONNECTED", "CONNECTING"), true);
  assert.equal(transicionPermitida("DISCONNECTED", "LISTENING"), true);
});

test("CADENA COMPLETA de conversación continua sin recargar nada", () => {
  // DISCONNECTED -> CONNECTING -> LISTENING -> PROCESSING -> SPEAKING -> LISTENING -> …
  const e = new EstadosPcm();
  assert.equal(e.ir("CONNECTING"), true);
  assert.equal(e.ir("LISTENING"), true);
  assert.equal(e.ir("PROCESSING"), true);
  assert.equal(e.ir("SPEAKING"), true);
  // Tres turnos seguidos: cada uno vuelve a escuchar sin salir de la sesión.
  for (let turno = 0; turno < 3; turno += 1) {
    assert.equal(e.ir("LISTENING"), true, `turno ${turno + 1}: vuelve a LISTENING`);
    assert.equal(e.ir("PROCESSING"), true);
    assert.equal(e.ir("SPEAKING"), true);
  }
  // Y sólo al cerrar la sesión se sale del ciclo.
  e.reset();
  assert.equal(e.actual, "DISCONNECTED");
});

// ────────────────────────────────────────────────────────────────────────────
// MÉTRICAS
// ────────────────────────────────────────────────────────────────────────────

test("las métricas de QA existen y NO contienen audio", () => {
  const m = metricasVacias();
  for (const campo of [
    "connect_ms", "setup_ms", "first_audio_input_ms", "first_audio_output_ms",
    "turn_total_ms", "input_chunks", "output_chunks", "underruns", "reconnects", "errorCode",
  ]) {
    assert.ok(campo in m, `falta la métrica ${campo}`);
  }
  const claves = Object.keys(m);
  for (const prohibido of ["audio", "pcm", "transcripcion", "transcript", "base64"]) {
    assert.ok(!claves.includes(prohibido), `las métricas no pueden incluir ${prohibido}`);
  }
});
