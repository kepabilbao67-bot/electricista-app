import { NextResponse } from "next/server";
import { getDbClient } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Endpoint de diagnostico de la base de datos.
 *
 * Sirve para comprobar si las variables de Turso estan bien configuradas y si
 * la conexion funciona, SIN exponer los valores sensibles (no devuelve ni el
 * token ni la URL completa, solo pistas para diagnosticar).
 */
export async function GET() {
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;

  const diagnostics = {
    // Nombres de variables detectados (deben ser TURSO_DATABASE_URL y TURSO_AUTH_TOKEN)
    tieneTURSO_DATABASE_URL: Boolean(url && url.trim()),
    tieneTURSO_AUTH_TOKEN: Boolean(token && token.trim()),
    // Pistas sobre la URL (sin revelarla entera)
    esquemaUrl: url ? url.trim().split("://")[0] : null,
    hostUrl: url ? (url.trim().split("://")[1] || "").split(/[/?]/)[0] : null,
    urlTieneEspaciosOSaltos: url ? /\s/.test(url) : false,
    longitudToken: token ? token.trim().length : 0,
    tokenTieneEspaciosOSaltos: token ? /\s/.test(token.trim()) : false,
  };

  try {
    const db = getDbClient();
    await db.execute("SELECT 1 AS ok");
    return NextResponse.json({
      estado: "OK",
      conectado: true,
      mensaje: "Conexion a la base de datos correcta. Los datos se guardan bien.",
      ...diagnostics,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        estado: "ERROR",
        conectado: false,
        mensaje: "No se pudo conectar a la base de datos.",
        errorConexion: message.slice(0, 300),
        ...diagnostics,
      },
      { status: 200 }
    );
  }
}
