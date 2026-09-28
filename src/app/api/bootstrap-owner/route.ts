/**
 * ELECTRICISTA360 — SIEMBRA ONE-SHOT DEL PRIMER OWNER (TEMPORAL)
 *
 * ⚠️  FICHERO TEMPORAL. Se despliega SOLO en Preview, se usa UNA vez y se
 * elimina inmediatamente después (junto con su variable de entorno).
 *
 * POR QUÉ EXISTE
 * `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` son Secret de Vercel y NO se pueden
 * extraer de la plataforma: `env pull` los enmascara y `env run` avisa de que no
 * se pueden bajar ("Secret values cannot be pulled"). Los secretos solo existen
 * DENTRO del runtime desplegado, así que la única forma de sembrar el primer
 * usuario sin sacarlos de Vercel es ejecutar el código aquí dentro.
 *
 * LA CONTRASEÑA SE GENERA AQUÍ DENTRO
 * No viene de ninguna variable de entorno ni de la petición: se genera con
 * `randomBytes` DENTRO del runtime, se hashea con scrypt y el texto plano solo
 * viaja en la respuesta HTTPS de esta única llamada. Así no hay que transportar
 * la contraseña por ningún otro canal, ni queda en ningún log del servidor.
 *
 * GARANTÍAS
 *   · Solo funciona en Preview: si `VERCEL_ENV` no es "preview", responde 404.
 *   · Exige el token en la cabecera `x-bootstrap-token` (nunca en la URL, para
 *     que no acabe en logs de acceso).
 *   · Sin token configurado responde 404: el endpoint no existe.
 *   · Aborta si `app_users` ya tiene CUALQUIER fila: es de un solo uso real.
 *   · Escribe EXCLUSIVAMENTE en `app_users`. No toca ninguna tabla de negocio.
 *   · Devuelve la contraseña (una vez) y el email; NUNCA el hash, ni el token de
 *     Turso, ni la URL de la base de datos.
 *   · Se autodesactiva borrando su propia variable de entorno en Vercel.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

import { getDbClient } from "@/lib/db";
import { applyAuthSchema, authSchemaExists } from "@/lib/auth/schema";
import { createUser, normalizeEmail } from "@/lib/auth/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OWNER_EMAIL = "owner@electricista360.invalid";
const OWNER_TENANT = "electricista360-main";
const OWNER_ROLE = "owner";

const MAY = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const MIN = "abcdefghijkmnopqrstuvwxyz";
const NUM = "23456789";
const ESP = "!@#$%^&*-_=+?";

function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
}

/** Contraseña aleatoria fuerte: >=20 caracteres, 4 clases, rechazo por módulo. */
function generarPassword(largo = 20): string {
  const grupos = [MAY, MIN, NUM, ESP];
  const partes: string[] = [];
  const tomar = (n: number, pool: string) => {
    const limite = Math.floor(256 / pool.length) * pool.length;
    let out = "";
    while (out.length < n) {
      for (const b of randomBytes(n * 4)) {
        if (b >= limite) continue;
        out += pool[b % pool.length];
        if (out.length === n) break;
      }
    }
    return out;
  };
  partes.push(tomar(5, MAY), tomar(6, MIN), tomar(5, NUM), tomar(4, ESP));
  const chars = partes.join("").split("");
  // Mezcla de Fisher-Yates con CSPRNG: sin esto los bloques por clase son fijos.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }
  const pwd = chars.join("");
  if (pwd.length < 20) throw new Error("password corta");
  if (!grupos.every((g) => [...pwd].some((c) => g.includes(c)))) throw new Error("password sin clases");
  return pwd;
}

/** Borra una variable de entorno del proyecto para Preview. Best-effort. */
async function borrarVariableDePreview(key: string): Promise<boolean> {
  const projectId = process.env.VERCEL_PROJECT_ID;
  const orgId = process.env.VERCEL_ORG_ID ?? "";
  const token = process.env.VERCEL_OIDC_TOKEN;
  if (!projectId || !token) return false;
  try {
    const listRes = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env?teamId=${orgId}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!listRes.ok) return false;
    const data = (await listRes.json()) as { envs?: Array<{ id: string; key: string; target?: string[] }> };
    const objetivo = (data.envs ?? []).find(
      (e) => e.key === key && (e.target ?? []).includes("preview")
    );
    if (!objetivo) return false;
    const delRes = await fetch(
      `https://api.vercel.com/v9/projects/${projectId}/env/${objetivo.id}?teamId=${orgId}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    return delRes.ok;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (process.env.VERCEL_ENV !== "preview") return notFound();

  const esperado = process.env.E360_BOOTSTRAP_TOKEN?.trim();
  if (!esperado) return notFound();
  if (request.headers.get("x-bootstrap-token") !== esperado) return notFound();

  const db = getDbClient();

  // 1. Esquema: medido en la base de datos real.
  let schemaExistiaAntes = false;
  try {
    schemaExistiaAntes = await authSchemaExists(db);
    if (!schemaExistiaAntes) await applyAuthSchema(db);
  } catch {
    return NextResponse.json(
      { error: "No se pudo asegurar el esquema de auth." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const tablas = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('app_users','app_sessions') ORDER BY name"
  );
  const indices = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name IN ('app_users','app_sessions') AND name LIKE 'idx_%' ORDER BY name"
  );

  // 2. Solo si está vacía.
  const conteo = await db.execute("SELECT COUNT(*) AS n FROM app_users");
  const usuarios = Number((conteo.rows[0] as unknown as Record<string, unknown>).n ?? 0);
  if (usuarios > 0) {
    return NextResponse.json(
      { error: "Ya existe al menos un usuario. Siembra abortada sin escribir nada.", appUsers: usuarios },
      { status: 409, headers: { "Cache-Control": "no-store" } }
    );
  }

  // 3. Contraseña generada AQUÍ, hasheada con el módulo real del producto.
  const password = generarPassword();
  const user = await createUser(
    { tenantId: OWNER_TENANT, email: normalizeEmail(OWNER_EMAIL), password, role: OWNER_ROLE },
    db
  );

  const comprobacion = await db.execute({
    sql: "SELECT role, tenant_id, password_algo, is_active, email FROM app_users WHERE id = ? LIMIT 1",
    args: [user.id],
  });
  const fila = comprobacion.rows[0] as unknown as Record<string, unknown> | undefined;
  const tras = await db.execute("SELECT COUNT(*) AS n FROM app_users");

  const tokenBorrado = await borrarVariableDePreview("E360_BOOTSTRAP_TOKEN");

  return NextResponse.json(
    {
      ok: true,
      esquema: {
        appUsers: tablas.rows.some((r) => r.name === "app_users"),
        appSessions: tablas.rows.some((r) => r.name === "app_sessions"),
        indicesAuth: indices.rows.map((r) => String(r.name)),
        nIndices: indices.rows.length,
        schemaExistiaAntes,
      },
      owner: {
        id: user.id,
        email: fila ? String(fila.email) : null,
        role: fila ? String(fila.role) : null,
        tenantId: fila ? String(fila.tenant_id) : null,
        passwordAlgo: fila ? String(fila.password_algo) : null,
        isActive: fila ? Number(fila.is_active) === 1 : null,
      },
      appUsers: Number((tras.rows[0] as unknown as Record<string, unknown>).n ?? 0),
      passwordTemporal: password,
      tokenBorrado,
    },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}
