import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { getDbClient, resetDbClient, getTestDatabaseUrl } from "@/lib/db";

test("TEST env ignores remote URLs and never creates electricista.db", async () => {
  const prevTestDb = process.env.TEST_DATABASE_URL;
  const prevTurso = process.env.TURSO_DATABASE_URL;
  const prevToken = process.env.TURSO_AUTH_TOKEN;
  const filePath = path.resolve(process.cwd(), "electricista.db");
  const tempTestDb = path.join(tmpdir(), `autonomo360-test-${process.pid}-${Date.now()}.db`);

  try {
    rmSync(filePath, { force: true });
    delete process.env.TEST_DATABASE_URL;
    process.env.TURSO_DATABASE_URL = "libsql://remote-forbidden.turso.io";
    process.env.TURSO_AUTH_TOKEN = "token-forbidden";
    process.env.TEST_DATABASE_URL = `file:${tempTestDb}`;
    resetDbClient();

    const db = getDbClient();
    const result = await db.execute("SELECT 1 AS ok");

    assert.equal(Number(result.rows[0].ok), 1);
    assert.equal(existsSync(filePath), false, "No debe crearse electricista.db en tests");
    assert.ok(process.env.TEST_DATABASE_URL?.startsWith("file:"));
    assert.ok(process.env.TEST_DATABASE_URL.includes(tmpdir().replace(/\\/g, "/")) || process.env.TEST_DATABASE_URL.includes("autonomo360-test-"));
  } finally {
    if (prevTestDb === undefined) delete process.env.TEST_DATABASE_URL; else process.env.TEST_DATABASE_URL = prevTestDb;
    if (prevTurso === undefined) delete process.env.TURSO_DATABASE_URL; else process.env.TURSO_DATABASE_URL = prevTurso;
    if (prevToken === undefined) delete process.env.TURSO_AUTH_TOKEN; else process.env.TURSO_AUTH_TOKEN = prevToken;
    resetDbClient();
  }
});
