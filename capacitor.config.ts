import os from "node:os";

import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config — Electricista 360
 *
 * ARQUITECTURA (no cambiar sin leer esto):
 * Electricista360 es una aplicación Next.js con SSR y SQLite en servidor.
 * NO puede empaquetarse como archivos estáticos (no es exportable con `next export`).
 *
 * Estrategia elegida: APK como "shell WebView" que carga el servidor remoto.
 * - En desarrollo local: apunta al dev server de la LAN (0.0.0.0:3110)
 * - En producción: apunta al servidor HTTPS (Vercel)
 *
 * El APK NECESITA servidor: no hay contenido local de respaldo. Si la URL no
 * responde, la WebView se queda en blanco. Por eso `START-ELECTRICISTA360-MOBILE.ps1`
 * levanta el servidor ANTES de que el usuario abra la app.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IP LAN — POR QUÉ YA NO HAY NINGUNA IP FIJA AQUÍ (P0 corregido)
 *
 * Antes esto era `url: process.env.CAPACITOR_SERVER_URL || "http://192.168.1.141:3110"`:
 * una IP literal. El router asigna IP por DHCP, de modo que en cuanto cambiaba
 * (otro día, otro arranque, otra red) el APK apuntaba a un host inexistente y la
 * app "no abría": la WebView mostraba un error de red y el usuario no veía ni la
 * pantalla de login. Lo mismo ocurría en `network_security_config.xml`, donde la
 * IP también estaba escrita a mano y, además, Android NO admite rangos ni
 * comodines en `<domain>` (una entrada "192.168.1.0" no cubre ".141").
 *
 * Ahora la IP se DETECTA EN TIEMPO DE COMPILACIÓN (este archivo se evalúa en Node
 * cuando se ejecuta `npx cap sync` / `npx cap copy`), de modo que cada compilación
 * del APK queda coherente con la red real y no hay ningún valor obsoleto que
 * mantener a mano.
 *
 * Precedencia:
 *   1. CAPACITOR_SERVER_URL  → permite fijar una URL explícita (p. ej. Vercel).
 *   2. IP LAN detectada      → http://<ip>:3110
 *   3. localhost             → último recurso (emulador / misma máquina).
 *
 * `scripts/mobile/sync-lan-config.mjs` usa EXACTAMENTE la misma detección para
 * escribir el `<domain>` de network_security_config.xml, así que ambos ficheros
 * no pueden desincronizarse.
 * ────────────────────────────────────────────────────────────────────────────
 */

/** Puerto del dev server de Next.js (3100 lo ocupa Docker Desktop / KepaForce). */
export const DEV_SERVER_PORT = 3110;

/**
 * Nombres de adaptador que NO son la LAN real del usuario: adaptadores virtuales
 * de WSL/Hyper-V/VirtualBox/VMware, Bluetooth y loopback. Se descartan para no
 * elegir una IP a la que el POCO no puede llegar.
 */
const ADAPTADORES_VIRTUALES = /wsl|hyper-?v|vethernet|virtualbox|vmware|loopback|bluetooth|docker|tailscale|zerotier|radmin|hamachi/i;

/**
 * Devuelve la IPv4 privada de la LAN, o null si no hay ninguna.
 *
 * Orden de preferencia: 192.168.x.x → 10.x.x.x → 172.16-31.x.x. Se prefiere
 * siempre una dirección de rango privado porque es la única que el móvil puede
 * alcanzar en la misma WiFi.
 */
export function detectarIpLan(): string | null {
  const candidatas: Array<{ address: string; iface: string; prioridad: number }> = [];

  for (const [iface, direcciones] of Object.entries(os.networkInterfaces())) {
    for (const direccion of direcciones ?? []) {
      // `family` es "IPv4" en Node >= 18 (en versiones antiguas era 4).
      const esIPv4 = direccion.family === "IPv4" || (direccion.family as unknown as number) === 4;
      if (!esIPv4 || direccion.internal) continue;

      const address = direccion.address;

      // Solo rangos privados (RFC 1918). Una IP pública no sirve para la LAN.
      let prioridad: number;
      if (/^192\.168\./.test(address)) prioridad = 0;
      else if (/^10\./.test(address)) prioridad = 1;
      else if (/^172\.(1[6-9]|2\d|3[01])\./.test(address)) prioridad = 2;
      else continue;

      // Un adaptador virtual nunca debe ganar a la WiFi/Ethernet real.
      if (ADAPTADORES_VIRTUALES.test(iface)) prioridad += 10;

      candidatas.push({ address, iface, prioridad });
    }
  }

  if (candidatas.length === 0) return null;

  candidatas.sort((a, b) => a.prioridad - b.prioridad || a.iface.localeCompare(b.iface));
  return candidatas[0].address;
}

const ipLan = detectarIpLan();
const urlDetectada = ipLan ? `http://${ipLan}:${DEV_SERVER_PORT}` : `http://localhost:${DEV_SERVER_PORT}`;

/** URL final del servidor que se grabará en el APK. */
export const serverUrl = process.env.CAPACITOR_SERVER_URL || urlDetectada;

const config: CapacitorConfig = {
  appId: "com.electricista360.app",
  appName: "Electricista 360",

  // webDir solo se usa si se hiciera `next export` estático.
  // Con server.url activo, este campo es ignorado pero requerido por Capacitor.
  webDir: "out",

  server: {
    url: serverUrl,

    // cleartext: NO se activa aqui.
    // Ponerlo a true hace que Capacitor escriba
    // android:usesCleartextTraffic="true" en el AndroidManifest generado de
    // capacitor-cordova-android-plugins, que se FUSIONA en el APK y habilita
    // HTTP en claro hacia CUALQUIER host (no solo la LAN).
    // El acceso HTTP al servidor de desarrollo se concede de forma explicita y
    // limitada en android/app/src/main/res/xml/network_security_config.xml,
    // cuyo <domain> mantiene sincronizado scripts/mobile/sync-lan-config.mjs.
    cleartext: false,
    androidScheme: "https",
  },

  android: {
    allowMixedContent: true, // necesario para cargar HTTP en la LAN desde una WebView con esquema https
    backgroundColor: "#0f172a", // slate-950 — coincide con el fondo de la app
    webContentsDebuggingEnabled: true, // permite inspeccionar desde Chrome DevTools
  },

  plugins: {
    // Sin plugins adicionales — solo WebView shell
  },
};

export default config;
