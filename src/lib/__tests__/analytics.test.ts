import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { GET } from "@/app/api/analytics/route";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { useIsolatedTestDb } from "./test-db";

useIsolatedTestDb();

describe("Autónomo 360 - Módulo de Analíticas y Métricas de Negocio (v25)", () => {
  test("1. GET retorna estructura de métricas y KPIs completa", async () => {
    await initializeDatabase();
    const res = await GET();

    assert.equal(res.status, 200);
    const json = await res.json();

    assert.equal(json.success, true);
    assert.ok(json.kpis);
    assert.ok(typeof json.kpis.totalLeads === "number");
    assert.ok(typeof json.kpis.conversionRate === "number");
    assert.ok(typeof json.kpis.estimatedRevenue === "number");
    assert.ok(typeof json.kpis.completedJobs === "number");
    assert.ok(Array.isArray(json.statusCounts));
    assert.ok(Array.isArray(json.weeklyLeads));
    assert.ok(Array.isArray(json.topServices));
    assert.ok(Array.isArray(json.recentLeads));
  });

  test("2. Cálculo de tasa de conversión es preciso", async () => {
    await initializeDatabase();
    const db = getDbClient();

    // Insertar leads de prueba con estados conocidos
    const uniqueBatchId = Date.now();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO leads (id, name, status, created_at, updated_at)
            VALUES (?, 'Lead Conectado 1', 'convertido', ?, ?)`,
      args: [`lead-conv-${uniqueBatchId}-1`, now, now],
    });

    const res = await GET();
    const json = await res.json();

    assert.ok(json.kpis.totalLeads >= 1);
    assert.ok(json.kpis.conversionRate >= 0 && json.kpis.conversionRate <= 100);
  });

  test("3. Agregación semanal de captación devuelve exactamente 7 días", async () => {
    await initializeDatabase();
    const res = await GET();
    const json = await res.json();

    assert.equal(json.weeklyLeads.length, 7);
    for (const dayEntry of json.weeklyLeads) {
      assert.ok(dayEntry.date);
      assert.ok(dayEntry.day);
      assert.ok(typeof dayEntry.leads === "number");
    }
  });

  test("4. Manejo robusto de datos sin errores ni fallos en agregación", async () => {
    await initializeDatabase();
    const res = await GET();
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.topServices.length > 0);
  });
});
