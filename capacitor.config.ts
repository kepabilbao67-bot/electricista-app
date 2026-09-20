import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config — Electricista 360
 *
 * ARQUITECTURA:
 * Electricista360 es una aplicación Next.js con SSR y SQLite en servidor.
 * No puede empaquetarse como archivos estáticos (no es exportable con `next export`).
 *
 * Estrategia elegida: APK como "shell WebView" que carga el servidor remoto.
 * - En producción: apunta al servidor Vercel
 * - En desarrollo local: apunta al dev server en la red local
 *
 * Para cambiar entre entornos, modifica server.url abajo.
 */

const config: CapacitorConfig = {
  appId: "com.electricista360.app",
  appName: "Electricista 360",

  // webDir solo se usa si se hace `next export` estático.
  // Con server.url activo, este campo es ignorado pero requerido por Capacitor.
  webDir: "out",

  server: {
    // URL del servidor Next.js.
    // Para desarrollo local en la misma red WiFi que el POCO X6 Pro:
    //   url: "http://192.168.1.141:3110"  ← IP actual detectada del PC
    // NOTA: el puerto 3100 lo publica Docker Desktop (KepaForce 360) en esta
    // máquina, por eso Electricista360 usa 3110 y así no colisiona.
    // Para producción (Vercel o similar):
    //   url: "https://tu-app.vercel.app"
    //
    // Dejar vacío / comentado para empaquetar assets estáticos locales (requiere next export).
    url: process.env.CAPACITOR_SERVER_URL || "http://192.168.1.141:3110",

    // cleartext: NO se activa aqui.
    // Ponerlo a true hace que Capacitor escriba
    // android:usesCleartextTraffic="true" en el AndroidManifest generado de
    // capacitor-cordova-android-plugins, que se FUSIONA en el APK y habilita
    // HTTP en claro hacia CUALQUIER host (no solo la LAN).
    // El acceso HTTP al servidor de desarrollo se concede de forma explicita y
    // limitada en android/app/src/main/res/xml/network_security_config.xml.
    cleartext: false,
    androidScheme: "https",
  },

  android: {
    allowMixedContent: true, // para debug en red local con HTTP
    backgroundColor: "#0f172a", // slate-950 — coincide con el fondo de la app
    webContentsDebuggingEnabled: true, // permite inspeccionar desde Chrome DevTools en debug
  },

  plugins: {
    // Sin plugins adicionales — solo WebView shell
  },
};

export default config;
