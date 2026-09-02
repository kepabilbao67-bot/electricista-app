import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { GET, PATCH } from "@/app/api/parte-trabajo/[id]/route";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { useIsolatedTestDb } from "./test-db";

useIsolatedTestDb();

describe("Autónomo 360 - Módulo de Parte de Trabajo Imprimible (v24)", () => {
  test("1. GET retorna 404 si el ID no existe", async () => {
    const nonExistentId = `parte-inexistente-${Date.now()}`;
    const req = new NextRequest(`http://localhost:3000/api/parte-trabajo/${nonExistentId}`);
    const res = await GET(req, { params: Promise.resolve({ id: nonExistentId }) });

    assert.equal(res.status, 404);
    const json = await res.json();
    assert.match(json.error, /no encontrado/i);
  });

  test("2. PATCH rechaza estados inválidos con 400", async () => {
    await initializeDatabase();
    const db = getDbClient();
    const testId = `pt-test-${Date.now()}-${uuidv4().slice(0, 5)}`;
    const testNum = `PT-${Date.now()}-1`;

    await db.execute({
      sql: `INSERT INTO partes_trabajo (id, numero, fecha, cliente, estado)
            VALUES (?, ?, '2026-09-01', 'Cliente Prueba', 'borrador')`,
      args: [testId, testNum],
    });

    const req = new NextRequest(`http://localhost:3000/api/parte-trabajo/${testId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "ESTADO_INEXISTENTE" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: testId }) });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.match(json.error, /Estado inválido/i);
  });

  test("3. PATCH actualiza el estado a TRABAJO_COMPLETADO correctamente", async () => {
    await initializeDatabase();
    const db = getDbClient();
    const testId = `pt-test-${Date.now()}-${uuidv4().slice(0, 5)}`;
    const testNum = `PT-${Date.now()}-2`;

    await db.execute({
      sql: `INSERT INTO partes_trabajo (id, numero, fecha, cliente, estado)
            VALUES (?, ?, '2026-09-01', 'Cliente Prueba 2', 'pendiente')`,
      args: [testId, testNum],
    });

    const req = new NextRequest(`http://localhost:3000/api/parte-trabajo/${testId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "TRABAJO_COMPLETADO" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: testId }) });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.parte.estado, "TRABAJO_COMPLETADO");
  });

  test("4. GET retorna cabecera, líneas de trabajo y materiales asociados", async () => {
    await initializeDatabase();
    const db = getDbClient();
    const testId = `pt-test-${Date.now()}-${uuidv4().slice(0, 5)}`;
    const testNum = `PT-${Date.now()}-3`;
    const trabajoId = uuidv4();
    const materialId = uuidv4();

    await db.execute({
      sql: `INSERT INTO partes_trabajo (id, numero, fecha, cliente, estado)
            VALUES (?, ?, '2026-09-01', 'Cliente Prueba 3', 'completado')`,
      args: [testId, testNum],
    });

    await db.execute({
      sql: `INSERT INTO parte_trabajo_lineas (id, parte_id, descripcion, cantidad, unidad, precio_unitario, sort_order)
            VALUES (?, ?, 'Instalación cuadro eléctrico', 1, 'servicio', 150, 0)`,
      args: [trabajoId, testId],
    });

    await db.execute({
      sql: `INSERT INTO parte_materiales (id, parte_id, descripcion, cantidad, unidad, precio_coste, precio_unitario, sort_order)
            VALUES (?, ?, 'Interruptor magnetotérmico 16A', 2, 'unidad', 10, 18, 0)`,
      args: [materialId, testId],
    });

    const req = new NextRequest(`http://localhost:3000/api/parte-trabajo/${testId}`);
    const res = await GET(req, { params: Promise.resolve({ id: testId }) });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.id, testId);
    assert.equal(json.cliente, "Cliente Prueba 3");
    assert.equal(json.trabajos.length, 1);
    assert.equal(json.trabajos[0].descripcion, "Instalación cuadro eléctrico");
    assert.equal(json.materiales.length, 1);
    assert.equal(json.materiales[0].descripcion, "Interruptor magnetotérmico 16A");
  });
});
