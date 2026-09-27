package com.electricista360.app;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONObject;

import java.util.Locale;

/**
 * TTS NATIVO de Android para la APK de Electricista360 (Voz 360).
 *
 * POR QUÉ EXISTE (el hueco que cierra)
 * Voz 360 responde HABLANDO, y en el navegador eso lo hace `speechSynthesis`.
 * Pero la WebView de Android NO implementa la Web Speech API — por eso el
 * dictado tuvo que hacerse nativo (ver NativeStt.java) — así que dentro de la
 * APK `window.speechSynthesis` no existe y `readAloud()` salía sin decir nada:
 * el ciclo de voz quedaba cojo en el móvil (hablabas, te entendía, y la
 * respuesta solo se leía en pantalla).
 *
 * Este puente usa el sintetizador DEL PROPIO TELÉFONO
 * (android.speech.tts.TextToSpeech): sin red propia, sin claves, sin servicios
 * de terceros.
 *
 * CONTRATO CON LA PÁGINA (igual que el STT)
 *  - Expuesto como `window.AndroidTTS` (lo fija MainActivity).
 *  - Métodos: `isAvailable()`, `speak(texto)`, `stop()`.
 *  - Eventos por UN solo canal: `window.__electricistaTtsEvent({type, text})`
 *    con type = "start" | "done" | "error". La página los usa para el indicador
 *    de "hablando"; sin ellos, el indicador se quedaría encendido.
 *
 * DETALLE IMPORTANTE: el motor se inicializa de forma ASÍNCRONA. Si la página
 * pide hablar antes de que esté listo (lo normal la primera vez), el texto se
 * guarda y se pronuncia en cuanto el motor avisa de que está preparado; nunca se
 * pierde una respuesta por llegar temprano.
 */
public class NativeTts {

    private final Activity activity;
    private final WebView webView;
    private final Handler ui = new Handler(Looper.getMainLooper());

    private TextToSpeech tts;
    private boolean listo = false;
    private boolean fallo = false;
    /** Texto pedido antes de que el motor estuviera listo. */
    private String pendiente = null;
    /** Si el usuario pidió parar antes de que el motor arrancara. */
    private boolean silenciadoHastaListo = false;

    /** Identificador de la locución en curso (para casar sus eventos). */
    private static final String ID_LOCUCION = "electricista360-voz";

    /**
     * Número de locución: cada `speak()` abre una nueva. Sirve para que los eventos
     * de una locución vieja no cierren la nueva.
     */
    private int secuencia = 0;
    /** Si la locución en curso ya ha entregado su evento final (`done`/`error`). */
    private boolean locucionFinalizada = true;
    /**
     * VIGILANTE DE LA LOCUCIÓN.
     *
     * No todos los motores de TTS del mercado entregan `onDone` (ni `onError`): si
     * eso pasa, la página se queda en SPEAKING para siempre y el ciclo de voz deja
     * de responder ("habla una vez y ya no"). El vigilante cierra la locución por
     * tiempo y emite `done`, de modo que la página SIEMPRE vuelve a IDLE.
     */
    private Runnable watchdogLocucion = null;
    /** Margen mínimo/máximo del vigilante y coste estimado por carácter. */
    private static final long LOCUCION_BASE_MS = 1500L;
    private static final long LOCUCION_POR_CARACTER_MS = 130L;
    private static final long LOCUCION_MAX_MS = 60000L;

    public NativeTts(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
        inicializar();
    }

    private void inicializar() {
        try {
            tts = new TextToSpeech(activity, new TextToSpeech.OnInitListener() {
                @Override
                public void onInit(int estado) {
                    if (estado != TextToSpeech.SUCCESS || tts == null) {
                        fallo = true;
                        // La página se quedará con speechSynthesis (si existe) o sin
                        // voz: se le dice para que no espere un "done" que no llegará.
                        emitir("error", "sin-motor");
                        return;
                    }
                    try {
                        int resultado = tts.setLanguage(new Locale("es", "ES"));
                        if (resultado == TextToSpeech.LANG_MISSING_DATA
                                || resultado == TextToSpeech.LANG_NOT_SUPPORTED) {
                            // Se intenta el idioma por defecto antes de rendirse.
                            tts.setLanguage(Locale.getDefault());
                        }
                        tts.setSpeechRate(0.95f);
                        tts.setOnUtteranceProgressListener(new Progreso());
                        listo = true;
                        if (pendiente != null && !silenciadoHastaListo) {
                            String texto = pendiente;
                            pendiente = null;
                            pronunciar(texto);
                        } else {
                            pendiente = null;
                        }
                    } catch (Throwable t) {
                        fallo = true;
                        emitir("error", "inicializacion");
                    }
                }
            });
        } catch (Throwable t) {
            fallo = true;
        }
    }

    /** ¿Hay sintetizador utilizable? La página lo consulta para decidir la vía. */
    @JavascriptInterface
    public boolean isAvailable() {
        try {
            return !fallo && tts != null;
        } catch (Throwable t) {
            return false;
        }
    }

    /** Pronuncia un texto. Corta lo que estuviera sonando (barge-in). */
    @JavascriptInterface
    public void speak(String texto) {
        if (texto == null || texto.trim().isEmpty()) return;
        if (fallo) return;
        if (!listo) {
            // Todavía no hay motor: se guarda y se dirá al estar listo.
            pendiente = texto;
            silenciadoHastaListo = false;
            return;
        }
        pronunciar(texto);
    }

    private void pronunciar(final String texto) {
        try {
            ui.post(new Runnable() {
                @Override
                public void run() {
                    try {
                        // QUEUE_FLUSH: si el usuario vuelve a hablar, la locución
                        // anterior se corta en el acto en vez de solaparse.
                        int resultado = tts.speak(texto, TextToSpeech.QUEUE_FLUSH, null, ID_LOCUCION);
                        if (resultado == TextToSpeech.ERROR) {
                            // El motor rechazó la locución: se avisa YA para que la
                            // página no se quede esperando un fin que no va a llegar.
                            locucionFinalizada = true;
                            cancelarWatchdogLocucion();
                            emitir("error", "speak");
                            return;
                        }
                        // Se abre la locución y se avisa de que ha empezado: algunos
                        // motores no llaman a onStart, y sin `start` la página no
                        // encendería el indicador de "hablando".
                        final int miSecuencia = ++secuencia;
                        locucionFinalizada = false;
                        emitir("start", "");
                        programarWatchdogLocucion(miSecuencia, texto.length());
                    } catch (Throwable t) {
                        locucionFinalizada = true;
                        cancelarWatchdogLocucion();
                        emitir("error", "speak");
                    }
                }
            });
        } catch (Throwable t) {
            emitir("error", "speak");
        }
    }

    /**
     * Cierra la locución en curso UNA sola vez y avisa a la página. Es idempotente
     * (`locucionFinalizada`), así que da igual cuántos caminos concurran: el fin
     * normal, un error del motor, el botón de parar o el vigilante por tiempo.
     */
    private void finalizarLocucion(String motivo) {
        cancelarWatchdogLocucion();
        if (locucionFinalizada) return;
        locucionFinalizada = true;
        System.out.println("[Voz360/NativeTts] fin de locucion: " + motivo);
        emitir("done", "");
    }

    /**
     * Vigilante por tiempo: si el motor no avisa del final, la locución se cierra
     * igual. El margen crece con la longitud del texto (una respuesta larga tarda
     * más en leerse) y está acotado para no dejar el ciclo colgado nunca.
     */
    private void programarWatchdogLocucion(final int miSecuencia, int caracteres) {
        cancelarWatchdogLocucion();
        long espera = LOCUCION_BASE_MS + Math.max(0, caracteres) * LOCUCION_POR_CARACTER_MS;
        if (espera > LOCUCION_MAX_MS) espera = LOCUCION_MAX_MS;
        watchdogLocucion = new Runnable() {
            @Override
            public void run() {
                watchdogLocucion = null;
                if (miSecuencia == secuencia) {
                    finalizarLocucion("watchdog");
                }
            }
        };
        ui.postDelayed(watchdogLocucion, espera);
    }

    private void cancelarWatchdogLocucion() {
        if (watchdogLocucion != null) {
            ui.removeCallbacks(watchdogLocucion);
            watchdogLocucion = null;
        }
    }

    /** Corta la locución en curso (botón de parar o el usuario vuelve a hablar). */
    @JavascriptInterface
    public void stop() {
        try {
            if (!listo) {
                // Aún no había motor: se evita que hable al terminar de arrancar.
                silenciadoHastaListo = true;
                pendiente = null;
                return;
            }
            tts.stop();
            // El corte del usuario también es un FIN: se avisa una sola vez para que
            // la página vuelva a IDLE y el micro quede libre enseguida.
            finalizarLocucion("stop");
        } catch (Throwable ignored) {
        }
    }

    /** Suelta el motor: un TextToSpeech vivo mantiene recursos y audio tomados. */
    public void liberar() {
        try {
            cancelarWatchdogLocucion();
            locucionFinalizada = true;
            if (tts != null) {
                tts.stop();
                tts.shutdown();
            }
        } catch (Throwable ignored) {
        } finally {
            tts = null;
            listo = false;
        }
    }

    private class Progreso extends UtteranceProgressListener {
        @Override
        public void onStart(String utteranceId) {
            if (ID_LOCUCION.equals(utteranceId)) emitir("start", "");
        }

        @Override
        public void onDone(String utteranceId) {
            if (ID_LOCUCION.equals(utteranceId)) finalizarLocucion("onDone");
        }

        @Override
        public void onError(String utteranceId) {
            if (!ID_LOCUCION.equals(utteranceId)) return;
            // El motor falló: se marca como finalizada para que el vigilante no
            // vuelva a avisar y la página reciba UN solo cierre.
            locucionFinalizada = true;
            cancelarWatchdogLocucion();
            emitir("error", "utterance");
        }
    }

    /** Emite un evento a la página por el canal único. */
    private void emitir(String tipo, String texto) {
        try {
            JSONObject json = new JSONObject();
            json.put("type", tipo == null ? "" : tipo);
            json.put("text", texto == null ? "" : texto);
            final String js =
                    "window.__electricistaTtsEvent && window.__electricistaTtsEvent(" + json.toString() + ");";
            ui.post(new Runnable() {
                @Override
                public void run() {
                    try {
                        webView.evaluateJavascript(js, null);
                    } catch (Throwable ignored) {
                    }
                }
            });
        } catch (Throwable ignored) {
        }
    }
}
