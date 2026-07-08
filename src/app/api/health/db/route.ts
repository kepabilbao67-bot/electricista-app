import { NextRequest, NextResponse } from "next/server";
import { getDbClient, initializeDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Endpoint de diagnostico de la base de datos.
 *
 * Comprueba: (1) que las variables de Turso existen, (2) que se puede LEER,
 * (3) que se puede ESCRIBIR, y (4) que initializeDatabase() funciona. No expone
 * valores sensibles (ni token ni URL completa).
 *
 * SEGURIDAD (SEC-001): este endpoint ejecuta escrituras reales contra la base
 * de datos, por eso queda protegido por una clave secreta:
 * - La clave se lee de la variable de entorno HEALTH_CHECK_SECRET.
 * - Si esa variable no esta configurada (p.ej. en produccion sin definirla),
 *   el endpoint se considera deshabilitado y responde 404 sin ejecutar nada.
 * - Si esta configurada, quien llama debe enviarla en la cabecera
 *   "x-health-check-secret" con el valor exacto; si no coincide, tambien
 *   responde 404 sin ejecutar nada.
 * - Se usa 404 en ambos casos (en vez de 401/403) para no confirmar ni la
 *   existencia del endpoint ni si la clave configurada es correcta.
 */
export async function GET(request: NextRequest) {
  const expectedSecret = process.env.HEALTH_CHECK_SECRET?.trim();

  if (!expectedSecret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const providedSecret = request.headers.get("x-health-check-secret");

  if (!providedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;

  const diagnostics: Record<string, unknown> = {
    tieneTURSO_DATABASE_URL: Boolean(url && url.trim()),
    tieneTURSO_AUTH_TOKEN: Boolean(token && token.trim()),
    esquemaUrl: url ? url.trim().split("://")[0] : null,
    urlTieneEspaciosOSaltos: url ? /\s/.test(url) : false,
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

  // 3) initializeDatabase (crea tablas y aplica la migracion de columnas)
  try {
    await initializeDatabase();
    diagnostics.initializeDatabase = "OK";
  } catch (error: unknown) {
    diagnostics.initializeDatabase = "ERROR";
    diagnostics.errorInitialize = (error instanceof Error ? error.message : String(error)).slice(0, 300);
  }

  // 4) PRUEBA REAL: insertar un cliente de prueba en la tabla clients y borrarlo.
  //    Esto reproduce exactamente lo que falla al pulsar "Crear cliente".
  try {
    const testId = `healthcheck-${Date.now()}`;
    await db.execute({
      sql: `INSERT INTO clients (id, name, nif, email, phone, address, city, postal_code, province, notes, client_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [testId, "HEALTHCHECK", null, null, null, null, null, null, null, null, "particular"],
    });
    await db.execute({ sql: "DELETE FROM clients WHERE id = ?", args: [testId] });
    diagnostics.pruebaGuardarCliente = "OK";
  } catch (error: unknown) {
    diagnostics.pruebaGuardarCliente = "ERROR";
    diagnostics.errorGuardarCliente = (error instanceof Error ? error.message : String(error)).slice(0, 300);
  }

  const todoOk =
    diagnostics.lectura === "OK" &&
    diagnostics.escritura === "OK" &&
    diagnostics.initializeDatabase === "OK" &&
    diagnostics.pruebaGuardarCliente === "OK";

  return NextResponse.json({
    estado: todoOk ? "OK" : "ERROR",
    mensaje: todoOk
      ? "Todo correcto: se puede leer, escribir, crear tablas y guardar clientes. La app funciona."
      : "Hay un problema. Revisa que campo pone ERROR y su mensaje.",
    ...diagnostics,
  });
}
