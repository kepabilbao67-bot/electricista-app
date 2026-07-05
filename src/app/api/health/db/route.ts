import { NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Endpoint de diagnostico de la base de datos.
 *
 * Comprueba: (1) que las variables de Turso existen, (2) que se puede LEER,
 * (3) que se puede ESCRIBIR, y (4) que initializeDatabase() funciona. No expone
 * valores sensibles (ni token ni URL completa).
 */
export async function GET() {
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;

  const diagnostics: Record<string, unknown> = {
    tieneTURSO_DATABASE_URL: Boolean(url && url.trim()),
    tieneTURSO_AUTH_TOKEN: Boolean(token && token.trim()),
    esquemaUrl: url ? url.trim().split("://")[0] : null,
    hostUrl: url ? (url.trim().split("://")[1] || "").split(/[/?]/)[0] : null,
    urlTieneEspaciosOSaltos: url ? /\s/.test(url) : false,
    longitudToken: token ? token.trim().length : 0,
    tokenTieneEspaciosOSaltos: token ? /\s/.test(token.trim()) : false,
  };

  const db = getDbClient();

  // 1) LECTURA
  try {
    await db.execute("SELECT 1 AS ok");
    diagnostics.lectura = "OK";
  } catch (error: unknown) {
    diagnostics.lectura = "ERROR";
    diagnostics.errorLectura = (error instanceof Error ? error.message : String(error)).slice(0, 300);
  }

  // 2) ESCRITURA (crear tabla temporal, insertar y borrar)
  try {
    await db.execute("CREATE TABLE IF NOT EXISTS _health_check (id INTEGER PRIMARY KEY, ts TEXT)");
    await db.execute({ sql: "INSERT INTO _health_check (ts) VALUES (?)", args: [new Date().toISOString()] });
    await db.execute("DELETE FROM _health_check");
    diagnostics.escritura = "OK";
  } catch (error: unknown) {
    diagnostics.escritura = "ERROR";
    diagnostics.errorEscritura = (error instanceof Error ? error.message : String(error)).slice(0, 300);
  }

  // 3) initializeDatabase (lo que usa el guardado real de clientes/facturas)
  try {
    await initializeDatabase();
    diagnostics.initializeDatabase = "OK";
  } catch (error: unknown) {
    diagnostics.initializeDatabase = "ERROR";
    diagnostics.errorInitialize = (error instanceof Error ? error.message : String(error)).slice(0, 300);
  }

  const todoOk =
    diagnostics.lectura === "OK" &&
    diagnostics.escritura === "OK" &&
    diagnostics.initializeDatabase === "OK";

  return NextResponse.json({
    estado: todoOk ? "OK" : "ERROR",
    mensaje: todoOk
      ? "Todo correcto: se puede leer, escribir y crear tablas. Los datos se guardan bien."
      : "Hay un problema. Revisa que campo pone ERROR y su mensaje.",
    ...diagnostics,
  });
}
