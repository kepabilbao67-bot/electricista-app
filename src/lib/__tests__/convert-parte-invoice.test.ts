import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { POST } from "@/app/api/partes-trabajo/[id]/convert/route";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { useIsolatedTestDb } from "./test-db";

useIsolatedTestDb();

describe("Autónomo 360 - Conversión Transaccional e Idempotente Parte -> Factura (/api/partes-trabajo/[id]/convert)", () => {
  test("1. Esquema: invoices contiene exactamente una sola columna source_part_id e índice UNIQUE parcial activo", async () => {
    await initializeDatabase();
    const db = getDbClient();

    // Reejecutar inicialización repetida para comprobar idempotencia
    await initializeDatabase();

    const tableInfo = await db.execute({ sql: "PRAGMA table_info(invoices)", args: [] });
    const sourceCols = tableInfo.rows.filter((r) => r.name === "source_part_id");
    assert.equal(sourceCols.length, 1, "Debe existir exactamente una columna source_part_id en invoices");

    const indexList = await db.execute({ sql: "PRAGMA index_list(invoices)", args: [] });
    const uniqueIndexes = indexList.rows.filter(
      (r) => r.name === "idx_invoices_source_part_id_unique" && Number(r.unique) === 1
    );
    assert.equal(uniqueIndexes.length, 1, "Debe existir exactamente un índice único idx_invoices_source_part_id_unique");

    const indexInfo = await db.execute({ sql: "PRAGMA index_info(idx_invoices_source_part_id_unique)", args: [] });
    const indexedCol = indexInfo.rows.some((r) => r.name === "source_part_id");
    assert.equal(indexedCol, true, "El índice único debe indexar la columna source_part_id");
  });

  test("2. Facturas históricas con source_part_id = NULL permanecen intactas tras reinicializaciones", async () => {
    await initializeDatabase();
    const db = getDbClient();
    const testHistoricalId = `test-hist-${Date.now()}-${uuidv4().slice(0, 4)}`;
    const testNum = `HIST-${Date.now()}-${uuidv4().slice(0, 4)}`;
    const clientId = `test-client-hist-${Date.now()}-${uuidv4().slice(0, 4)}`;

    await db.execute({
      sql: "INSERT INTO clients (id, name) VALUES (?, 'Cliente Histórico')",
      args: [clientId],
    });

    await db.execute({
      sql: `INSERT INTO invoices (id, number, client_id, date, status, total, source_part_id)
            VALUES (?, ?, ?, '2026-01-15', 'draft', 100, NULL)`,
      args: [testHistoricalId, testNum, clientId],
    });

    // Ejecutar inicialización de nuevo
    await initializeDatabase();

    const checkHist = await db.execute({
      sql: "SELECT * FROM invoices WHERE id = ?",
      args: [testHistoricalId],
    });

    assert.equal(checkHist.rows.length, 1);
    assert.equal(checkHist.rows[0].id, testHistoricalId);
    assert.equal(checkHist.rows[0].number, testNum);
    assert.equal(checkHist.rows[0].source_part_id, null);
    assert.equal(Number(checkHist.rows[0].total), 100);

    // Limpieza
    await db.execute({ sql: "DELETE FROM invoices WHERE id = ?", args: [testHistoricalId] });
    await db.execute({ sql: "DELETE FROM clients WHERE id = ?", args: [clientId] });
  });

  test("3. POST retorna 404 si el parte no existe", async () => {
    await initializeDatabase();
    const fakeId = `non-existent-parte-${Date.now()}-${uuidv4().slice(0, 4)}`;
    const req = new NextRequest(`http://localhost:3000/api/partes-trabajo/${fakeId}/convert`, {
      method: "POST",
    });

    const res = await POST(req, { params: Promise.resolve({ id: fakeId }) });
    assert.equal(res.status, 404);
    const json = (await res.json()) as { error?: string };
    assert.ok(json.error);
  });

  test("4. Conversión exitosa de parte terminado: cálculos exactos, persistencia de source_part_id y líneas", async () => {
    await initializeDatabase();
    const db = getDbClient();
    const clientId = `test-client-${Date.now()}-${uuidv4().slice(0, 4)}`;
    const parteId = `conv-parte-${Date.now()}-${uuidv4().slice(0, 4)}`;
    const parteNum = `PT-CONV-${Date.now()}-${uuidv4().slice(0, 4)}`;
    const clientName = `Comunidad Gran Vía ${Date.now()}`;

    await db.execute({
      sql: `INSERT INTO clients (id, name, phone, address) VALUES (?, ?, '600112233', 'Calle Gran Vía 12')`,
      args: [clientId, clientName],
    });

    await db.execute({
      sql: `INSERT INTO partes_trabajo (id, numero, fecha, cliente, client_id, direccion, telefono, estado, iva_rate, descuento, observaciones)
            VALUES (?, ?, '2026-09-02', ?, ?, 'Calle Gran Vía 12', '600112233', 'completado', 21, 10, 'Revisión cuadro principal')`,
      args: [parteId, parteNum, clientName, clientId],
    });

    // 2.5 horas a 45.50€ = 113.75€
    await db.execute({
      sql: `INSERT INTO parte_trabajo_lineas (id, parte_id, nombre_trabajo, descripcion, cantidad, unidad, precio_unitario, sort_order)
            VALUES (?, ?, 'Mano de obra especializada', 'Avería eléctrica', 2.5, 'hora', 45.50, 0)`,
      args: [uuidv4(), parteId],
    });

    // 1 diferencial a 59.95€ = 59.95€
    await db.execute({
      sql: `INSERT INTO parte_materiales (id, parte_id, nombre_material, descripcion, cantidad, unidad, precio_unitario, sort_order)
            VALUES (?, ?, 'Diferencial superinmunizado', 'Schneider 40A', 1, 'unidad', 59.95, 0)`,
      args: [uuidv4(), parteId],
    });

    // Total Bruto: 113.75 + 59.95 = 173.70€
    // Descuento 10%: (173.70 * 10) / 100 = 17.37€
    // Base Imponible: 173.70 - 17.37 = 156.33€
    // IVA 21%: (156.33 * 21) / 100 = 32.83€
    // Total Final: 156.33 + 32.83 = 189.16€

    const req = new NextRequest(`http://localhost:3000/api/partes-trabajo/${parteId}/convert`, {
      method: "POST",
    });

    const res = await POST(req, { params: Promise.resolve({ id: parteId }) });
    assert.equal(res.status, 201);
    const invoice = (await res.json()) as {
      id: string;
      number: string;
      client_id: string;
      source_part_id: string;
      status: string;
      tax_rate: number;
      subtotal: number;
      tax_amount: number;
      total: number;
    };

    assert.ok(invoice.id);
    assert.ok(invoice.number);
    assert.equal(invoice.client_id, clientId);
    assert.equal(invoice.source_part_id, parteId);
    assert.equal(invoice.status, "draft");
    assert.equal(invoice.tax_rate, 21);
    assert.equal(Number(invoice.subtotal).toFixed(2), "156.33");
    assert.equal(Number(invoice.tax_amount).toFixed(2), "32.83");
    assert.equal(Number(invoice.total).toFixed(2), "189.16");

    // Verificar estado del parte en BD
    const checkParte = await db.execute({
      sql: "SELECT estado FROM partes_trabajo WHERE id = ?",
      args: [parteId],
    });
    assert.equal(checkParte.rows[0].estado, "facturado");

    // Verificar líneas creadas
    const checkItems = await db.execute({
      sql: "SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order",
      args: [invoice.id],
    });
    assert.equal(checkItems.rows.length, 2);
  });

  test("5. Rechazo de parte sin líneas facturables con 422", async () => {
    await initializeDatabase();
    const db = getDbClient();
    const clientId = `test-client-empty-${Date.now()}-${uuidv4().slice(0, 4)}`;
    await db.execute({
      sql: `INSERT INTO clients (id, name) VALUES (?, 'Cliente Sin Líneas')`,
      args: [clientId],
    });

    const parteId = `parte-empty-${Date.now()}-${uuidv4().slice(0, 4)}`;
    const parteNum = `PT-EMPTY-${Date.now()}-${uuidv4().slice(0, 4)}`;
    await db.execute({
      sql: `INSERT INTO partes_trabajo (id, numero, fecha, cliente, client_id, estado)
            VALUES (?, ?, '2026-09-02', 'Cliente Sin Líneas', ?, 'completado')`,
      args: [parteId, parteNum, clientId],
    });

    const req = new NextRequest(`http://localhost:3000/api/partes-trabajo/${parteId}/convert`, {
      method: "POST",
    });

    const res = await POST(req, { params: Promise.resolve({ id: parteId }) });
    assert.equal(res.status, 422);
    const json = (await res.json()) as { error: string };
    assert.match(json.error, /no tiene líneas de trabajo o materiales facturables/);
  });

  test("6. Rechazo de parte con cantidades o precios negativos con 422", async () => {
    await initializeDatabase();
    const db = getDbClient();
    const clientId = `test-client-neg-${Date.now()}-${uuidv4().slice(0, 4)}`;
    await db.execute({
      sql: `INSERT INTO clients (id, name) VALUES (?, 'Cliente Neg')`,
      args: [clientId],
    });

    const parteId = `parte-neg-${Date.now()}-${uuidv4().slice(0, 4)}`;
    const parteNum = `PT-NEG-${Date.now()}-${uuidv4().slice(0, 4)}`;
    await db.execute({
      sql: `INSERT INTO partes_trabajo (id, numero, fecha, cliente, client_id, estado)
            VALUES (?, ?, '2026-09-02', 'Cliente Neg', ?, 'completado')`,
      args: [parteId, parteNum, clientId],
    });

    await db.execute({
      sql: `INSERT INTO parte_trabajo_lineas (id, parte_id, descripcion, cantidad, precio_unitario)
            VALUES (?, ?, 'Línea Negativa', -2, 50)`,
      args: [uuidv4(), parteId],
    });

    const req = new NextRequest(`http://localhost:3000/api/partes-trabajo/${parteId}/convert`, {
      method: "POST",
    });

    const res = await POST(req, { params: Promise.resolve({ id: parteId }) });
    assert.equal(res.status, 422);
    const json = (await res.json()) as { error: string };
    assert.match(json.error, /inválidos o negativos/);
  });

  test("7. Rechazo de parte no terminado con 422", async () => {
    await initializeDatabase();
    const db = getDbClient();
    const clientId = `test-client-notdone-${Date.now()}-${uuidv4().slice(0, 4)}`;
    await db.execute({
      sql: `INSERT INTO clients (id, name) VALUES (?, 'Cliente No Done')`,
      args: [clientId],
    });

    for (const estado of ["borrador", "pendiente", "en_progreso", "cancelado"]) {
      const parteId = `parte-st-${estado}-${Date.now()}-${uuidv4().slice(0, 4)}`;
      const parteNum = `PT-${estado.toUpperCase()}-${Date.now()}-${uuidv4().slice(0, 4)}`;
      await db.execute({
        sql: `INSERT INTO partes_trabajo (id, numero, fecha, cliente, client_id, estado)
              VALUES (?, ?, '2026-09-02', 'Cliente No Done', ?, ?)`,
        args: [parteId, parteNum, clientId, estado],
      });

      const req = new NextRequest(`http://localhost:3000/api/partes-trabajo/${parteId}/convert`, {
        method: "POST",
      });

      const res = await POST(req, { params: Promise.resolve({ id: parteId }) });
      assert.equal(res.status, 422);
      const json = (await res.json()) as { error: string };
      assert.match(json.error, /Solo se pueden facturar partes terminados/);
    }
  });

  test("8. Rechazo cuando client_id es nulo o no existe con 422", async () => {
    await initializeDatabase();
    const db = getDbClient();
    const parteId = `parte-noclient-${Date.now()}-${uuidv4().slice(0, 4)}`;
    const parteNum = `PT-NOCLIENT-${Date.now()}-${uuidv4().slice(0, 4)}`;
    await db.execute({
      sql: `INSERT INTO partes_trabajo (id, numero, fecha, cliente, client_id, estado)
            VALUES (?, ?, '2026-09-02', 'Cliente Sin ID', NULL, 'completado')`,
      args: [parteId, parteNum],
    });

    const req = new NextRequest(`http://localhost:3000/api/partes-trabajo/${parteId}/convert`, {
      method: "POST",
    });

    const res = await POST(req, { params: Promise.resolve({ id: parteId }) });
    assert.equal(res.status, 422);
    const json = (await res.json()) as { error: string };
    assert.match(json.error, /El parte no tiene un cliente asignado/);
  });

  test("9. Segunda llamada secuencial: 409 con invoiceId y exactamente una factura en BD", async () => {
    await initializeDatabase();
    const db = getDbClient();
    const clientId = `test-client-seq-${Date.now()}-${uuidv4().slice(0, 4)}`;
    const parteId = `parte-seq-${Date.now()}-${uuidv4().slice(0, 4)}`;
    const parteNum = `PT-SEQ-${Date.now()}-${uuidv4().slice(0, 4)}`;

    await db.execute({
      sql: `INSERT INTO clients (id, name) VALUES (?, 'Cliente Secuencial')`,
      args: [clientId],
    });

    await db.execute({
      sql: `INSERT INTO partes_trabajo (id, numero, fecha, cliente, client_id, estado)
            VALUES (?, ?, '2026-09-02', 'Cliente Secuencial', ?, 'completado')`,
      args: [parteId, parteNum, clientId],
    });

    await db.execute({
      sql: `INSERT INTO parte_trabajo_lineas (id, parte_id, descripcion, cantidad, precio_unitario)
            VALUES (?, ?, 'Reparación enchufe', 1, 40)`,
      args: [uuidv4(), parteId],
    });

    const req1 = new NextRequest(`http://localhost:3000/api/partes-trabajo/${parteId}/convert`, { method: "POST" });
    const res1 = await POST(req1, { params: Promise.resolve({ id: parteId }) });
    assert.equal(res1.status, 201);
    const inv1 = (await res1.json()) as { id: string };

    const req2 = new NextRequest(`http://localhost:3000/api/partes-trabajo/${parteId}/convert`, { method: "POST" });
    const res2 = await POST(req2, { params: Promise.resolve({ id: parteId }) });
    assert.equal(res2.status, 409);
    const json2 = (await res2.json()) as { error: string; invoiceId: string };
    assert.equal(json2.invoiceId, inv1.id);
    assert.equal(json2.error, "Este parte de trabajo ya ha sido facturado");

    const countInvoices = await db.execute({
      sql: "SELECT COUNT(*) as count FROM invoices WHERE source_part_id = ?",
      args: [parteId],
    });
    assert.equal(Number(countInvoices.rows[0].count), 1);
  });

  test("10. Concurrencia real del mismo parte: exactamente 1 factura persistida y 409 en la concurrente", async () => {
    await initializeDatabase();
    const db = getDbClient();
    const clientId = `test-client-conc-${Date.now()}-${uuidv4().slice(0, 4)}`;
    const parteId = `parte-conc-${Date.now()}-${uuidv4().slice(0, 4)}`;
    const parteNum = `PT-CONC-${Date.now()}-${uuidv4().slice(0, 4)}`;

    await db.execute({
      sql: `INSERT INTO clients (id, name) VALUES (?, 'Cliente Concurrente')`,
      args: [clientId],
    });

    await db.execute({
      sql: `INSERT INTO partes_trabajo (id, numero, fecha, cliente, client_id, estado)
            VALUES (?, ?, '2026-09-02', 'Cliente Concurrente', ?, 'completado')`,
      args: [parteId, parteNum, clientId],
    });

    await db.execute({
      sql: `INSERT INTO parte_trabajo_lineas (id, parte_id, descripcion, cantidad, precio_unitario)
            VALUES (?, ?, 'Servicio Concurrente', 1, 100)`,
      args: [uuidv4(), parteId],
    });

    const [resA, resB] = await Promise.all([
      POST(new NextRequest(`http://localhost:3000/api/partes-trabajo/${parteId}/convert`, { method: "POST" }), {
        params: Promise.resolve({ id: parteId }),
      }),
      POST(new NextRequest(`http://localhost:3000/api/partes-trabajo/${parteId}/convert`, { method: "POST" }), {
        params: Promise.resolve({ id: parteId }),
      }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    assert.deepEqual(statuses, [201, 409], "Una petición debe responder 201 y la otra 409");

    const countInvoices = await db.execute({
      sql: "SELECT COUNT(*) as count FROM invoices WHERE source_part_id = ?",
      args: [parteId],
    });
    assert.equal(Number(countInvoices.rows[0].count), 1, "Solo debe existir 1 factura en la base de datos");

    const conflictRes = resA.status === 409 ? resA : resB;
    const successRes = resA.status === 201 ? resA : resB;
    const conflictJson = (await conflictRes.json()) as { invoiceId: string };
    const successJson = (await successRes.json()) as { id: string };

    assert.equal(conflictJson.invoiceId, successJson.id);
  });

  test("11. Concurrencia de partes distintos: ambos convierten con éxito y obtienen números correlativos distintos", async () => {
    await initializeDatabase();
    const db = getDbClient();
    const clientId = `test-client-diff-${Date.now()}-${uuidv4().slice(0, 4)}`;

    await db.execute({
      sql: `INSERT INTO clients (id, name) VALUES (?, 'Cliente Dos Partes')`,
      args: [clientId],
    });

    const parteId1 = `parte-diff1-${Date.now()}-${uuidv4().slice(0, 4)}`;
    const parteId2 = `parte-diff2-${Date.now()}-${uuidv4().slice(0, 4)}`;

    await db.execute({
      sql: `INSERT INTO partes_trabajo (id, numero, fecha, cliente, client_id, estado)
            VALUES (?, ?, '2026-09-02', 'Cliente Dos Partes', ?, 'completado')`,
      args: [parteId1, `PT-D1-${Date.now()}-${uuidv4().slice(0, 4)}`, clientId],
    });
    await db.execute({
      sql: `INSERT INTO parte_trabajo_lineas (id, parte_id, descripcion, cantidad, precio_unitario)
            VALUES (?, ?, 'Trabajo 1', 1, 50)`,
      args: [uuidv4(), parteId1],
    });

    await db.execute({
      sql: `INSERT INTO partes_trabajo (id, numero, fecha, cliente, client_id, estado)
            VALUES (?, ?, '2026-09-02', 'Cliente Dos Partes', ?, 'completado')`,
      args: [parteId2, `PT-D2-${Date.now()}-${uuidv4().slice(0, 4)}`, clientId],
    });
    await db.execute({
      sql: `INSERT INTO parte_trabajo_lineas (id, parte_id, descripcion, cantidad, precio_unitario)
            VALUES (?, ?, 'Trabajo 2', 1, 75)`,
      args: [uuidv4(), parteId2],
    });

    const [res1, res2] = await Promise.all([
      POST(new NextRequest(`http://localhost:3000/api/partes-trabajo/${parteId1}/convert`, { method: "POST" }), {
        params: Promise.resolve({ id: parteId1 }),
      }),
      POST(new NextRequest(`http://localhost:3000/api/partes-trabajo/${parteId2}/convert`, { method: "POST" }), {
        params: Promise.resolve({ id: parteId2 }),
      }),
    ]);

    assert.equal(res1.status, 201);
    assert.equal(res2.status, 201);

    const json1 = (await res1.json()) as { number: string };
    const json2 = (await res2.json()) as { number: string };

    assert.notEqual(json1.number, json2.number, "Ambas facturas deben tener números correlativos distintos");
  });

  test("12. Rollback real del endpoint ante fallo al insertar líneas: cero facturas huérfanas y estado preservado", async () => {
    await initializeDatabase();
    const db = getDbClient();
    const clientId = `test-client-rbfail-${Date.now()}-${uuidv4().slice(0, 4)}`;
    const parteId = `parte-rbfail-${Date.now()}-${uuidv4().slice(0, 4)}`;
    const parteNum = `PT-RBFAIL-${Date.now()}-${uuidv4().slice(0, 4)}`;

    await db.execute({
      sql: `INSERT INTO clients (id, name) VALUES (?, 'Cliente Fallo Trigger')`,
      args: [clientId],
    });

    await db.execute({
      sql: `INSERT INTO partes_trabajo (id, numero, fecha, cliente, client_id, estado)
            VALUES (?, ?, '2026-09-02', 'Cliente Fallo Trigger', ?, 'completado')`,
      args: [parteId, parteNum, clientId],
    });

    await db.execute({
      sql: `INSERT INTO parte_trabajo_lineas (id, parte_id, descripcion, cantidad, precio_unitario)
            VALUES (?, ?, 'Trabajo TriggerFailLine', 1, 50)`,
      args: [uuidv4(), parteId],
    });

    // Instalar trigger temporal de prueba que aborta la inserción de invoice_items
    await db.execute({
      sql: `CREATE TRIGGER IF NOT EXISTS test_trg_fail_item
            BEFORE INSERT ON invoice_items
            FOR EACH ROW
            WHEN NEW.description LIKE '%TriggerFailLine%'
            BEGIN
              SELECT RAISE(ABORT, 'Simulated Item Insert Failure');
            END;`,
      args: [],
    });

    try {
      const req = new NextRequest(`http://localhost:3000/api/partes-trabajo/${parteId}/convert`, { method: "POST" });
      const res = await POST(req, { params: Promise.resolve({ id: parteId }) });

      // Debe responder con error de servidor controlado
      assert.equal(res.status, 500);

      // Verificar que NO existe ninguna factura para este parte (rollback)
      const checkInv = await db.execute({
        sql: "SELECT * FROM invoices WHERE source_part_id = ?",
        args: [parteId],
      });
      assert.equal(checkInv.rows.length, 0, "No debe existir ninguna factura persistida");

      // Verificar que NO existen líneas de factura
      const checkItems = await db.execute({
        sql: "SELECT * FROM invoice_items WHERE description LIKE '%TriggerFailLine%'",
        args: [],
      });
      assert.equal(checkItems.rows.length, 0, "No debe existir ninguna línea persistida");

      // Verificar que el estado del parte sigue en completado
      const checkParte = await db.execute({
        sql: "SELECT estado FROM partes_trabajo WHERE id = ?",
        args: [parteId],
      });
      assert.equal(checkParte.rows[0].estado, "completado", "El estado del parte no debe haber cambiado");
    } finally {
      await db.execute({ sql: "DROP TRIGGER IF EXISTS test_trg_fail_item;", args: [] });
      await db.execute({ sql: "DELETE FROM parte_trabajo_lineas WHERE parte_id = ?", args: [parteId] });
      await db.execute({ sql: "DELETE FROM partes_trabajo WHERE id = ?", args: [parteId] });
      await db.execute({ sql: "DELETE FROM clients WHERE id = ?", args: [clientId] });
    }
  });

  test("13. Rollback real del endpoint ante UPDATE con rowsAffected === 0 (conflicto de estado inducido): cero facturas persistidas", async () => {
    await initializeDatabase();
    const db = getDbClient();
    const clientId = `test-client-rbrow-${Date.now()}-${uuidv4().slice(0, 4)}`;
    const parteId = `parte-rbrow-${Date.now()}-${uuidv4().slice(0, 4)}`;
    const parteNum = `PT-RBROW-${Date.now()}-${uuidv4().slice(0, 4)}`;

    await db.execute({
      sql: `INSERT INTO clients (id, name) VALUES (?, 'Cliente Race Row')`,
      args: [clientId],
    });

    await db.execute({
      sql: `INSERT INTO partes_trabajo (id, numero, fecha, cliente, client_id, estado)
            VALUES (?, ?, '2026-09-02', 'Cliente Race Row', ?, 'completado')`,
      args: [parteId, parteNum, clientId],
    });

    await db.execute({
      sql: `INSERT INTO parte_trabajo_lineas (id, parte_id, descripcion, cantidad, precio_unitario)
            VALUES (?, ?, 'Trabajo Race State', 1, 60)`,
      args: [uuidv4(), parteId],
    });

    // Instalar trigger temporal que cambia el estado a 'cancelado' durante la transacción
    // provocando que el UPDATE partes_trabajo WHERE estado IN ('completado', ...) afecte 0 filas
    await db.execute({
      sql: `CREATE TRIGGER IF NOT EXISTS test_trg_race_state
            AFTER INSERT ON invoices
            FOR EACH ROW
            WHEN NEW.source_part_id = '${parteId}'
            BEGIN
              UPDATE partes_trabajo SET estado = 'cancelado' WHERE id = '${parteId}';
            END;`,
      args: [],
    });

    try {
      const req = new NextRequest(`http://localhost:3000/api/partes-trabajo/${parteId}/convert`, { method: "POST" });
      const res = await POST(req, { params: Promise.resolve({ id: parteId }) });

      // Debe responder 409 conflicto por rowsAffected === 0
      assert.equal(res.status, 409);

      // Verificar que NO existe ninguna factura persistida
      const checkInv = await db.execute({
        sql: "SELECT * FROM invoices WHERE source_part_id = ?",
        args: [parteId],
      });
      assert.equal(checkInv.rows.length, 0, "La factura debe haberse revertido por rowsAffected === 0");
    } finally {
      await db.execute({ sql: "DROP TRIGGER IF EXISTS test_trg_race_state;", args: [] });
      await db.execute({ sql: "DELETE FROM parte_trabajo_lineas WHERE parte_id = ?", args: [parteId] });
      await db.execute({ sql: "DELETE FROM partes_trabajo WHERE id = ?", args: [parteId] });
      await db.execute({ sql: "DELETE FROM clients WHERE id = ?", args: [clientId] });
    }
  });
});
