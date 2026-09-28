import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { v4 as uuidv4 } from "uuid";
import { GET } from "@/app/api/comercial/route";
import { getDbClient, initializeDatabase } from "@/lib/db";
import {
  normalizeCommercialMetrics,
  weightedPipelineValue,
  STAGE_PROBABILITIES,
  type CommercialMetrics,
} from "@/lib/crm";
import { useIsolatedTestDb } from "./test-db";

useIsolatedTestDb();

const CAMPOS_NUMERICOS: (keyof CommercialMetrics)[] = [
  "totalClients",
  "openOpportunities",
  "pipelineValue",
  "pendingTasks",
  "todayTasks",
  "overdueFollowUps",
  "hotOpportunities",
  "pendingDocs",
  "upcomingMeetings",
  "closedWonCount",
];

describe("Electricista360 — Contrato de métricas comerciales (P0 render)", () => {
  test("1. normalizeCommercialMetrics convierte la respuesta real de /api/comercial en números", async () => {
    await initializeDatabase();
    const res = await GET();
    assert.equal(res.status, 200);

    const json = await res.json();
    const metrics = normalizeCommercialMetrics(json);

    // Regresión: la home renderizaba `metrics.pendingDocs` directamente en JSX.
    // La API devuelve { clients: [...], opportunities: [...] } y React lanzaba
    // "Objects are not valid as a React child", tumbando la página entera.
    for (const campo of CAMPOS_NUMERICOS) {
      assert.equal(
        typeof metrics[campo],
        "number",
        `metrics.${campo} debe ser un número, no un objeto/array (recibido: ${typeof metrics[campo]})`
      );
      assert.ok(
        Number.isFinite(metrics[campo]),
        `metrics.${campo} debe ser finito (recibido: ${String(metrics[campo])})`
      );
    }
  });

  test("2. pendingDocs suma documentación pendiente de clientes y oportunidades", async () => {
    await initializeDatabase();
    const db = getDbClient();
    const today = new Date().toISOString().split("T")[0];

    const clientId = `client-doc-${uuidv4()}`;
    await db.execute({
      sql: "INSERT INTO clients (id, name, status, created_at) VALUES (?, 'Cliente Doc Pendiente Test', 'doc_pendiente', ?)",
      args: [clientId, today],
    });

    const res = await GET();
    const json = await res.json();
    const metrics = normalizeCommercialMetrics(json);

    const esperado = json.pendingDocs.clients.length + json.pendingDocs.opportunities.length;
    assert.equal(metrics.pendingDocs, esperado);
    assert.ok(metrics.pendingDocs >= 1, "El cliente con documentación pendiente cuenta");
  });

  test("3. Los KPIs del pipeline reflejan oportunidades reales de la base de datos", async () => {
    await initializeDatabase();
    const db = getDbClient();
    const today = new Date().toISOString().split("T")[0];

    const clientId = `client-opp-${uuidv4()}`;
    await db.execute({
      sql: "INSERT INTO clients (id, name, created_at) VALUES (?, 'Cliente Pipeline Test', ?)",
      args: [clientId, today],
    });

    const oppId = `opp-${uuidv4()}`;
    await db.execute({
      sql: `INSERT INTO opportunities (id, client_id, title, stage, estimated_value, probability, created_at, updated_at)
            VALUES (?, ?, 'Oportunidad QA Pipeline', 'propuesta', 2000, 80, ?, ?)`,
      args: [oppId, clientId, today, today],
    });

    const res = await GET();
    const json = await res.json();
    const metrics = normalizeCommercialMetrics(json);

    assert.ok(metrics.openOpportunities >= 1, "La oportunidad abierta se contabiliza");
    assert.ok(metrics.pipelineValue >= 2000, "El valor del pipeline incluye la oportunidad");
    assert.ok(metrics.hotOpportunities >= 1, "La oportunidad en propuesta es 'caliente'");
    assert.ok(metrics.totalClients >= 1, "El cliente se contabiliza en el total");
  });

  test("4. Payloads inesperados nunca producen objetos ni arrays (fail-safe de render)", () => {
    const casos: unknown[] = [
      undefined,
      null,
      {},
      { pendingDocs: { clients: {}, opportunities: null } },
      { todayTasks: { rows: [] }, upcomingMeetings: "muchas" },
      { kpis: null },
    ];

    for (const caso of casos) {
      const metrics = normalizeCommercialMetrics(caso);
      for (const campo of CAMPOS_NUMERICOS) {
        assert.equal(
          typeof metrics[campo],
          "number",
          `payload ${JSON.stringify(caso)} produjo metrics.${campo}=${typeof metrics[campo]}`
        );
        assert.ok(Number.isFinite(metrics[campo]), `metrics.${campo} debe ser finito`);
      }
    }
  });

  test("5. weightedPipelineValue usa la probabilidad real y cae a la de la etapa", () => {
    const conProbabilidad = weightedPipelineValue([
      { stage: "propuesta", estimated_value: 1000, probability: 50 },
    ]);
    assert.equal(conProbabilidad, 500, "Usa la probabilidad explícita de la oportunidad");

    const sinProbabilidad = weightedPipelineValue([
      { stage: "propuesta", estimated_value: 1000, probability: null },
    ]);
    assert.equal(
      sinProbabilidad,
      (1000 * STAGE_PROBABILITIES.propuesta) / 100,
      "Sin probabilidad explícita usa la probabilidad por defecto de la etapa"
    );

    const listaVacia = weightedPipelineValue([]);
    assert.equal(listaVacia, 0);

    const etapaDesconocida = weightedPipelineValue([
      { stage: "etapa-inexistente", estimated_value: 1000 },
    ]);
    assert.equal(etapaDesconocida, 0, "Una etapa desconocida no inventa probabilidad");
  });
});
