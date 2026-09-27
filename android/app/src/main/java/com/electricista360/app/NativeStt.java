package com.electricista360.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONObject;

import java.util.ArrayList;

/**
 * STT NATIVO de Android para la APK de Electricista360 (Voz 360).
 *
 * POR QUÉ EXISTE: dentro de la WebView la app no puede dictar. Al cargar un
 * origen http:// (no seguro) el navegador embebido no expone getUserMedia, y
 * además la WebView de Android no implementa la Web Speech API. La solución es
 * usar el reconocedor NATIVO del sistema (android.speech.SpeechRecognizer),
 * que no necesita contexto seguro ni claves de terceros.
 *
 * IMPORTANTE:
 *  - Se usa SOLO SpeechRecognizer (API in-process). NUNCA
 *    RecognizerIntent.ACTION_RECOGNIZE_SPEECH por startActivityForResult, para
 *    no abrir ninguna ventana externa ni salir de la app. (Ojo: crear el Intent
 *    para pasárselo a startListening SI es la forma correcta de configurarlo;
 *    lo que NO se hace es lanzarlo como Activity.)
 *  - No usa red propia, ni claves, ni servicios de terceros: quien reconoce es
 *    el servicio de reconocimiento que ya tenga el teléfono.
 *  - Expuesto a la página como window.AndroidSTT (el nombre lo fija
 *    MainActivity.addJavascriptInterface para no cambiar el contrato del
 *    cliente). Los eventos se envían a window.__electricistaSttEvent({type, text}).
 *
 * EVENTOS (UN solo canal): listening | partial | final | error | cancelled |
 * stopped | permission | speechend
 */
public class NativeStt {

    /** Código de petición del permiso de micrófono (lo usa MainActivity). */
    public static final int REQ_PERMISO_AUDIO = 47111;

    private final Activity activity;
    private final WebView webView;
    private final Handler ui = new Handler(Looper.getMainLooper());

    private SpeechRecognizer reconocedor;
    private boolean activo = false;
    private boolean cancelado = false;
    private boolean arranquePendiente = false;
    /**
     * El reconocedor de Android cierra la locución por su cuenta en cuanto
     * detecta una pausa, aunque el usuario siga hablando. Antes eso terminaba el
     * turno y enviaba la frase a medias: el "corte prematuro" del POCO.
     *
     * Ahora cada `onResults` se entrega como SEGMENTO y la escucha se reanuda,
     * conservando lo ya reconocido. El turno solo termina cuando el usuario pulsa
     * Detener (`usuarioPidioParar`) o cuando la pagina lo decide por silencio.
     */
    private boolean usuarioPidioParar = false;
    private int reinicios = 0;
    /** Tope de reanudaciones: evita un bucle si el servicio falla en bucle. */
    private static final int MAX_REINICIOS = 60;
    /**
     * Ultimo texto parcial ya reconocido. Android cierra el turno por su cuenta
     * cuando detecta silencio y entonces puede entregar ERROR_SPEECH_TIMEOUT o
     * ERROR_NO_MATCH. Sin guardar lo parcial, una frase larga con una pausa
     * natural se perdia entera ("No se ha oido nada") aunque el usuario SI
     * hubiera hablado.
     */
    private String ultimoParcial = "";
    /**
     * Momento del último evento entregado a la página. Sirve para distinguir una
     * escucha VIVA de una sesión COLGADA: es la comprobación que evita el P0
     * "Dictar funciona una vez y luego ya no".
     */
    private long ultimoEvento = 0L;
    /**
     * Temporizador de seguridad de la parada suave.
     *
     * `stopListening()` no garantiza respuesta: hay teléfonos cuyo reconocedor, al
     * pararle, no entrega `onResults` NI `onError`. Sin este vigilante, `activo` se
     * quedaba en true para siempre, el siguiente `start()` salía sin hacer nada y el
     * micrófono no volvía a escuchar hasta reiniciar la app.
     */
    private Runnable watchdogParada = null;
    /** Espera máxima de la parada suave antes de liberar el micrófono a la fuerza. */
    private static final long ESPERA_PARADA_MS = 1500L;
    /** Una sesión sin eventos durante este tiempo se considera colgada. */
    private static final long SESION_COLGADA_MS = 1000L;

    public NativeStt(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    /** ¿Hay un servicio de reconocimiento utilizable en este teléfono? */
    @JavascriptInterface
    public boolean isAvailable() {
        try {
            return SpeechRecognizer.isRecognitionAvailable(activity);
        } catch (Throwable t) {
            return false;
        }
    }

    /** ¿Está concedido RECORD_AUDIO en tiempo de ejecución? */
    @JavascriptInterface
    public boolean hasPermission() {
        try {
            return activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                    == PackageManager.PERMISSION_GRANTED;
        } catch (Throwable t) {
            return false;
        }
    }

    /** Pide RECORD_AUDIO. Si el usuario concede, la escucha arranca sola. */
    @JavascriptInterface
    public void requestPermission() {
        ui.post(new Runnable() {
            @Override
            public void run() {
                try {
                    arranquePendiente = true;
                    activity.requestPermissions(
                            new String[]{Manifest.permission.RECORD_AUDIO},
                            REQ_PERMISO_AUDIO);
                } catch (Throwable t) {
                    arranquePendiente = false;
                    emitir("permission", "No se pudo pedir el permiso de micrófono.");
                }
            }
        });
    }

    /** Arranca una escucha. Nunca deja el micrófono muerto por una sesión anterior. */
    @JavascriptInterface
    public void start() {
        ui.post(new Runnable() {
            @Override
            public void run() {
                // P0 "Dictar funciona una vez y luego ya no": si la sesión anterior no
                // se cerró (el motor no entregó NADA tras stopListening), `activo`
                // seguía en true y este método salía en silencio: a partir de ahí,
                // pulsar Dictar no hacía absolutamente nada.
                //
                // Ahora una sesión COLGADA se cierra a la fuerza y se arranca de nuevo.
                // Una sesión VIVA (con eventos recientes) sí se respeta: sigue sin
                // poder haber dos escuchas a la vez.
                if (activo) {
                    long inactividad = System.currentTimeMillis() - ultimoEvento;
                    if (inactividad < SESION_COLGADA_MS) {
                        return;
                    }
                    cerrarPorFuerza("start-con-sesion-colgada");
                }
                if (!hasPermission()) {
                    emitir("permission", "Concede el permiso de micrófono y vuelve a pulsar.");
                    requestPermission();
                    return;
                }
                if (!isAvailable()) {
                    emitir("error", "Este teléfono no tiene reconocimiento de voz disponible.");
                    return;
                }
                try {
                    destruirReconocedor();
                    reconocedor = SpeechRecognizer.createSpeechRecognizer(activity);
                    reconocedor.setRecognitionListener(new EscuchaDirecta());
                    activo = true;
                    cancelado = false;
                    usuarioPidioParar = false;
                    reinicios = 0;
                    ultimoParcial = "";
                    ultimoEvento = System.currentTimeMillis();
                    emitir("listening", "Escuchando");
                    reconocedor.startListening(intentDictado());
                } catch (Throwable t) {
                    activo = false;
                    emitir("error", "No se pudo iniciar el reconocedor: " + t.getMessage());
                }
            }
        });
    }

    /** Termina la escucha y entrega lo dicho (equivale a "he acabado de hablar"). */
    @JavascriptInterface
    public void stop() {
        ui.post(new Runnable() {
            @Override
            public void run() {
                try {
                    if (reconocedor != null && activo) {
                        // Detener = "he terminado": se deja que el motor entregue
                        // el ultimo segmento y despues se cierra el turno.
                        usuarioPidioParar = true;
                        programarWatchdogParada();
                        reconocedor.stopListening();
                    } else {
                        emitir("stopped", "");
                    }
                } catch (Throwable t) {
                    cerrarPorFuerza("stop-con-error");
                }
            }
        });
    }

    /** Cancela sin enviar nada. Deja SIEMPRE el reconocedor libre. */
    @JavascriptInterface
    public void cancel() {
        ui.post(new Runnable() {
            @Override
            public void run() {
                cancelado = true;
                activo = false;
                cancelarWatchdogParada();
                try {
                    if (reconocedor != null) reconocedor.cancel();
                } catch (Throwable ignored) {
                }
                // Cancelar también LIBERA el reconocedor: no se deja el micrófono
                // tomado por una sesión que el usuario ha descartado.
                destruirReconocedor();
                ultimoParcial = "";
                emitir("cancelled", "");
            }
        });
    }

    /** La Activity reenvía aquí el resultado de la petición de permiso. */
    public void onPermissionResult(boolean concedido) {
        if (concedido && arranquePendiente) {
            arranquePendiente = false;
            start();
        } else if (!concedido) {
            arranquePendiente = false;
            activo = false;
            emitir("permission", "Permiso de micrófono denegado. Puedes escribir en el cuadro de texto.");
        }
    }

    /** Libera el reconocedor (se llama desde onDestroy). */
    public void liberar() {
        ui.post(new Runnable() {
            @Override
            public void run() {
                activo = false;
                cancelarWatchdogParada();
                destruirReconocedor();
            }
        });
    }

    // ------------------------------------------------------------------

    /**
     * Suelta el reconocedor y limpia sus callbacks.
     *
     * Se llama en cancelar, en un error real y al liberar: un SpeechRecognizer que
     * se queda vivo tras un fallo mantiene el micrófono tomado y deja el motor en
     * estado "busy", que es lo que impedía volver a escuchar sin reiniciar la app.
     */
    private void destruirReconocedor() {
        if (reconocedor != null) {
            try {
                reconocedor.setRecognitionListener(null);
                reconocedor.destroy();
            } catch (Throwable ignored) {
            }
            reconocedor = null;
        }
    }

    /**
     * Cierra la sesión A LA FUERZA: suelta el reconocedor, marca la escucha como
     * terminada y avisa a la página con `stopped`.
     *
     * Es la SALIDA GARANTIZADA del puente: pase lo que pase con el motor del
     * teléfono, después de esto el micrófono queda libre y la siguiente pulsación
     * de Dictar funciona. Sin este camino, un motor que no contesta dejaba el
     * puente en `activo = true` para siempre.
     */
    private void cerrarPorFuerza(String motivo) {
        cancelarWatchdogParada();
        activo = false;
        usuarioPidioParar = true;
        ultimoParcial = "";
        destruirReconocedor();
        System.out.println("[Voz360/NativeStt] cierre forzado: " + motivo);
        emitir("stopped", "");
    }

    /**
     * Vigilante de la parada suave: si el motor no entrega nada tras
     * `stopListening()`, la sesión se cierra a la fuerza. Nunca queda un
     * temporizador huérfano: se cancela al entregar `stopped`/`error`/`cancelled`
     * y al destruir la Activity.
     */
    private void programarWatchdogParada() {
        cancelarWatchdogParada();
        watchdogParada = new Runnable() {
            @Override
            public void run() {
                watchdogParada = null;
                if (activo) {
                    cerrarPorFuerza("watchdog-parada");
                }
            }
        };
        ui.postDelayed(watchdogParada, ESPERA_PARADA_MS);
    }

    private void cancelarWatchdogParada() {
        if (watchdogParada != null) {
            ui.removeCallbacks(watchdogParada);
            watchdogParada = null;
        }
    }

    /**
     * Ajustes del dictado. Los tiempos de silencio se amplían a propósito para
     * NO cortar frases normales con pausas naturales (el valor por defecto del
     * sistema suele cerrar el turno demasiado pronto).
     */
    private Intent intentDictado() {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "es-ES");
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 4000L);
        intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 4000L);
        intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 1000L);
        return intent;
    }

    private String primerResultado(Bundle bundle) {
        if (bundle == null) return "";
        try {
            ArrayList<String> lista = bundle.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            if (lista != null && !lista.isEmpty() && lista.get(0) != null) {
                return lista.get(0).trim();
            }
        } catch (Throwable ignored) {
        }
        return "";
    }

    private String mensajeError(int codigo) {
        switch (codigo) {
            case SpeechRecognizer.ERROR_NO_MATCH:
                return "No se ha entendido nada. Prueba otra vez o escríbelo.";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                return "No se ha oído nada. Pulsa el micrófono y habla.";
            case SpeechRecognizer.ERROR_AUDIO:
                return "Error de audio del micrófono.";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                return "Falta el permiso de micrófono.";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                return "El reconocedor está ocupado. Espera un momento.";
            case SpeechRecognizer.ERROR_NETWORK:
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                return "El reconocimiento necesita conexión y no está disponible.";
            case SpeechRecognizer.ERROR_CLIENT:
                return "El reconocedor se ha detenido.";
            default:
                return "No se ha podido reconocer la voz (código " + codigo + ").";
        }
    }

    private void emitir(String tipo, String texto) {
        try {
            // Sella el latido de la sesión: es lo que permite distinguir una escucha
            // viva de una colgada en `start()`.
            ultimoEvento = System.currentTimeMillis();
            // Cualquier cierre cancela el vigilante: no quedan timers huérfanos.
            if ("stopped".equals(tipo) || "error".equals(tipo) || "cancelled".equals(tipo)) {
                cancelarWatchdogParada();
            }
            JSONObject json = new JSONObject();
            json.put("type", tipo == null ? "" : tipo);
            json.put("text", texto == null ? "" : texto);
            final String js =
                    "window.__electricistaSttEvent && window.__electricistaSttEvent(" + json.toString() + ");";
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

    /** Listener del reconocedor in-process. */
    private class EscuchaDirecta implements RecognitionListener {
        @Override
        public void onReadyForSpeech(Bundle params) {
            emitir("listening", "Escuchando");
        }

        @Override
        public void onBeginningOfSpeech() {
        }

        @Override
        public void onRmsChanged(float rmsdB) {
        }

        @Override
        public void onBufferReceived(byte[] buffer) {
        }

        /**
         * El motor avisa de que ha dejado de oir voz EN ESTA ventana. No cierra
         * nada: en Android esto llega en cada micro-pausa y era otra via de corte.
         */
        @Override
        public void onEndOfSpeech() {
            if (cancelado) return;
            emitir("speechend", "");
        }

        @Override
        public void onPartialResults(Bundle partialResults) {
            if (cancelado || !activo) return;
            String parcial = primerResultado(partialResults);
            if (!parcial.isEmpty()) {
                ultimoParcial = parcial;
                emitir("partial", parcial);
            }
        }

        /**
         * Un `onResults` es un SEGMENTO, no el final del turno. Se entrega lo
         * reconocido y, si el usuario no ha pedido parar, se REANUDA la escucha
         * conservando lo acumulado. Asi una pausa natural no corta la frase.
         */
        @Override
        public void onResults(Bundle results) {
            if (cancelado) return;

            String texto = primerResultado(results);
            // Si el motor no devuelve texto final pero ya habia parcial, se usa:
            // nunca se descarta lo que el usuario acaba de decir.
            if (texto.isEmpty()) texto = ultimoParcial;
            ultimoParcial = "";

            if (!texto.isEmpty()) {
                emitir("final", texto);
            }

            if (!activo) return;

            if (usuarioPidioParar) {
                activo = false;
                emitir("stopped", "");
                return;
            }

            reanudar();
        }

        @Override
        public void onError(int error) {
            if (cancelado || !activo) return;

            // Fin de locucion por silencio: NO es un fallo y NO cierra la frase.
            // El reconocedor de Android corta en una pausa natural y lo reporta
            // como SPEECH_TIMEOUT / NO_MATCH. Si ya hay texto reconocido se
            // entrega como segmento y se sigue escuchando.
            boolean finPorSilencio =
                    error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT
                            || error == SpeechRecognizer.ERROR_NO_MATCH
                            || error == SpeechRecognizer.ERROR_CLIENT;

            if (finPorSilencio) {
                if (!ultimoParcial.isEmpty()) {
                    String texto = ultimoParcial;
                    ultimoParcial = "";
                    emitir("final", texto);
                }
                if (usuarioPidioParar) {
                    activo = false;
                    emitir("stopped", "");
                    return;
                }
                reanudar();
                return;
            }

            // Error de verdad (permisos, audio, red): aqui si se cierra.
            activo = false;
            ultimoParcial = "";
            destruirReconocedor();
            emitir("error", mensajeError(error));
        }

        @Override
        public void onEvent(int eventType, Bundle params) {
        }
    }

    /**
     * Reanuda la escucha tras un cierre espontaneo del motor, conservando lo ya
     * reconocido. Es lo que permite dictar 20-30 s con pausas en Android.
     */
    private void reanudar() {
        if (cancelado || !activo) return;
        if (reinicios >= MAX_REINICIOS) {
            activo = false;
            emitir("stopped", "");
            return;
        }
        reinicios++;
        ui.post(new Runnable() {
            @Override
            public void run() {
                try {
                    if (cancelado || !activo) return;
                    if (reconocedor == null) {
                        reconocedor = SpeechRecognizer.createSpeechRecognizer(activity);
                        reconocedor.setRecognitionListener(new EscuchaDirecta());
                    }
                    reconocedor.startListening(intentDictado());
                } catch (Throwable t) {
                    activo = false;
                    emitir("error", "Se ha interrumpido la escucha: " + t.getMessage());
                }
            }
        });
    }
}
