/**
 * Voz 360 — PAUSAS NATURALES Y FRASES LARGAS (regresión del corte prematuro)
 *
 * Reproduce la secuencia REAL de eventos que Chrome/Android emite al dictar un
 * presupuesto de viva voz y comprueba que la frase NO se parte.
 *
 * CAUSA QUE SE BLINDA (reproducida antes del arreglo):
 *   `DEFAULT_UTTERANCE_CONFIG.silenceMs` valía 1800 ms, es decir, DENTRO del
 *   rango de pausa natural (1–2,5 s). Una sola frase de ~14 s con pausas al
 *   pensar producía 3 commits incompletos: el reconocimiento "escuchaba y
 *   transcribía pero cortaba demasiado pronto".
 *
 * Estos tests fallan si alguien vuelve a bajar el umbral por debajo del rango
 * de pausa natural, y siguen exigiendo que una frase corta se cierre sola.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  UtteranceEndpointer,
  DEFAULT_UTTERANCE_CONFIG,
} from '@/packages/voz360-client-sdk/utterance-endpointer';

/** Reloj falso determinista (sin esperas reales). */
function createFakeClock() {
  let current = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();

  return {
    now: () => current,
    setTimeout: (fn: () => void, ms: number) => {
      const id = nextId++;
      timers.set(id, { at: current + ms, fn });
      return id;
    },
    clearTimeout: (handle: unknown) => {
      timers.delete(handle as number);
    },
    advance(ms: number) {
      const target = current + ms;
      for (;;) {
        let dueId: number | null = null;
        let dueAt = Number.POSITIVE_INFINITY;
        for (const [id, timer] of timers) {
          if (timer.at <= target && timer.at < dueAt) {
            dueAt = timer.at;
            dueId = id;
          }
        }
        if (dueId === null) break;
        const timer = timers.get(dueId)!;
        timers.delete(dueId);
        current = timer.at;
        timer.fn();
      }
      current = target;
    },
    at: () => current,
  };
}

function setup() {
  const clock = createFakeClock();
  const commits: { at: number; texto: string }[] = [];
  const interims: string[] = [];

  const endpointer = new UtteranceEndpointer(
    {},
    {
      onInterim: (t) => interims.push(t),
      onCommit: (t) => commits.push({ at: clock.at(), texto: t }),
    },
    { setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, now: clock.now }
  );

  return { clock, commits, interims, endpointer };
}

/**
 * Tramos de una frase dictada de verdad, con el silencio natural (ms) que el
 * hablante hace ANTES de cada tramo al pensar lo que va a decir.
 *
 * La suma (pausas + huecos entre eventos del motor) sitúa la intervención en
 * 15-20 s, que es el caso exigido: una frase larga dictada con calma.
 */
const TRAMOS = [
  { texto: 'presupuesto para Juan García', pausa: 400 },
  { texto: 'seis horas de mano de obra', pausa: 2000 },
  { texto: 'a treinta y cinco euros la hora', pausa: 1500 },
  { texto: 'más cuatro enchufes', pausa: 2500 },
  { texto: 'y el desplazamiento incluido', pausa: 600 },
  { texto: 'el total con IVA', pausa: 1800 },
  { texto: 'me lo dejas preparado para el viernes', pausa: 1200 },
  { texto: 'y avísame cuando esté listo', pausa: 900 },
  { texto: 'gracias', pausa: 700 },
];

const FRASE_COMPLETA = TRAMOS.map((t) => t.texto).join(' ');

/** Emula el flujo del motor: pausa -> interinos (repetidos) -> touch -> final. */
function dictarFrase(endpointer: UtteranceEndpointer, clock: ReturnType<typeof createFakeClock>) {
  const acumulado: string[] = [];

  for (const tramo of TRAMOS) {
    clock.advance(tramo.pausa); // pausa natural: silencio real

    acumulado.push(tramo.texto);
    const parcial = acumulado.join(' ');
    endpointer.pushSegment(parcial, false);
    clock.advance(120);
    endpointer.pushSegment(parcial, false); // Chrome reemite el mismo interino
    clock.advance(120);
    endpointer.pushSegment(parcial, false);
    clock.advance(80);

    endpointer.touch(); // onspeechstart / onaudiostart
    clock.advance(60);

    endpointer.pushSegment(tramo.texto, true); // final del tramo
    clock.advance(100);
  }
}

describe('Voz 360 - pausas naturales y frases largas (regresión del corte)', () => {
  test('1. El umbral de silencio queda POR ENCIMA del rango de pausa natural', () => {
    // Una pausa natural al pensar dura del orden de 1-2,5 s. Si el umbral cae
    // dentro de ese rango, la frase se parte. Se exige margen real.
    assert.ok(
      DEFAULT_UTTERANCE_CONFIG.silenceMs >= 2500,
      `silenceMs=${DEFAULT_UTTERANCE_CONFIG.silenceMs} está dentro del rango de pausa natural (1-2,5 s): volvería a cortar la frase`
    );
  });

  test('2. Una frase de ~15 s con pausas de hasta 2,5 s se entrega COMPLETA y UNA sola vez', () => {
    const { clock, commits, endpointer } = setup();

    dictarFrase(endpointer, clock);
    clock.advance(5000); // el hablante calla: fin de turno

    assert.equal(
      commits.length,
      1,
      `se esperaba 1 commit, hubo ${commits.length}: ${JSON.stringify(commits)}`
    );
    assert.equal(commits[0].texto, FRASE_COMPLETA);
  });

  test('3. Una frase de 15-20 s cabe de sobra en el tope por intervención', () => {
    const { clock, commits, endpointer } = setup();

    dictarFrase(endpointer, clock);
    const antesDelSilencioFinal = clock.at();
    clock.advance(5000);

    assert.equal(commits.length, 1, 'el tope maxUtteranceMs no debe cortar una frase de 15-20 s');
    assert.ok(
      antesDelSilencioFinal >= 15000 && antesDelSilencioFinal <= 20000,
      `la intervención simulada duró ${antesDelSilencioFinal} ms; debe representar una frase de 15-20 s`
    );
    assert.ok(
      antesDelSilencioFinal < DEFAULT_UTTERANCE_CONFIG.maxUtteranceMs,
      'el tope por intervención debe superar holgadamente una frase de 15-20 s'
    );
  });

  test('4. Ninguna pausa natural intermedia produce un commit (no hay corte prematuro)', () => {
    const { clock, commits, endpointer } = setup();

    const acumulado: string[] = [];
    for (const tramo of TRAMOS) {
      clock.advance(tramo.pausa); // pausa natural: aquí cortaba antes

      acumulado.push(tramo.texto);
      endpointer.pushSegment(acumulado.join(' '), false);
      endpointer.pushSegment(tramo.texto, true);

      // Tras cada tramo, el turno DEBE seguir abierto.
      assert.equal(
        commits.length,
        0,
        `corte prematuro tras «${tramo.texto}»: ${JSON.stringify(commits)}`
      );
    }
  });

  test('5. Una frase corta se sigue cerrando sola por silencio (no se queda colgada)', () => {
    const { clock, commits, endpointer } = setup();

    endpointer.pushSegment('qué tengo hoy', true);
    clock.advance(DEFAULT_UTTERANCE_CONFIG.silenceMs - 100);
    assert.equal(commits.length, 0, 'no debe cerrar antes del umbral');

    clock.advance(200);
    assert.equal(commits.length, 1);
    assert.equal(commits[0].texto, 'qué tengo hoy');
  });

  test('6. Números e importes dictados con pausas llegan intactos a la transcripción', () => {
    const { clock, commits, endpointer } = setup();

    endpointer.pushSegment('cuatrocientos cincuenta euros', true);
    clock.advance(2200); // pausa natural tras el importe
    endpointer.pushSegment('más IVA', true);
    clock.advance(DEFAULT_UTTERANCE_CONFIG.silenceMs + 100);

    assert.equal(commits.length, 1, 'la pausa tras el importe no debe cerrar el turno');
    assert.equal(commits[0].texto, 'cuatrocientos cincuenta euros más IVA');
  });

  test('7. Terminar a mano (botón) entrega lo dictado sin esperar al silencio', () => {
    const { clock, commits, endpointer } = setup();

    endpointer.pushSegment('presupuesto para Ana', true);
    clock.advance(300);
    endpointer.pushSegment('con dos horas', true);

    const enviado = endpointer.flush();

    assert.equal(enviado, 'presupuesto para Ana con dos horas');
    assert.equal(commits.length, 1);
    assert.equal(commits[0].texto, 'presupuesto para Ana con dos horas');
  });

  test('8. Cancelar descarta el turno y no envía nada (interrupción limpia)', () => {
    const { clock, commits, endpointer } = setup();

    endpointer.pushSegment('presupuesto para', false);
    endpointer.pushSegment('presupuesto para Luis', true);
    endpointer.reset(); // el usuario cancela
    clock.advance(DEFAULT_UTTERANCE_CONFIG.silenceMs + 1000);

    assert.equal(commits.length, 0, 'cancelar no debe enviar nada a la IA');
  });
});
