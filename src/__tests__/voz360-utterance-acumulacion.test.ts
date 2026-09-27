/**
 * REGRESIÓN — ACUMULACIÓN Y CIERRE DE FRASE (núcleo de voz)
 *
 * Este es el comportamiento que el usuario confirma que debe tener la escucha:
 * frases de 20-30 s con pausas naturales de hasta ~3 s, sin perder ni duplicar
 * texto, y conservando lo acumulado entre reinicios del motor (Android/Chrome
 * cierran la sesión por su cuenta).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  EMPTY_UTTERANCE,
  END_OF_SPEECH_SILENCE_MS,
  MAX_UTTERANCE_MS,
  MIN_UTTERANCE_MS,
  committedText,
  displayText,
  finalizeReason,
  finalUtteranceText,
  isEmptyUtterance,
  mergeUtterances,
  utteranceFromResults,
} from '@/packages/voz360-client-sdk/utterance';

describe('Voz360 · acumulación de transcripción', () => {
  test('1. Separa lo cerrado por el motor de la hipótesis provisional', () => {
    const u = utteranceFromResults([
      { transcript: 'presupuesto para Juan', isFinal: true },
      { transcript: 'cuatro enchufes', isFinal: false },
    ]);
    assert.equal(committedText(u), 'presupuesto para Juan');
    assert.equal(u.interim, 'cuatro enchufes');
    assert.equal(displayText(u), 'presupuesto para Juan cuatro enchufes');
  });

  test('2. Las hipótesis provisionales se REEMPLAZAN, no se concatenan', () => {
    const primera = utteranceFromResults([{ transcript: 'cua', isFinal: false }]);
    const segunda = utteranceFromResults([
      { transcript: 'cua', isFinal: false },
      { transcript: 'cuatro', isFinal: false },
    ]);
    assert.equal(segunda.interim, 'cuatro', 'no debe quedar «cua cuatro»');
    assert.equal(displayText(primera), 'cua');
  });

  test('3. Reconstruir desde la lista completa no duplica lo ya cerrado', () => {
    const corta = utteranceFromResults([{ transcript: 'cuatro enchufes', isFinal: true }]);
    const larga = utteranceFromResults([
      { transcript: 'cuatro enchufes', isFinal: true },
      { transcript: 'tres metros de cable', isFinal: true },
    ]);
    assert.equal(committedText(corta), 'cuatro enchufes');
    assert.equal(committedText(larga), 'cuatro enchufes tres metros de cable');
  });

  test('4. Ignora trozos vacíos y normaliza espacios', () => {
    const u = utteranceFromResults([
      { transcript: '   ', isFinal: true },
      { transcript: '  presupuesto   para   Ana  ', isFinal: true },
      { transcript: '', isFinal: false },
    ]);
    assert.equal(committedText(u), 'presupuesto para Ana');
    assert.equal(u.interim, '');
  });

  test('5. No pierde lo dicho si el motor nunca cierra el segmento', () => {
    const u = utteranceFromResults([{ transcript: 'cuatro enchufes a dieciocho', isFinal: false }]);
    assert.equal(committedText(u), '');
    assert.equal(finalUtteranceText(u), 'cuatro enchufes a dieciocho');
  });

  test('6. Detecta la escucha sin contenido', () => {
    assert.equal(isEmptyUtterance(EMPTY_UTTERANCE), true);
    assert.equal(isEmptyUtterance(utteranceFromResults([{ transcript: '  ', isFinal: true }])), true);
    assert.equal(isEmptyUtterance(utteranceFromResults([{ transcript: 'hola', isFinal: false }])), false);
  });
});

describe('Voz360 · reinicio del motor (Android/Chrome)', () => {
  test('7. Concatena lo capturado antes y después de un reinicio', () => {
    const antes = utteranceFromResults([{ transcript: 'presupuesto para Juan', isFinal: true }]);
    const despues = utteranceFromResults([{ transcript: 'cuatro enchufes a dieciocho', isFinal: true }]);
    assert.equal(
      committedText(mergeUtterances(antes, despues)),
      'presupuesto para Juan cuatro enchufes a dieciocho'
    );
  });

  test('8. Descarta el texto ya cerrado que el motor reemite al reiniciarse', () => {
    const antes = utteranceFromResults([{ transcript: 'cuatro enchufes a dieciocho', isFinal: true }]);
    const repetido = utteranceFromResults([{ transcript: 'cuatro enchufes a dieciocho', isFinal: true }]);
    assert.equal(
      committedText(mergeUtterances(antes, repetido)),
      'cuatro enchufes a dieciocho',
      'no debe duplicarse'
    );
  });

  test('9. Conserva la hipótesis previa mientras la sesión nueva está vacía', () => {
    const antes = utteranceFromResults([{ transcript: 'tres metros de cable', isFinal: false }]);
    assert.equal(mergeUtterances(antes, EMPTY_UTTERANCE).interim, 'tres metros de cable');
  });

  test('10. Frase de 25 s repartida en 5 sesiones del motor llega completa', () => {
    // Simula el caso real del POCO: la frase se dicta con pausas y Android
    // reinicia el reconocedor varias veces.
    const trozos = [
      'presupuesto para Juan Pérez',
      'cuatro enchufes a dieciocho euros',
      'tres metros de cable a cuatro euros',
      'y dos horas de trabajo a cincuenta euros',
      'el total con IVA incluido',
    ];
    let acumulado = EMPTY_UTTERANCE;
    for (const t of trozos) {
      acumulado = mergeUtterances(acumulado, utteranceFromResults([{ transcript: t, isFinal: true }]));
    }
    assert.equal(committedText(acumulado), trozos.join(' '));
  });
});

describe('Voz360 · decisión de cierre', () => {
  test('11. Una pausa natural corta NO cierra la frase', () => {
    assert.equal(
      finalizeReason({ sinceLastSpeechMs: 400, sinceStartMs: 400, hasSpeech: true }),
      null
    );
    assert.equal(
      finalizeReason({
        sinceLastSpeechMs: 2900,
        sinceStartMs: 6000,
        hasSpeech: true,
      }),
      null,
      `una pausa de 2,9 s no debe cerrar (umbral ${END_OF_SPEECH_SILENCE_MS} ms)`
    );
  });

  test('12. Tolerar pausas de hasta ~3 s exige un umbral de al menos 3000 ms', () => {
    assert.ok(
      END_OF_SPEECH_SILENCE_MS >= 3000,
      `el umbral (${END_OF_SPEECH_SILENCE_MS} ms) debe cubrir pausas naturales de hasta 3 s`
    );
  });

  test('13. Cierra por silencio cuando el usuario ha terminado de hablar', () => {
    assert.equal(
      finalizeReason({
        sinceLastSpeechMs: END_OF_SPEECH_SILENCE_MS,
        sinceStartMs: 6000,
        hasSpeech: true,
      }),
      'silence'
    );
  });

  test('14. Sigue escuchando si aún no se ha oído nada (no gasta el turno)', () => {
    assert.equal(
      finalizeReason({ sinceLastSpeechMs: 9000, sinceStartMs: 9000, hasSpeech: false }),
      null,
      'sin voz reconocida no se cierra por silencio'
    );
  });

  test('15. Suelo de intervención: no se cierra una frase recién empezada', () => {
    assert.equal(
      finalizeReason({
        sinceLastSpeechMs: END_OF_SPEECH_SILENCE_MS,
        sinceStartMs: MIN_UTTERANCE_MS - 1,
        hasSpeech: true,
      }),
      null,
      'por debajo del mínimo de duración no se cierra'
    );
  });

  test('16. Cierra por tope aunque no haya habido voz', () => {
    assert.equal(
      finalizeReason({ sinceLastSpeechMs: MAX_UTTERANCE_MS, sinceStartMs: MAX_UTTERANCE_MS, hasSpeech: false }),
      'timeout'
    );
  });

  test('17. Una frase de 20-30 s cabe sin que salte el tope', () => {
    assert.ok(MAX_UTTERANCE_MS >= 30000, `el tope (${MAX_UTTERANCE_MS} ms) debe cubrir 20-30 s`);
    assert.ok(END_OF_SPEECH_SILENCE_MS < MAX_UTTERANCE_MS);
  });

  test('18. Tiempos negativos no cierran la frase (relojes raros)', () => {
    assert.equal(finalizeReason({ sinceLastSpeechMs: -50, sinceStartMs: -50, hasSpeech: true }), null);
  });
});
