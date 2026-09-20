import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Necesario para desarrollo desde el MÓVIL (POCO X6 Pro) y cualquier host de la LAN.
  // Next.js 16 bloquea por defecto las peticiones a recursos de desarrollo (/_next/*)
  // cuando llegan desde un host distinto de localhost: sin esto los chunks JS y el HMR
  // no cargan, React NO hidrata y la app queda sin interactividad (menú ☰, Enviar, Dictar).
  // Solo afecta al modo desarrollo; en producción es irrelevante.
  allowedDevOrigins: ["192.168.1.141", "192.168.1.*"],
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
