import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import { getTestDatabaseUrl, initializeDatabase } from "../db";

/**
 * REGRESIÓN — `initializeDatabase()` sobre una base de datos YA EXISTENTE.
 *
 * DEFECTO REAL QUE SE CORRIGE AQUÍ
 * Los índices nuevos de `purchase_orders(parte_id, …)` y
 * `purchase_order_items(status, …)` se creaban en el bloque de DDL, que corre
 * ANTES de `migrateSchema()`. En una base de datos creada por una versión
 * anterior esas columnas NO existen (las añade `migrateSchema`, precisamente
 * después), así que el `CREATE INDEX` fallaba con "no such column: parte_id" y
 * `initializeDatabase()` lanzaba.
 *
 * Consecuencia comprobada: TODAS las rutas que inicializan la base de datos
 * (presupuestos, partes de trabajo, faltantes de obra, dashboard…) devolvían 500
 * en cuanto se desplegara en un entorno con datos previos — como Preview.
 *
 * Esta prueba monta a mano el esquema ANTIGUO y exige que el arranque funcione y
 * que las columnas e índices acaben existiendo.
 */

describe("initializeDatabase sobre un esquema antiguo (migración segura)", () => {
  test("no falla aunque falten purchase_orders.parte_id y purchase_order_items.status", async () => {
    const db = createClient({ url: getTestDatabaseUrl() });

    // Esquema ANTIGUO, tal y como lo dejó la versión anterior de la app.
    await db.executeMultiple(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id TEXT PRIMARY KEY,
        source TEXT DEFAULT 'voice',
        original_text TEXT,
        needed_date TEXT,
        observations TEXT,
        status TEXT DEFAULT 'draft',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        product TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL,
        observations TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);

    // No debe lanzar: es exactamente el arranque de la app en Preview.
    await initializeDatabase(db);

    const columnasPedidos = await db.execute("PRAGMA table_info(purchase_orders)");
    assert.ok(
      columnasPedidos.rows.some((r) => String(r.name) === "parte_id"),
      "purchase_orders.parte_id debe existir tras migrar"
    );

    const columnasLineas = await db.execute("PRAGMA table_info(purchase_order_items)");
    assert.ok(
      columnasLineas.rows.some((r) => String(r.name) === "status"),
      "purchase_order_items.status debe existir tras migrar"
    );

    const indices = await db.execute(
      `SELECT name FROM sqlite_master WHERE type = 'index'
       AND name IN ('idx_purchase_orders_parte_id', 'idx_purchase_order_items_status')`
    );
    assert.equal(indices.rows.length, 2, "los dos índices nuevos deben existir");

    // Y las tablas de los P0 en curso también quedan creadas.
    const tablas = await db.execute(
      `SELECT name FROM sqlite_master WHERE type = 'table'
       AND name IN ('faltantes_obra', 'budget_drafts')`
    );
    assert.equal(tablas.rows.length, 2, "faltantes_obra y budget_drafts deben existir");

    db.close();
  });
});
