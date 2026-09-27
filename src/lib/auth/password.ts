/**
 * ELECTRICISTA360 — AUTH FASE 1 · Hash de contraseñas
 *
 * Usa `node:crypto` (scrypt) — SIN dependencias nuevas.
 * Deliberadamente NO se usa bcrypt/argon2: requieren compilación nativa y
 * añadirían binarios al proyecto sin necesidad.
 *
 * Este módulo solo puede ejecutarse en runtime Node. `src/proxy.ts` de Next 16
 * SÍ corre en Node (verificado: `isProxyFile()` fuerza runtime 'nodejs'), pero
 * las rutas de login declaran `runtime = "nodejs"` de forma explícita para no
 * depender de ese detalle interno.
 */

import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";

/**
 * `promisify(scrypt)` resuelve a la sobrecarga SIN opciones, de modo que
 * TypeScript rechaza el cuarto argumento. Se declara aquí el tipo real que
 * necesitamos para poder pasar N/r/p.
 */
const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions
) => Promise<Buffer>;

/** Parámetros de coste de scrypt. */
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
const SALT_BYTES = 16;

const ALGO = "scrypt";

/**
 * Formato almacenado: `scrypt$N$r$p$<saltBase64url>$<hashBase64url>`
 * Se guardan los parámetros para poder endurecerlos en el futuro sin invalidar
 * las contraseñas ya existentes.
 */
export async function hashPassword(password: string): Promise<string> {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("hashPassword: contraseña vacía");
  }
  const salt = randomBytes(SALT_BYTES);
  const derived = (await scryptAsync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  })) as Buffer;

  return [
    ALGO,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

/**
 * Verifica una contraseña contra el hash almacenado.
 * Devuelve `false` ante CUALQUIER anomalía (formato inválido, algoritmo
 * desconocido, parámetros corruptos). Nunca lanza hacia fuera: un error aquí
 * jamás debe convertirse en un acceso concedido.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    if (typeof password !== "string" || typeof stored !== "string") return false;

    const parts = stored.split("$");
    if (parts.length !== 6) return false;

    const [algo, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
    if (algo !== ALGO) return false;

    const N = Number(nRaw);
    const r = Number(rRaw);
    const p = Number(pRaw);
    if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
    if (N <= 1 || r <= 0 || p <= 0) return false;

    const salt = Buffer.from(saltRaw, "base64url");
    const expected = Buffer.from(hashRaw, "base64url");
    if (salt.length === 0 || expected.length === 0) return false;

    const derived = (await scryptAsync(password, salt, expected.length, { N, r, p })) as Buffer;

    // timingSafeEqual exige longitudes iguales; si no, no hay coincidencia posible.
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
