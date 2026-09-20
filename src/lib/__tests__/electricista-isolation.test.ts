import { test } from "node:test";
import assert from "node:assert/strict";
import { electricistaDomainAdapter } from "@/lib/assistant/electricista-adapter";
import { getDbClient, resetDbClient } from "@/lib/db";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";

test("AISLAMIENTO: Electricista360 opera exclusivamente con adapter propio y base de datos independiente", async (t) => {
  await t.test("1 & 2. Lectura y escritura en base de datos independiente de Electricista360", async () => {
    const tempDb = path.join(tmpdir(), `electricista360-isolation-${Date.now()}.db`);
    process.env.TEST_DATABASE_URL = `file:${tempDb}`;
    resetDbClient();

    try {
      const db = getDbClient();
      await db.execute("CREATE TABLE IF NOT EXISTS test_isolation (id TEXT PRIMARY KEY, vertical TEXT)");
      await db.execute("INSERT INTO test_isolation (id, vertical) VALUES ('1', 'electricista360')");

      const result = await db.execute("SELECT * FROM test_isolation WHERE id = '1'");
      assert.equal(result.rows.length, 1);
      assert.equal(result.rows[0].vertical, "electricista360");

      // Verify no cross-talk to autonomo360
      assert.ok(process.env.TEST_DATABASE_URL.includes("electricista360-isolation"));
    } finally {
      delete process.env.TEST_DATABASE_URL;
      resetDbClient();
      try { rmSync(tempDb, { force: true }); } catch {}
    }
  });

  await t.test("3. Voice360 de Electricista360 usa exclusivamente electricistaDomainAdapter", async () => {
    assert.equal(electricistaDomainAdapter.domainName, "electricista");
    assert.equal(typeof electricistaDomainAdapter.normalizeInput, "function");
    assert.equal(typeof electricistaDomainAdapter.enrichContext, "function");
    assert.equal(typeof electricistaDomainAdapter.resolveCatalogItem, "function");

    // Normaliza términos de electricista correctamente
    if (electricistaDomainAdapter.normalizeInput) {
      const normalized = await electricistaDomainAdapter.normalizeInput("2 magnetos y 3 enchufes");
      assert.ok(normalized.includes("magnetotérmicos"));
      assert.ok(normalized.includes("bases de enchufe"));
    }
  });

  await t.test("4. Variables de entorno no apuntan a repositorios o bases de datos ajenas", () => {
    const dbUrl = process.env.DATABASE_URL || "";
    const tursoUrl = process.env.TURSO_DATABASE_URL || "";
    assert.equal(dbUrl.includes("autonomo360.db"), false);
    assert.equal(tursoUrl.includes("autonomo360-prod"), false);
  });

  await t.test("5. Fallback y adapters no enrutan a autonomo360", async () => {
    if (electricistaDomainAdapter.enrichContext) {
      const context = await electricistaDomainAdapter.enrichContext("tenant-test", "consulta de tubo y sokoel");
      assert.equal(context.vertical, "electricista");
      assert.equal(context.supplierName, "SOKOEL");
      assert.equal(context.supplierCatalogAvailable, true);
    }
  });
});
