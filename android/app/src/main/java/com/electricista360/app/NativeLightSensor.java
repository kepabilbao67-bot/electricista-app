package com.electricista360.app;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

/**
 * Puente nativo del sensor de luz para Luz360.
 *
 * La Generic Sensor API (AmbientLightSensor) no está disponible de forma fiable
 * en Android WebView/Chrome. Este puente usa directamente Sensor.TYPE_LIGHT y
 * entrega lux al JavaScript de la aplicación mediante window.__electricistaLightEvent.
 *
 * No requiere permiso runtime. Si el teléfono no incorpora sensor de luz, se
 * informa a la UI y Luz360 conserva la entrada manual de luxómetro.
 */
public final class NativeLightSensor implements SensorEventListener {

    private final SensorManager sensorManager;
    private final Sensor lightSensor;
    private final WebView webView;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean listening = false;

    public NativeLightSensor(Context context, WebView webView) {
        this.sensorManager = (SensorManager) context.getSystemService(Context.SENSOR_SERVICE);
        this.lightSensor = sensorManager != null ? sensorManager.getDefaultSensor(Sensor.TYPE_LIGHT) : null;
        this.webView = webView;
    }

    @JavascriptInterface
    public boolean isAvailable() {
        return lightSensor != null;
    }

    @JavascriptInterface
    public boolean start() {
        if (lightSensor == null || sensorManager == null) {
            emitError("Sensor de luz no disponible");
            return false;
        }

        if (listening) return true;

        mainHandler.post(() -> {
            if (listening) return;
            listening = sensorManager.registerListener(
                this,
                lightSensor,
                SensorManager.SENSOR_DELAY_NORMAL,
                mainHandler
            );
            if (!listening) emitError("No se pudo iniciar el sensor de luz");
        });
        return true;
    }

    @JavascriptInterface
    public void stop() {
        mainHandler.post(() -> {
            if (sensorManager != null) {
                sensorManager.unregisterListener(this);
            }
            listening = false;
        });
    }

    public void liberar() {
        stop();
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event == null || event.values == null || event.values.length == 0) return;
        final float lux = event.values[0];
        if (!Float.isFinite(lux) || lux < 0f) return;

        webView.post(() -> webView.evaluateJavascript(
            "window.__electricistaLightEvent && window.__electricistaLightEvent({type:'reading',lux:" + lux + "});",
            null
        ));
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // La UI solo necesita la lectura; Android no expone una calibración
        // certificada comparable a un luxómetro profesional.
    }

    private void emitError(String message) {
        final String safe = message.replace("\\", "\\\\").replace("'", "\\'");
        webView.post(() -> webView.evaluateJavascript(
            "window.__electricistaLightEvent && window.__electricistaLightEvent({type:'error',message:'" + safe + "'});",
            null
        ));
    }
}
