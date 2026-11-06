import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { resolveDatabaseUrl } from "../db";

const envKeys = [
  "APP_VERTICAL", "NODE_ENV", "TURSO_DATABASE_URL",
  "KEPA_TURSO_DATABASE_URL", "DEMO_MODE",
] as const;

function withEnv(vars: Partial<Record<(typeof envKeys)[number], string | undefined>>, run: () => void) {
  const previous = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  try {
    for (const key of envKeys) {
      const next = vars[key];
      if (next === undefined) delete process.env[key];
      else process.env[key] = next;
    }
    run();
  } finally {
    for (const key of envKeys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe("Kepa Tecnologia: database isolation", () => {
  test("uses its own remote database, not Electricista's", () => {
    withEnv({
      APP_VERTICAL: "tecnologia", NODE_ENV: "production",
      KEPA_TURSO_DATABASE_URL: "libsql://kepa-exclusive.example",
      TURSO_DATABASE_URL: "libsql://electricista.example",
    }, () => {
      assert.equal(resolveDatabaseUrl(), "libsql://kepa-exclusive.example");
    });
  });

  test("fails closed in production when Kepa database is missing", () => {
    withEnv({
      APP_VERTICAL: "tecnologia", NODE_ENV: "production",
      TURSO_DATABASE_URL: "libsql://electricista.example",
    }, () => {
      assert.throws(() => resolveDatabaseUrl(), /KEPA_TURSO_DATABASE_URL/);
    });
  });

  test("uses dedicated local storage in Kepa development", () => {
    withEnv({
      APP_VERTICAL: "tecnologia", NODE_ENV: "development",
      TURSO_DATABASE_URL: "libsql://electricista.example",
    }, () => {
      assert.equal(resolveDatabaseUrl(), "file:kepa-tecnologia.db");
    });
  });

  test("preserves Electricista's configured database", () => {
    withEnv({
      APP_VERTICAL: "electricista", NODE_ENV: "production",
      TURSO_DATABASE_URL: "libsql://electricista.example",
    }, () => {
      assert.equal(resolveDatabaseUrl(), "libsql://electricista.example");
    });
  });
});
