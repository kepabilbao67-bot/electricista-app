import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getDbClient } from "@/lib/db";

const scrypt = promisify(scryptCallback);

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function constantTimeEqual(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b));
}

export function tokenHash(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createRecoveryToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function getCredentialOverride(username: string): Promise<null | {
  password_hash: string; password_salt: string; revision: string;
}> {
  try {
    const rows = await getDbClient().execute({
      sql: "SELECT password_hash, password_salt, revision FROM electricista_auth_credentials WHERE username = ? LIMIT 1",
      args: [username],
    });
    if (!rows.rows.length) return null;
    const r = rows.rows[0];
    return {
      password_hash: String(r.password_hash),
      password_salt: String(r.password_salt),
      revision: String(r.revision),
    };
  } catch (error) {
    if (error instanceof Error && /no such table: electricista_auth_credentials/i.test(error.message)) return null;
    throw error;
  }
}

export async function getAuthRevision(username: string): Promise<string> {
  return (await getCredentialOverride(username))?.revision ?? "";
}

export async function verifyPassword(username: string, password: string): Promise<boolean> {
  const configuredUser = process.env.APP_BASIC_AUTH_USER;
  if (!configuredUser || !constantTimeEqual(username, configuredUser)) return false;
  const override = await getCredentialOverride(configuredUser);
  if (!override) return Boolean(process.env.APP_BASIC_AUTH_PASSWORD)
    && constantTimeEqual(password, process.env.APP_BASIC_AUTH_PASSWORD!);
  const calculated = (await scrypt(password, Buffer.from(override.password_salt, "hex"), 64)) as Buffer;
  return timingSafeEqual(calculated, Buffer.from(override.password_hash, "hex"));
}

export async function hashNewPassword(password: string) {
  const salt = randomBytes(32);
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return { password_salt: salt.toString("hex"), password_hash: hash.toString("hex") };
}
