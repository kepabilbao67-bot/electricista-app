/**
 * ELECTRICISTA360 — AUTH FASE 1 · Arranque del esquema en RUNTIME SERVIDOR
 *
 * POR QUÉ EXISTE
 * `src/lib/auth/schema.ts` declara el DDL y sabe aplicarlo (`applyAuthSchema`),
 * pero NADIE lo llamaba desde la aplicación: su único consumidor era el script
 * explícito `scripts/migrate-auth-phase1.ts`. En un despliegue donde ese script
 * no se ha ejecutado (tablas `app_users` / `app_sessions` ausentes) el resultado
 * medido es: el proxy cierra toda ruta privada con 503 («esquema de auth sin
 * aplicar → se cierra, no se abre», ver `handleSessionPath`) y el login responde
 * 503. Es decir, la aplicación queda inaccesible aunque la base de datos esté
 * perfectamente viva.
 *
 * QUÉ HACE Y QUÉ NO HACE
 *   · ejecuta EXCLUSIVAMENTE `AUTH_SCHEMA_UP` (2 tablas + 4 índices, todos con
 *     IF NOT EXISTS): solo `app_users` y `app_sessions`;
 *   · NO toca ninguna tabla de negocio (clientes, presupuestos, partes, facturas…);
 *   · NO crea usuarios, ni sesiones, ni siembra nada: crear el primer usuario es
 *     un acto explícito y separado;
 *   · reutiliza la conexión ya existente (`getDbClient()`), que en producción
 *     apunta a Turso con `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`. No abre
 *     conexiones propias ni lee/escribe ningún secreto;
 *   · es IDEMPOTENTE: repetirlo no cambia nada.
 *
 * UNA SOLA VEZ POR PROCESO (no una vez por petición)
 * La promesa se guarda a nivel de módulo, así que todas las peticiones del mismo
 * proceso comparten el mismo arranque: el DDL se ejecuta como mucho una vez por
 * proceso, no en cada request. Si el esquema YA existe, ni siquiera se ejecuta
 * DDL (comprobación previa con el `authSchemaExists` que ya existía).
 *
 * Un FALLO NO SE CACHEA a propósito: si la base de datos estaba caída, el
 * siguiente intento debe poder volver a probar en lugar de quedar envenenado
 * para siempre.
 *
 * SERVIDOR SOLO
 * Este módulo importa `getDbClient()` (driver de base de datos y `process.env`),
 * así que es de servidor por construcción. NO se re-exporta desde el barril
 * `src/lib/auth/index.ts` para que ningún componente de cliente pueda arrastrarlo
 * al bundle del navegador: solo lo importan `src/proxy.ts` y la ruta de login.
 */

import { getDbClient } from "../db";
import { applyAuthSchema, authSchemaExists } from "./schema";

/** Arranque compartido por TODO el proceso (peticiones, lambdas cálidas, etc.). */
let arranqueEnCurso: Promise<void> | null = null;

/**
 * Asegura que el esquema de autenticación existe. Idempotente y cacheado.
 *
 * Devuelve la MISMA promesa a todos los llamantes del proceso. Si falla, propaga
 * el error (los llamantes son fail-closed: 503, nunca acceso concedido).
 */
export function ensureAuthSchema(): Promise<void> {
  if (arranqueEnCurso) return arranqueEnCurso;

  arranqueEnCurso = aplicarSiHaceFalta().catch((causa) => {
    // El fallo NO se memoriza: se libera el cerrojo para permitir un reintento.
    arranqueEnCurso = null;
    throw causa;
  });

  return arranqueEnCurso;
}

async function aplicarSiHaceFalta(): Promise<void> {
  const db = getDbClient();

  // Camino rápido: si las dos tablas ya están, no se ejecuta NINGÚN DDL.
  // `authSchemaExists` devuelve `false` ante cualquier error, así que un fallo de
  // conexión NO se interpreta como "ya está": se intenta aplicar y, si la base de
  // datos no responde, el error sube y el llamante cierra el acceso.
  if (await authSchemaExists(db)) return;

  await applyAuthSchema(db);
}

/**
 * Olvida el arranque memorizado. Para pruebas y diagnóstico (permite volver a
 * comprobar el camino de creación dentro del mismo proceso).
 */
export function resetAuthSchemaBootstrapCache(): void {
  arranqueEnCurso = null;
}
