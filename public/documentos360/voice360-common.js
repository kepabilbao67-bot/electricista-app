/* Voz 360 común para Documentos 360. Sin claves, sin servicios de pago. */
(function () {
  'use strict';
  if (window.Documentos360Voice) return;
  const editor = document.getElementById('content');
  const toolbar = document.querySelector('#edit .toolbar');
  if (!editor || !toolbar) return;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;
  let listening = false;
  let recognition = null;
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'voice360Listen';
  button.textContent = '🎙️ Voz 360';
  button.title = 'Dictar texto en español en Documentos 360';
  button.disabled = !SpeechRecognition;
  const readButton = document.createElement('button');
  readButton.type = 'button';
  readButton.id = 'voice360Read';
  readButton.textContent = '🔊 Leer documento';
  readButton.disabled = !synth;
  const stopButton = document.createElement('button');
  stopButton.type = 'button';
  stopButton.id = 'voice360Stop';
  stopButton.textContent = '⏹ Detener voz';
  const feedback = document.createElement('span');
  feedback.id = 'voice360Status';
  feedback.setAttribute('role', 'status');
  feedback.style.fontSize = '12px';
  feedback.textContent = SpeechRecognition ? 'Voz disponible' : 'Dictado no compatible con este navegador';
  toolbar.append(button, readButton, stopButton, feedback);
  function setStatus(message) { feedback.textContent = message; }
  function stop() {
    if (recognition && listening) recognition.stop();
    if (synth) synth.cancel();
    listening = false;
    button.textContent = '🎙️ Voz 360';
    setStatus('Voz detenida');
  }
  button.addEventListener('click', function () {
    if (!SpeechRecognition) return;
    if (listening) { stop(); return; }
    recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = function (event) {
      const spoken = String(event.results?.[0]?.[0]?.transcript || '').trim();
      if (!spoken) return;
      editor.focus();
      const selection = window.getSelection();
      if (selection && selection.rangeCount && editor.contains(selection.anchorNode)) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(spoken + ' '));
        range.collapse(false);
      } else { editor.appendChild(document.createTextNode(' ' + spoken)); }
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      setStatus('Texto dictado insertado');
    };
    recognition.onerror = function (e) { setStatus('Micrófono: ' + (e.error || 'error')); };
    recognition.onend = function () { listening = false; button.textContent = '🎙️ Voz 360'; };
    try { recognition.start(); listening = true; button.textContent = '⏹ Parar dictado'; setStatus('Escuchando'); }
    catch (e) { setStatus('No se pudo activar el micrófono'); }
  });
  readButton.addEventListener('click', function () {
    if (!synth) return;
    const text = String(window.getSelection()?.toString() || editor.innerText || '').trim().slice(0, 20000);
    if (!text) { setStatus('No hay texto para leer'); return; }
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = 1;
    utterance.onend = function () { setStatus('Lectura finalizada'); };
    utterance.onerror = function () { setStatus('Error de reproducción'); };
    synth.speak(utterance);
    setStatus('Leyendo documento');
  });
  stopButton.addEventListener('click', stop);
  Object.defineProperty(window, 'Documentos360Voice', { value: Object.freeze({ stop, capabilities: ['dictate', 'readAloud', 'stop'], provider: 'browser' }), configurable: false });
})();
