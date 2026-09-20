package com.electricista360.app;

import android.app.Activity;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import java.util.ArrayList;

/**
 * Puente de DICTADO NATIVO para el WebView de Capacitor (Electricista360 / Voz 360).
 *
 * MOTIVO: el WebView de Android no implementa la Web Speech API
 * (window.SpeechRecognition / webkitSpeechRecognition no existen), y en un origen
 * http://IP-de-LAN tampoco hay contexto seguro (navigator.mediaDevices es undefined).
 * Por eso "Dictar" no puede funcionar solo con JavaScript.
 *
 * SOLUCIÓN MÍNIMA: usar el reconocedor de voz del propio teléfono a través de
 * RecognizerIntent. No usa claves, ni proveedores externos, ni servicios en la nube
 * propios: lo resuelve el asistente de voz instalado en el dispositivo.
 *
 * CONTRATO JS (lo consume src/components/VoiceDictation.tsx):
 *   window.AndroidSTT.isAvailable()  -> boolean
 *   window.AndroidSTT.start()        -> abre el dictado del sistema
 *   window.__onNativeSttResult(texto)  <- transcripción
 *   window.__onNativeSttError(motivo)  <- error/cancelación
 */
public class NativeStt {

    /** Request code del dictado (compartido con MainActivity). */
    public static final int REQ_STT = 47110;

    private final Activity activity;
    private final WebView webView;
    private final Handler main = new Handler(Looper.getMainLooper());

    public NativeStt(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    /** Escapa un String de Java a un literal JSON válido para inyectarlo en JS. */
    private static String literal(String s) {
        if (s == null) return "\"\"";
        StringBuilder b = new StringBuilder(s.length() + 2);
        b.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '"' || c == '\\') {
                b.append('\\').append(c);
            } else if (c == '\n' || c == '\r' || c < 0x20) {
                b.append(' ');
            } else {
                b.append(c);
            }
        }
        return b.append('"').toString();
    }

    /** Llama a una función global del WebView con un argumento de texto. */
    private void emitir(final String funcion, final String texto) {
        final String js = "window." + funcion + " && window." + funcion + "(" + literal(texto) + ");";
        webView.post(new Runnable() {
            @Override
            public void run() {
                try {
                    webView.evaluateJavascript(js, null);
                } catch (Throwable ignored) {
                    // El WebView puede estar destruido: no hay nada que hacer.
                }
            }
        });
    }

    /** ¿Hay algún reconocedor de voz instalado en el dispositivo? */
    @JavascriptInterface
    public boolean isAvailable() {
        try {
            return SpeechRecognizer.isRecognitionAvailable(activity);
        } catch (Throwable t) {
            return false;
        }
    }

    /** Inicia el dictado del sistema. Siempre se llama desde el hilo de UI. */
    @JavascriptInterface
    public void start() {
        main.post(new Runnable() {
            @Override
            public void run() {
                try {
                    if (!SpeechRecognizer.isRecognitionAvailable(activity)) {
                        emitir("__onNativeSttError", "SIN_RECONOCEDOR");
                        return;
                    }
                    Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "es-ES");
                    intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "Dicta tu orden");
                    intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
                    activity.startActivityForResult(intent, REQ_STT);
                } catch (Throwable t) {
                    emitir("__onNativeSttError", "ERROR:" + t.getMessage());
                }
            }
        });
    }

    /** Lo invoca MainActivity.onActivityResult cuando termina el dictado del sistema. */
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != REQ_STT) return;

        if (resultCode == Activity.RESULT_OK && data != null) {
            ArrayList<String> resultados = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (resultados != null && !resultados.isEmpty()) {
                String texto = resultados.get(0);
                if (texto != null && !texto.trim().isEmpty()) {
                    emitir("__onNativeSttResult", texto.trim());
                    return;
                }
            }
            emitir("__onNativeSttError", "SIN_RESULTADO");
        } else {
            emitir("__onNativeSttError", "CANCELADO");
        }
    }
}
