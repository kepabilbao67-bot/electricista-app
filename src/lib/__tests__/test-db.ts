/** Base de pruebas aislada de Turso y de los datos del cliente. */
import { before, after } from "node:test";
import { createClient } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";
import { initializeDatabase } from "../db";

export function useIsolatedTestDb() {
  const previous = {
    url: process.env.TURSO_DATABASE_URL,
    token: process.env.TURSO_AUTH_TOKEN,
  };
  const path = join(tmpdir(), "electricista-faltantes-test-" + randomUUID() + ".db");
  before(async () => {
    process.env.TURSO_DATABASE_URL = "file:" + path.replace(/\\/g, "/");
    delete process.env.TURSO_AUTH_TOKEN;
    const db = createClient({ url: process.env.TURSO_DATABASE_URL });
    try { await initializeDatabase(db); } finally { db.close(); }
  });
  after(() => {
    if (previous.url === undefined) delete process.env.TURSO_DATABASE_URL;
    else process.env.TURSO_DATABASE_URL = previous.url;
    if (previous.token === undefined) delete process.env.TURSO_AUTH_TOKEN;
    else process.env.TURSO_AUTH_TOKEN = previous.token;
    try { rmSync(path, { force: true }); } catch { /* test cleanup */ }
  });
}
