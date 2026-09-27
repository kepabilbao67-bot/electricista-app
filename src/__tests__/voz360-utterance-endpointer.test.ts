/**
 * Tests del cierre de turno por pausa natural (Voz 360).
 *
 * Objetivo: demostrar con aserciones reales que una pausa natural NO corta la
 * frase y que el texto se envía completo y una sola vez.
 *
 * Reloj y temporizadores inyectados -> determinista, sin esperas reales.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  UtteranceEndpointer,
  DEFAULT_UTTERANCE_CONFIG,
  type UtteranceEndpointerConfig,
} from '@/packages/voz360-client-sdk/utterance-endpointer';

/** Reloj falso con temporizadores controlados manualmente. */
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
    /** Avanza el tiempo disparando los temporizadores vencidos en orden. */
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
    pendingTimers: () => timers.size,
  };
}

function setup(config: UtteranceEndpointerConfig = {}) {
  const clock = createFakeClock();
  const commits: string[] = [];
  const interims: string[] = [];

  const endpointer = new UtteranceEndpointer(
    config,
    {
      onInterim: (text) => interims.push(text),
      onCommit: (text) => commits.push(text),
    },
    {
      setTimeout: clock.setTimeout,
      clearTimeout: clock.clearTimeout,
      now: clock.now,
    }
  );

  return { clock, commits, interims, endpointer };
}

describe('Voz 360 - UtteranceEndpointer', () => {
  test('1. Una pausa natural corta NO cierra el turno', () => {
    const { clock, commits, endpointer } = setup({ silenceMs: 1800 });

    endpointer.pushSegment('necesito un presupuesto', true);
    // Pausa natural al pensar: muy por debajo del umbral de silencio.
    clock.advance(900);
    assert.equal(commits.length, 0, 'no debe enviar durante una pausa natural');

    endpointer.pushSegment('para la reforma del baño', true);
    clock.advance(900);
    assert.equal(commits.length, 0, 'la segunda frase mantiene el turno abierto');

    endpointer.pushSegment('y añade dos horas de mano de obra', true);
    clock.advance(900);
    assert.equal(commits.length, 0, 'el turno sigue abierto');

    // Silencio real: ahora sí termina la intervención.
    clock.advance(1000);
    assert.equal(commits.length, 1, 'se cierra exactamente una vez');
    assert.equal(
      commits[0],
      'necesito un presupuesto para la reforma del baño y añade dos horas de mano de obra'
    );
  });

  test('2. Frase larga con varias pausas se envía completa y una sola vez', () => {
    const { clock, commits, endpointer } = setup({ silenceMs: 1800 });

    const partes = [
      'presupuesto para Juan Pérez',
      'dos horas de servicio',
      'un desplazamiento',
      'y el material aparte',
      'guárdalo',
    ];
    partes.forEach((parte) => {
      endpointer.pushSegment(parte, true);
      clock.advance(1200); // pausa natural entre fragmentos
    });

    assert.equal(commits.length, 0);
    clock.advance(2000);

    assert.equal(commits.length, 1);
    assert.equal(commits[0], partes.join(' '));
  });

  test('3. Sin habla nueva tras el umbral: cierra el turno una sola vez', () => {
    const { clock, commits, endpointer } = setup({ silenceMs: 1800 });

    endpointer.pushSegment('hola', true);
    clock.advance(1800);
    assert.equal(commits.length, 1);
    assert.equal(commits[0], 'hola');

    // Seguir avanzando el reloj no debe volver a enviar.
    clock.advance(10000);
    assert.equal(commits.length, 1, 'no debe repetir el envío');
    assert.equal(endpointer.hasPending(), false);
  });

  test('4. Los resultados interinos se muestran sin enviar nada', () => {
    const { clock, commits, interims, endpointer } = setup({ silenceMs: 1800 });

    endpointer.pushSegment('quiero un presu', false);
    endpointer.pushSegment('quiero un presupuesto', false);

    assert.equal(commits.length, 0, 'un interino nunca debe enviarse');
    assert.deepEqual(interims, ['quiero un presu', 'quiero un presupuesto']);
    assert.equal(endpointer.getPendingText(), 'quiero un presupuesto');

    // El interino cuenta como actividad: reinicia el silencio.
    clock.advance(1700);
    assert.equal(commits.length, 0);

    // Al confirmarse el final, el interino no se duplica.
    endpointer.pushSegment('quiero un presupuesto', true);
    clock.advance(1800);
    assert.equal(commits.length, 1);
    assert.equal(commits[0], 'quiero un presupuesto');
  });

  test('5. flush() cierra el turno de inmediato (botón Terminar)', () => {
    const { commits, endpointer } = setup({ silenceMs: 1800 });

    endpointer.pushSegment('añade dos unidades', true);
    endpointer.pushSegment('de material', true);

    const sent = endpointer.flush();
    assert.equal(sent, 'añade dos unidades de material');
    assert.deepEqual(commits, ['añade dos unidades de material']);
    assert.equal(endpointer.hasPending(), false);
  });

  test('6. flush() sin texto pendiente no envía nada', () => {
    const { clock, commits, endpointer } = setup({ silenceMs: 1800 });

    assert.equal(endpointer.flush(), null);
    clock.advance(5000);
    assert.equal(commits.length, 0);
  });

  test('7. Ruido por debajo de minChars no se envía', () => {
    const { clock, commits, endpointer } = setup({ silenceMs: 1800, minChars: 2 });

    endpointer.pushSegment('a', true);
    clock.advance(1800);
    assert.equal(commits.length, 0, 'un segmento de 1 carácter no debe enviarse');

    // El turno queda limpio para la siguiente intervención.
    endpointer.pushSegment('vale', true);
    clock.advance(1800);
    assert.equal(commits.length, 1);
    assert.equal(commits[0], 'vale');
  });

  test('8. maxUtteranceMs acota una intervención que no termina', () => {
    const { clock, commits, endpointer } = setup({
      silenceMs: 1800,
      maxUtteranceMs: 5000,
    });

    // Habla continua: cada 800 ms llega texto nuevo, el silencio nunca vence.
    for (let i = 0; i < 10; i++) {
      endpointer.pushSegment(`palabra${i}`, true);
      clock.advance(800);
    }

    assert.equal(commits.length, 1, 'el tope de seguridad cierra la intervención');
    assert.match(commits[0], /^palabra0/);
  });

  test('9. touch() mantiene vivo el turno con voz pero sin texto', () => {
    const { clock, commits, endpointer } = setup({ silenceMs: 1800 });

    endpointer.pushSegment('estoy pensando', true);
    for (let i = 0; i < 4; i++) {
      clock.advance(1200);
      endpointer.touch(); // onspeechstart / onaudiostart
    }
    assert.equal(commits.length, 0, 'la voz activa no debe cerrar el turno');

    clock.advance(1800);
    assert.equal(commits.length, 1);
  });

  test('10. Los segmentos finales duplicados no se repiten en el texto', () => {
    const { clock, commits, endpointer } = setup({ silenceMs: 1800 });

    endpointer.pushSegment('crear cliente María Gómez', true);
    endpointer.pushSegment('crear cliente María Gómez', true); // reemisión del motor
    clock.advance(1800);

    assert.equal(commits.length, 1);
    assert.equal(commits[0], 'crear cliente María Gómez');
  });

  test('11. reset() descarta el turno; dispose() ignora entradas posteriores', () => {
    const { clock, commits, endpointer } = setup({ silenceMs: 1800 });

    endpointer.pushSegment('texto descartado', true);
    endpointer.reset();
    clock.advance(5000);
    assert.equal(commits.length, 0, 'reset no debe enviar nada');

    endpointer.pushSegment('texto válido', true);
    endpointer.dispose();
    clock.advance(5000);
    assert.equal(commits.length, 0, 'tras dispose no debe procesarse nada');
    assert.equal(endpointer.hasPending(), false);
  });

  test('12. La configuración por defecto tolera pausas naturales (>1 s)', () => {
    assert.ok(
      DEFAULT_UTTERANCE_CONFIG.silenceMs >= 1500,
      'el umbral debe superar el cierre automático del navegador (~0,7-1 s)'
    );
    assert.equal(DEFAULT_UTTERANCE_CONFIG.minChars, 2);

    const { clock, commits, endpointer } = setup({});
    endpointer.pushSegment('primera parte', true);
    clock.advance(1500);
    assert.equal(commits.length, 0, 'con la configuración real una pausa de 1,5 s no corta');
    endpointer.pushSegment('segunda parte', true);
    clock.advance(DEFAULT_UTTERANCE_CONFIG.silenceMs);
    assert.equal(commits[0], 'primera parte segunda parte');
  });
});
