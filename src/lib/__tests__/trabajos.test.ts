import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { GET } from "@/app/api/trabajos/route";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { useIsolatedTestDb } from "./test-db";

useIsolatedTestDb();

describe("Autónomo 360 - Centro de Trabajos y Flujo Operativo (/trabajos)", () => {
  test("1. GET retorna estructura completa de KPIs y lista de trabajos", async () => {
    await initializeDatabase();
    const req = new NextRequest("http://localhost:3000/api/trabajos");
    const res = await GET(req);

    assert.equal(res.status, 200);
    const json = await res.json();

    assert.equal(json.success, true);
    assert.ok(json.kpis);
    assert.ok(typeof json.kpis.pendientes === "number");
    assert.ok(typeof json.kpis.en_progreso === "number");
    assert.ok(typeof json.kpis.finalizados_sin_facturar === "number");
    assert.ok(typeof json.kpis.facturados === "number");
    assert.ok(Array.isArray(json.statusDistribution));
    assert.ok(Array.isArray(json.trabajos));
  });

  test("2. Filtrado por estado retorna sólo trabajos coincidentes", async () => {
    await initializeDatabase();
    const db = getDbClient();
    const testId = `job-test-${Date.now()}-${uuidv4().slice(0, 4)}`;
    const testNum = `PT-JOB-${Date.now()}`;

    await db.execute({
      sql: `INSERT INTO partes_trabajo (id, numero, fecha, cliente, estado)
            VALUES (?, ?, '2026-09-02', 'Cliente Test En Progreso', 'en_progreso')`,
      args: [testId, testNum],
    });

    const req = new NextRequest("http://localhost:3000/api/trabajos?estado=en_progreso");
    const res = await GET(req);

    assert.equal(res.status, 200);
    const json = await res.json();
    const found = json.trabajos.find((t: any) => t.id === testId);
    assert.ok(found);
    assert.equal(found.estado, "en_progreso");
  });

  test("3. Búsqueda por texto filtra por cliente o número de parte", async () => {
    await initializeDatabase();
    const db = getDbClient();
    const uniqueClientName = `Empresa Específica ${Date.now()}`;
    const testId = `job-search-${Date.now()}`;
    const testNum = `PT-SRCH-${Date.now()}`;

    await db.execute({
      sql: `INSERT INTO partes_trabajo (id, numero, fecha, cliente, estado)
            VALUES (?, ?, '2026-09-02', ?, 'pendiente')`,
      args: [testId, testNum, uniqueClientName],
    });

    const req = new NextRequest(`http://localhost:3000/api/trabajos?search=${encodeURIComponent(uniqueClientName)}`);
    const res = await GET(req);

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(json.trabajos.length >= 1);
    assert.equal(json.trabajos[0].cliente, uniqueClientName);
  });

  test("4. Manejo robusto de fechas y parámetros sin errores de consulta", async () => {
    await initializeDatabase();
    const req = new NextRequest("http://localhost:3000/api/trabajos?desde=2026-01-01&hasta=2026-12-31&days=90");
    const res = await GET(req);

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.trabajos));
  });
});
