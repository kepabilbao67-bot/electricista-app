package com.electricista360.app;

import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

/**
 * Activity principal de la APK (Capacitor).
 *
 * AQUI SE EXPONE EL DICTADO NATIVO A LA PAGINA. La WebView de Android no
 * implementa la Web Speech API y, al cargarse la app desde un origen http://
 * (no seguro), tampoco expone getUserMedia: sin este puente, "Dictar" no tendría
 * ninguna vía dentro de la APK. El reconocedor es el del propio teléfono
 * (android.speech.SpeechRecognizer, in-process: ni ventana externa, ni claves de
 * terceros, ni contexto seguro). Ver NativeStt.java.
 */
public class MainActivity extends BridgeActivity {

    private NativeStt nativeStt;
    /**
     * TTS NATIVO. La WebView de Android tampoco implementa la síntesis de voz
     * (`speechSynthesis`), así que sin este puente la respuesta de Voz 360 no se
     * oiría dentro de la APK. Ver NativeTts.java.
     */
    private NativeTts nativeTts;
    /** WebView para el que ya se registró el puente (evita duplicar instancias). */
    private WebView webViewRegistrado;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registrarPuenteDeVoz();
    }

    /**
     * Se vuelve a comprobar al reanudar porque el WebView puede haberse recreado
     * (p. ej. tras recuperar la app de segundo plano) y entonces el puente tiene
     * que estar expuesto en el WebView NUEVO.
     *
     * IMPORTANTE (P0: "Dictar funciona una vez y luego ya no"): si el WebView es
     * el MISMO, se REUTILIZA la instancia en lugar de crear otra. El estado de
     * sesión del puente (activo, reconocedor, usuarioPidioParar) es por
     * instancia: crear una nueva dejaba a la instancia que usa la página con una
     * escucha colgada para siempre y a partir de ahí Dictar no volvía a
     * escuchar. Registrar es idempotente, así que repetirlo es inocuo.
     */
    @Override
    public void onResume() {
        super.onResume();
        registrarPuenteDeVoz();
    }

    /** Expone window.AndroidSTT y window.AndroidTTS en el WebView, UNA vez por WebView. */
    private void registrarPuenteDeVoz() {
        try {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView == null) return;

            // Acceso temporal sin contraseña SOLO para la APK: el token se añade
            // al User-Agent nativo y el servidor lo valida en tiempo constante.
            String mobileToken = BuildConfig.E360_MOBILE_AUTOLOGIN_TOKEN;
            if (mobileToken != null && !mobileToken.isEmpty()) {
                String marker = " Electricista360App/" + mobileToken;
                String currentUa = webView.getSettings().getUserAgentString();
                if (currentUa == null) currentUa = "";
                if (!currentUa.contains(marker)) {
                    webView.getSettings().setUserAgentString(currentUa + marker);
                }
            }

            // Ya hay puente para ESTE WebView: se reutiliza tal cual.
            if (nativeStt != null && webViewRegistrado == webView) return;
            nativeStt = new NativeStt(this, webView);
            nativeTts = new NativeTts(this, webView);
            webViewRegistrado = webView;
            // Los nombres "AndroidSTT"/"AndroidTTS" son el contrato que consume el
            // cliente (VoiceDictation.tsx y la pantalla de Voz 360). Los eventos
            // salen por canales únicos: window.__electricistaSttEvent y
            // window.__electricistaTtsEvent.
            webView.addJavascriptInterface(nativeStt, "AndroidSTT");
            webView.addJavascriptInterface(nativeTts, "AndroidTTS");
        } catch (Throwable ignored) {
            // Sin puente nativo: el dictado quedará como no disponible y la
            // pantalla ofrecerá el teclado; la respuesta se leerá en pantalla.
        }
    }

    /**
     * Resultado de la petición de RECORD_AUDIO. Se reenvía al puente para que
     * Voz 360 sepa si puede dictar: si el usuario concede, la escucha arranca
     * sola (arranquePendiente); si deniega, se le informa de que puede escribir.
     */
    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == NativeStt.REQ_PERMISO_AUDIO && nativeStt != null) {
            boolean concedido = grantResults != null && grantResults.length > 0
                    && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            nativeStt.onPermissionResult(concedido);
        }
    }

    /**
     * Al destruirse la Activity hay que soltar el reconocedor: un
     * SpeechRecognizer vivo mantiene el micrófono tomado y, si la Activity se
     * recrea, la instancia vieja seguiría escuchando en segundo plano.
     */
    @Override
    public void onDestroy() {
        if (nativeStt != null) nativeStt.liberar();
        if (nativeTts != null) nativeTts.liberar();
        super.onDestroy();
    }
}
