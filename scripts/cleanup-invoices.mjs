/**
 * BRAND-CLEANUP-001 — Backup y borrado completo de facturas demo.
 *
 * Uso:
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/cleanup-invoices.mjs
 *
 * O localmente sin Turso:
 *   node scripts/cleanup-invoices.mjs --local
 *
 * Pasos:
 * 1. Exporta todas las facturas y líneas a backups/invoices-before-cleanup-FECHA.json
 * 2. Borra invoice_items y invoices en transacción.
 * 3. Verifica que ambas tablas quedan vacías.
 */
import { createClient } from "@libsql/client";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const isLocal = process.argv.includes("--local");
const url = isLocal ? "file:electricista.db" : process.env.TURSO_DATABASE_URL;
const authToken = isLocal ? undefined : process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error("ERROR: TURSO_DATABASE_URL no configurado. Usa --local para DB local.");
  process.exit(1);
}

const db = createClient({ url, authToken });

async function run() {
  // 1. Contar antes
  const invCount = await db.execute("SELECT COUNT(*) as c FROM invoices");
  const itemsCount = await db.execute("SELECT COUNT(*) as c FROM invoice_items");
  const totalInvoices = Number(invCount.rows[0].c);
  const totalItems = Number(itemsCount.rows[0].c);

  console.log(`Facturas antes: ${totalInvoices}`);
  console.log(`Líneas antes: ${totalItems}`);

  if (totalInvoices === 0 && totalItems === 0) {
    console.log("Ya está vacío. No hay nada que limpiar.");
    return;
  }

  // 2. Backup
  const invoices = await db.execute("SELECT * FROM invoices");
  const items = await db.execute("SELECT * FROM invoice_items");

  const backup = {
    exportDate: new Date().toISOString(),
    totalInvoices,
    totalItems,
    invoices: invoices.rows,
    invoice_items: items.rows,
  };

  mkdirSync(join(process.cwd(), "backups"), { recursive: true });
  const filename = `invoices-before-cleanup-${new Date().toISOString().split("T")[0]}.json`;
  const filepath = join(process.cwd(), "backups", filename);
  writeFileSync(filepath, JSON.stringify(backup, null, 2), "utf-8");
  console.log(`Backup guardado: ${filepath}`);

  // 3. Borrado transaccional
  console.log("Borrando invoice_items y invoices...");
  await db.executeMultiple(`
    DELETE FROM invoice_items;
    DELETE FROM invoices;
  `);

  // 4. Verificar
  const afterInv = await db.execute("SELECT COUNT(*) as c FROM invoices");
  const afterItems = await db.execute("SELECT COUNT(*) as c FROM invoice_items");
  console.log(`Facturas después: ${afterInv.rows[0].c}`);
  console.log(`Líneas después: ${afterItems.rows[0].c}`);

  if (Number(afterInv.rows[0].c) === 0 && Number(afterItems.rows[0].c) === 0) {
    console.log("Limpieza completada correctamente.");
  } else {
    console.error("ERROR: Las tablas no quedaron vacías.");
    process.exit(1);
  }
}

run().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
