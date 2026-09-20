package com.electricista360.app;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private NativeStt nativeStt;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registrarPuenteDeVoz();
    }

    @Override
    public void onResume() {
        super.onResume();
        // Idempotente: si el WebView se recreó, el puente debe volver a registrarse.
        registrarPuenteDeVoz();
    }

    /**
     * Registra window.AndroidSTT en el WebView.
     * Todo va dentro de try/catch: si algo falla, la app debe abrir igualmente
     * (el dictado simplemente quedará como no disponible).
     */
    private void registrarPuenteDeVoz() {
        try {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView == null) return;
            // Registrar el mismo nombre otra vez es idempotente y re-apunta el puente
            // al WebView vigente si Capacitor lo hubiera recreado.
            nativeStt = new NativeStt(this, webView);
            webView.addJavascriptInterface(nativeStt, "AndroidSTT");
        } catch (Throwable ignored) {
            // Sin puente nativo: VozDictado mostrará que el dictado no está disponible.
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (nativeStt != null && requestCode == NativeStt.REQ_STT) {
            nativeStt.onActivityResult(requestCode, resultCode, data);
        }
        super.onActivityResult(requestCode, resultCode, data);
    }
}
