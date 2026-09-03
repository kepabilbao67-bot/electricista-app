import { describe, test } from "node:test";
import assert from "node:assert";
import { createClient } from "@libsql/client";
import { useIsolatedTestDb } from "./test-db";
import { initializeDatabase, getDbClient } from "../db";

// Register db isolation hooks at module level
useIsolatedTestDb();

describe("DIAGNOSTIC: Schema Creation & Legacy Migration", () => {
  test("1. Tabla clients existe después de initializeDatabase", async () => {
    await initializeDatabase();
    const db = getDbClient();

    const result = await db.execute("SELECT 1 FROM clients LIMIT 1");
    assert.ok(result, "Tabla clients existe");
  });

  test("2. Tabla company_settings incluye columna fiscal_territory con NOT NULL y DEFAULT 'common'", async () => {
    await initializeDatabase();
    const db = getDbClient();

    // Insertar un registro sin especificar fiscal_territory
    await db.execute({
      sql: "INSERT OR REPLACE INTO company_settings (id, trade_name, nif) VALUES ('test_default', 'Empresa Test', 'B00000000')",
      args: [],
    });

    const result = await db.execute({
      sql: "SELECT fiscal_territory FROM company_settings WHERE id = 'test_default'",
      args: [],
    });

    assert.strictEqual(result.rows.length, 1, "Fila recuperada");
    assert.strictEqual(
      result.rows[0].fiscal_territory,
      "common",
      "El valor predeterminado de fiscal_territory es 'common'"
    );
  });

  test("3. Migración real de base de datos legacy preexistente (sin columna fiscal_territory)", async () => {
    // 1. Crear una base aislada pura en memoria simulando un entorno legacy
    const legacyDb = createClient({ url: ":memory:" });

    // 2. Crear tabla company_settings antigua SIN la columna fiscal_territory
    await legacyDb.execute(`
      CREATE TABLE company_settings (
        id TEXT PRIMARY KEY,
        trade_name TEXT,
        legal_name TEXT,
        owner_name TEXT,
        nif TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);

    // 3. Inserción de datos en la tabla legacy
    await legacyDb.execute({
      sql: "INSERT INTO company_settings (id, trade_name, legal_name, owner_name, nif) VALUES ('default', 'Comercial Legacy S.L.', 'Razón Social Legacy S.L.', 'Juan Pérez', 'B99998888')",
      args: [],
    });

    // 4. Ejecutar el mecanismo de inicialización / migración aditiva real
    await initializeDatabase(legacyDb);

    // 5. Verificar que la columna fue agregada con valor 'common' y los datos antiguos se conservan intactos
    const checkLegacy = await legacyDb.execute({
      sql: "SELECT trade_name, legal_name, nif, fiscal_territory FROM company_settings WHERE id = 'default'",
      args: [],
    });

    assert.strictEqual(checkLegacy.rows.length, 1, "Conserva la fila existente");
    assert.strictEqual(checkLegacy.rows[0].trade_name, "Comercial Legacy S.L.", "Conserva trade_name anterior");
    assert.strictEqual(checkLegacy.rows[0].legal_name, "Razón Social Legacy S.L.", "Conserva legal_name anterior");
    assert.strictEqual(checkLegacy.rows[0].nif, "B99998888", "Conserva NIF anterior");
    assert.strictEqual(checkLegacy.rows[0].fiscal_territory, "common", "Asigna 'common' por defecto a la fila legacy");

    // 6. Verificar idempotencia: una segunda llamada a initializeDatabase no falla ni duplica columnas
    await initializeDatabase(legacyDb);

    const reCheckLegacy = await legacyDb.execute({
      sql: "SELECT fiscal_territory FROM company_settings WHERE id = 'default'",
      args: [],
    });
    assert.strictEqual(reCheckLegacy.rows[0].fiscal_territory, "common", "Mantiene 'common' tras segunda inicialización");
  });

  test("4. Tabla partes_trabajo existe", async () => {
    await initializeDatabase();
    const db = getDbClient();

    const result = await db.execute("SELECT 1 FROM partes_trabajo LIMIT 1");
    assert.ok(result, "Tabla partes_trabajo existe");
  });
});
