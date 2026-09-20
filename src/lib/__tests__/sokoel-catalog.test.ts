import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@libsql/client";
import { initializeDatabase } from "../db";
import { SOKOEL_CATALOG_ITEMS } from "../sokoel-catalog";

test("catalogo SOKOEL contiene 32 referencias unicas y costes validos", () => {
  const importesOrigen = [
    1.49, 22.37, 33.84, 33.41, 18.05, 4.88, 4.4, 4.01,
    19.35, 27.26, 17.45, 5.86, 7.32, 8.75, 1.04, 6.45,
    4.99, 9.12, 10.92, 3.24, 12.43, 3.22, 3.22, 3.22,
    3.22, 5.47, 12.51, 127.09, 124.47, 79.8, 28.82, 47.03,
  ];

  assert.equal(SOKOEL_CATALOG_ITEMS.length, 32);
  assert.equal(importesOrigen.length, 32);
  assert.equal(importesOrigen.reduce((sum, value) => sum + value, 0).toFixed(2), "694.70");
  assert.equal(new Set(SOKOEL_CATALOG_ITEMS.map((item) => item.reference)).size, 32);
  assert.ok(SOKOEL_CATALOG_ITEMS.every((item) => item.costPrice > 0));
  assert.ok(SOKOEL_CATALOG_ITEMS.every((item) => item.supplier === "SOKOEL"));
});

test("importacion SOKOEL es idempotente y no modifica precio de venta", async () => {
  const db = createClient({ url: "file::memory:" });
  await initializeDatabase(db);
  await initializeDatabase(db);

  const imported = await db.execute(
    "SELECT COUNT(*) AS count FROM catalog_items WHERE supplier = 'SOKOEL'"
  );
  const duplicates = await db.execute(
    `SELECT supplier_reference FROM catalog_items WHERE supplier = 'SOKOEL'
     GROUP BY supplier, supplier_reference HAVING COUNT(*) > 1`
  );
  const salePrices = await db.execute(
    "SELECT COUNT(*) AS count FROM catalog_items WHERE supplier = 'SOKOEL' AND unit_price <> 0"
  );

  assert.equal(Number(imported.rows[0].count), 32);
  assert.equal(duplicates.rows.length, 0);
  assert.equal(Number(salePrices.rows[0].count), 0);
  db.close();
});
