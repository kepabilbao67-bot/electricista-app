import os from "node:os";

import type { NextConfig } from "next";

/**
 * Orígenes de desarrollo permitidos — IP LAN DETECTADA, no escrita a mano.
 *
 * POR QUÉ HACE FALTA (P0 real, ya comprobado en este proyecto)
 * Next.js 16 bloquea por defecto las peticiones a recursos de desarrollo (/_next/*)
 * cuando llegan desde un host distinto de localhost. Sin esto, desde el POCO los
 * chunks JS y el HMR no cargan, React NO hidrata y la app queda SIN INTERACTIVIDAD:
 * se ve la interfaz, pero el menú ☰, "Enviar" y "Dictar" no responden y los
 * spinners no terminan nunca. El síntoma engaña porque el HTML sí llega.
 *
 * POR QUÉ YA NO HAY IP FIJA
 * Antes esto era `["localhost", "127.0.0.1", "192.168.1.141", "192.168.1.*"]`.
 * La IP literal quedaba obsoleta en cuanto el router la cambiaba por DHCP, y
 * entonces el móvil cargaba el HTML pero no hidrataba (o no cargaba nada).
 * Ahora la IP se detecta en tiempo de ARRANQUE del servidor (este fichero se
 * evalúa en Node), así que la lista siempre incluye la IP real de la máquina.
 *
 * `localhost` y `127.0.0.1` se mantienen EXPLÍCITAMENTE: se comprobó que, con la
 * lista configurada, Next 16 también bloqueaba el acceso por 127.0.0.1
 * ("Blocked cross-origin request to Next.js dev resource /_next/webpack-hmr").
 */

const ADAPTADORES_VIRTUALES =
  /wsl|hyper-?v|vethernet|virtualbox|vmware|loopback|bluetooth|docker|tailscale|zerotier|radmin|hamachi/i;

/** Todas las IPv4 privadas de la máquina, la real (WiFi/Ethernet) primero. */
function detectarOrigenesLan(): string[] {
  const candidatas: Array<{ address: string; prioridad: number }> = [];

  for (const [iface, direcciones] of Object.entries(os.networkInterfaces())) {
    for (const direccion of direcciones ?? []) {
      const esIPv4 = direccion.family === "IPv4" || (direccion.family as unknown as number) === 4;
      if (!esIPv4 || direccion.internal) continue;

      const address = direccion.address;
      let prioridad: number;
      if (/^192\.168\./.test(address)) prioridad = 0;
      else if (/^10\./.test(address)) prioridad = 1;
      else if (/^172\.(1[6-9]|2\d|3[01])\./.test(address)) prioridad = 2;
      else continue;

      if (ADAPTADORES_VIRTUALES.test(iface)) prioridad += 10;
      candidatas.push({ address, prioridad });
    }
  }

  candidatas.sort((a, b) => a.prioridad - b.prioridad);
  return Array.from(new Set(candidatas.map((c) => c.address)));
}

/**
 * Lista final. Se añaden patrones de subred privada como red de seguridad para
 * que un cambio de IP no deje la app inerte entre reinicios del servidor, pero la
 * IP exacta SIEMPRE va primero.
 */
const origenesLan = detectarOrigenesLan();

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    ...origenesLan,
    // Red de seguridad: cualquier host privado, por si la IP cambia sin reiniciar.
    "192.168.*.*",
    "10.*.*.*",
  ],
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "recharts"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
