/**
 * AUTÓNOMO360 — Test Database Isolation Helper
 *
 * Provides before/after hooks that inject a fresh in-memory SQLite database
 * into the getDbClient() singleton BEFORE each test file runs, and tear it
 * down cleanly afterwards.
 *
 * This guarantees that tests NEVER read from or write to:
 *   - electricista.db (local business database)
 *   - Any TURSO_DATABASE_URL remote database
 *   - Any temporary file left over from previous runs
 *
 * Usage:
 *   import { useIsolatedTestDb } from ".//test-db";
 *   useIsolatedTestDb();   // registers before/after hooks automatically
 *
 * The helper also sets TEST_DATABASE_URL so that any code path that creates
 * a fresh client (e.g. API routes that call getDbClient() internally) will
 * also resolve to the same in-memory instance.
 *
 * NOTE: Node.js test runner shares module-level state within a single test
 * file. Across files, tsx --test forks isolated workers, so each file gets its
 * own in-memory database automatically.
 */

import { before, after } from "node:test";
import { createClient, Client } from "@libsql/client";
import { setDbClientForTesting, resetDbClient, initializeDatabase, getTestDatabaseUrl } from "../db";

/**
 * Registers before/after hooks that replace the db singleton with an isolated
 * in-memory SQLite database for the duration of the test file.
 *
 * @param migrate - If true (default), also calls initializeDatabase() to
 *                  create all tables before the first test runs.
 */
export function useIsolatedTestDb(migrate = true): { getDb: () => Client } {
  let db: Client;
  const previousTestDbUrl = process.env.TEST_DATABASE_URL;
  const previousTursoUrl = process.env.TURSO_DATABASE_URL;
  const previousTursoToken = process.env.TURSO_AUTH_TOKEN;

  before(async () => {
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;
    // Use a shared in-memory database so all connections in the same test file
    // see the same schema/data instead of isolated per-connection memory DBs.
    const testUrl = getTestDatabaseUrl();
    db = createClient({ url: testUrl });
    setDbClientForTesting(db);
    // Also set env var so API routes that call getDbClient() indirectly
    // resolve to the memory instance rather than the real file.
    process.env.TEST_DATABASE_URL = testUrl;
    if (migrate) {
      await initializeDatabase(db);
    }
  });

  after(() => {
    delete process.env.TEST_DATABASE_URL;
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;
    if (previousTestDbUrl === undefined) delete process.env.TEST_DATABASE_URL; else process.env.TEST_DATABASE_URL = previousTestDbUrl;
    if (previousTursoUrl === undefined) delete process.env.TURSO_DATABASE_URL; else process.env.TURSO_DATABASE_URL = previousTursoUrl;
    if (previousTursoToken === undefined) delete process.env.TURSO_AUTH_TOKEN; else process.env.TURSO_AUTH_TOKEN = previousTursoToken;
    resetDbClient();
    try {
      db?.close();
    } catch {
      // ignore close errors during teardown
    }
  });

  return { getDb: () => db };
}
