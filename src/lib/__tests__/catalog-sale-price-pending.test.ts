/**
 * Catálogo — `sale_price_pending` (migración + persistencia)
 *
 * Regresión del defecto detectado: `POST/PUT /api/catalog` escribían la columna
 * `sale_price_pending`, pero esa columna no existía ni en `CREATE TABLE
 * catalog_items` ni en `ensureColumns("catalog_items")`, así que crear o editar
 * un material fallaba en runtime ("no such column").
 *
 * Verifica, SIN red, SIN API y SIN credenciales:
 *   1. BD nueva                     → la columna existe con default 0.
 *   2. BD existente (pre-migración) → se añade la columna y los datos se conservan.
 *   3. POST /api/catalog            → persiste sale_price_pending.
 *   4. PUT  /api/catalog            → transición precio pendiente ↔ precio decidido.
 *   5. Lectura posterior            → lo leído coincide con lo escrito.
 *   6. Presupuesto con material pendiente → el guard de la UI lo bloquea.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { createClient, type Client } from "@libsql/client";
import { NextRequest } from "next/server";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";

import {
  setDbClientForTesting,
  resetDbClient,
  initializeDatabase,
  getDbClient,
} from "../db";
import { canAddCatalogItem, findPendingCatalogLine } from "../catalog-pricing";
import {
  GET as catalogGet,
  POST as catalogPost,
  PUT as catalogPut,
} from "@/app/api/catalog/route";

function tempDbUrl(tag: string): { url: string; path: string } {
  const path = join(
    tmpdir(),
    `electricista360-catalog-${tag}-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}.db`
  );
  return { url: `file:${path}`, path };
}

async function columnNames(db: Client, table: string): Promise<Set<string>> {
  const info = await db.execute(`PRAGMA table_info(${table})`);
  return new Set(info.rows.map((r) => String(r.name)));
}

function jsonRequest(method: "POST" | "PUT", body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/catalog", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Catálogo — sale_price_pending", () => {
  let mainClient: Client;
  let mainPath: string;
  let legacyClient: Client;
  let legacyPath: string;
  let pendingId = "";
  let normalId = "";
  const previousTestDbUrl = process.env.TEST_DATABASE_URL;

  before(async () => {
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;

    // --- BD principal: se crea desde cero y se migra normalmente ---
    const main = tempDbUrl("main");
    mainPath = main.path;
    mainClient = createClient({ url: main.url });
    setDbClientForTesting(mainClient);
    process.env.TEST_DATABASE_URL = main.url;
    await initializeDatabase(mainClient);

    // --- BD heredada: simula una base anterior a la migración ---
    const legacy = tempDbUrl("legacy");
    legacyPath = legacy.path;
    legacyClient = createClient({ url: legacy.url });
    await legacyClient.execute(`
      CREATE TABLE catalog_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        unit_price REAL NOT NULL,
        category TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    await legacyClient.execute(
      "INSERT INTO catalog_items (id, name, description, unit_price, category) VALUES ('legacy-1', 'Material anterior', 'Fila previa a la migracion', 10, 'Cable')"
    );
  });

  after(() => {
    resetDbClient();
    for (const c of [mainClient, legacyClient]) {
      try {
        c?.close();
      } catch {
        /* ignore */
      }
    }
    if (previousTestDbUrl === undefined) delete process.env.TEST_DATABASE_URL;
    else process.env.TEST_DATABASE_URL = previousTestDbUrl;
    for (const p of [mainPath, legacyPath]) {
      try {
        if (p) rmSync(p, { force: true });
      } catch {
        /* ignore */
      }
    }
  });

  test("1. BD nueva: la columna existe tras migrar, con default 0", async () => {
    const cols = await columnNames(mainClient, "catalog_items");
    assert.ok(
      cols.has("sale_price_pending"),
      "sale_price_pending debe existir en una BD recién creada"
    );

    const info = await mainClient.execute("PRAGMA table_info(catalog_items)");
    const col = info.rows.find((r) => String(r.name) === "sale_price_pending");
    assert.ok(col, "la columna debe estar en PRAGMA table_info");
    assert.equal(String(col!.type).toUpperCase(), "INTEGER");
    assert.equal(String(col!.dflt_value), "0");
  });

  test("2. BD existente: se añade la columna sin perder datos", async () => {
    const before = await columnNames(legacyClient, "catalog_items");
    assert.equal(
      before.has("sale_price_pending"),
      false,
      "la BD heredada no debe tener la columna antes de migrar"
    );

    // Migración idempotente sobre la BD heredada
    await initializeDatabase(legacyClient);

    const after = await columnNames(legacyClient, "catalog_items");
    assert.ok(
      after.has("sale_price_pending"),
      "la migración debe añadir la columna a la BD existente"
    );

    const row = await legacyClient.execute(
      "SELECT id, name, unit_price, sale_price_pending FROM catalog_items WHERE id = 'legacy-1'"
    );
    assert.equal(row.rows.length, 1, "la fila previa debe conservarse");
    assert.equal(String(row.rows[0].name), "Material anterior");
    assert.equal(Number(row.rows[0].unit_price), 10);
    assert.equal(
      Number(row.rows[0].sale_price_pending),
      0,
      "un material existente debe quedar como precio normal (0), no pendiente"
    );
  });

  test("3. POST /api/catalog persiste sale_price_pending", async () => {
    const pendingRes = await catalogPost(
      jsonRequest("POST", {
        name: "Material sin precio de venta",
        description: "Alta con precio pendiente",
        unit_price: 0,
        cost_price: 4,
        category: "Cable",
        sale_price_pending: true,
      })
    );
    assert.equal(
      pendingRes.status,
      201,
      "el alta debe responder 201 (antes del fix fallaba en runtime)"
    );
    const pending = await pendingRes.json();
    assert.equal(Number(pending.sale_price_pending), 1);
    pendingId = String(pending.id);

    const normalRes = await catalogPost(
      jsonRequest("POST", {
        name: "Material con precio de venta",
        unit_price: 12,
        cost_price: 4,
        category: "Cable",
        sale_price_pending: false,
      })
    );
    assert.equal(normalRes.status, 201);
    const normal = await normalRes.json();
    assert.equal(Number(normal.sale_price_pending), 0);
    normalId = String(normal.id);
  });

  test("4. PUT /api/catalog respeta la transición de precio pendiente", async () => {
    // Precio decidido en un material que estaba pendiente → deja de estar pendiente
    const decided = await catalogPut(
      jsonRequest("PUT", {
        id: pendingId,
        name: "Material sin precio de venta",
        unit_price: 25,
        cost_price: 4,
        category: "Cable",
        sale_price_pending: true,
      })
    );
    assert.equal(decided.status, 200);
    assert.equal(
      Number((await decided.json()).sale_price_pending),
      0,
      "con precio de venta informado no puede quedar como pendiente"
    );

    // Vuelta a pendiente: sin precio de venta y marcado como pendiente
    const backToPending = await catalogPut(
      jsonRequest("PUT", {
        id: normalId,
        name: "Material con precio de venta",
        unit_price: 0,
        cost_price: 4,
        category: "Cable",
        sale_price_pending: true,
      })
    );
    assert.equal(backToPending.status, 200);
    assert.equal(Number((await backToPending.json()).sale_price_pending), 1);
  });

  test("5. Lectura posterior: GET /api/catalog devuelve el valor escrito", async () => {
    const listRes = await catalogGet();
    assert.equal(listRes.status, 200);

    const rows = (await listRes.json()) as Array<Record<string, unknown>>;
    const byId = new Map(rows.map((r) => [String(r.id), Number(r.sale_price_pending)]));

    assert.equal(byId.get(pendingId), 0, "tras fijar precio de venta debe leerse 0");
    assert.equal(byId.get(normalId), 1, "vuelto a pendiente debe leerse 1");

    // Contraste directo contra la base de datos
    const direct = await getDbClient().execute({
      sql: "SELECT id, sale_price_pending FROM catalog_items WHERE id IN (?, ?)",
      args: [pendingId, normalId],
    });
    const directById = new Map(
      direct.rows.map((r) => [String(r.id), Number(r.sale_price_pending)])
    );
    assert.equal(directById.get(pendingId), 0);
    assert.equal(directById.get(normalId), 1);
  });

  test("6. Presupuesto con material pendiente: el guard bloquea la línea", async () => {
    const row = await getDbClient().execute({
      sql: "SELECT id, unit_price, sale_price_pending FROM catalog_items WHERE id = ?",
      args: [normalId],
    });
    assert.equal(row.rows.length, 1, "el material pendiente debe existir");

    const item = {
      id: String(row.rows[0].id),
      unit_price: Number(row.rows[0].unit_price),
      sale_price_pending: Number(row.rows[0].sale_price_pending),
    };

    assert.equal(
      canAddCatalogItem(item),
      false,
      "un material con precio pendiente no debe poder añadirse a un presupuesto"
    );

    const found = await findPendingCatalogLine(getDbClient(), [
      { catalog_item_id: normalId, unit_price: 0 },
    ]);
    assert.equal(found, normalId, "debe detectarse la línea de presupuesto afectada");

    const clean = await findPendingCatalogLine(getDbClient(), [
      { catalog_item_id: "no-existe", unit_price: 5 },
    ]);
    assert.equal(clean, null, "sin material pendiente no debe marcar nada");
  });
});
