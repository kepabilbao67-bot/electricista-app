import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { GET } from "@/app/api/dashboard/route";
import { getDbClient, initializeDatabase } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { useIsolatedTestDb } from "./test-db";

useIsolatedTestDb();

describe("Autónomo 360 — Dashboard Metrics Suite (P0)", () => {
  test("1. GET retorna estructura de métricas de dashboard completa", async () => {
    await initializeDatabase();
    const res = await GET();

    assert.equal(res.status, 200);
    const json = await res.json();

    assert.equal(json.demoMode, false);
    assert.ok(typeof json.totalFacturacion === "number");
    assert.ok(typeof json.thisMonthTotal === "number");
    assert.ok(typeof json.thisYearTotal === "number");
    assert.ok(typeof json.thisMonthExpenses === "number");
    assert.ok(typeof json.thisYearExpenses === "number");
    assert.ok(typeof json.thisMonthProfit === "number");
    assert.ok(typeof json.thisYearProfit === "number");
    assert.ok(typeof json.pendienteCobro === "number");
    assert.ok(typeof json.facturasPendientes === "number");
    assert.ok(typeof json.facturasVencidasCount === "number");
    assert.ok(typeof json.facturasVencidasTotal === "number");
    assert.ok(Array.isArray(json.monthlyBilling));
    assert.ok(Array.isArray(json.monthlyEvolution));
    assert.ok(Array.isArray(json.topClients));
    assert.ok(Array.isArray(json.recentClients));
    assert.ok(json.fiscal);
    assert.ok(typeof json.fiscal.mes.ivaRepercutido === "number");
    assert.ok(typeof json.fiscal.mes.ivaSoportado === "number");
    assert.ok(typeof json.fiscal.mes.ivaLiquidacion === "number");
    assert.equal(json.fiscal.irpfDisponible, false);
    assert.ok(json.alerts);
    assert.ok(Array.isArray(json.alerts.overdueInvoices));
    assert.ok(Array.isArray(json.alerts.expiringBudgets));
    assert.ok(Array.isArray(json.alerts.todayVisits));
  });

  test("2. Cálculos financieros y fiscales con facturas y gastos reales", async () => {
    await initializeDatabase();
    const db = getDbClient();

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const clientId = `client-${uuidv4()}`;

    // Insertar cliente de prueba
    await db.execute({
      sql: "INSERT INTO clients (id, name, created_at) VALUES (?, 'Cliente Test Dashboard', ?)",
      args: [clientId, today],
    });

    // Insertar factura emitida este mes
    const invoiceId = `inv-${uuidv4()}`;
    await db.execute({
      sql: `INSERT INTO invoices (id, number, client_id, date, due_date, status, subtotal, tax_rate, tax_amount, total, created_at)
            VALUES (?, ?, ?, ?, ?, 'sent', 1000, 21, 210, 1210, ?)`,
      args: [invoiceId, `FAC-TEST-${Date.now()}`, clientId, today, today, today],
    });

    // Insertar gasto registrado este mes
    const expenseId = `exp-${uuidv4()}`;
    await db.execute({
      sql: `INSERT INTO expenses (id, supplier_name, date, status, subtotal, tax_rate, tax_amount, total, created_at)
            VALUES (?, 'Proveedor Test', ?, 'paid', 300, 21, 63, 363, ?)`,
      args: [expenseId, today, today],
    });

    const res = await GET();
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.ok(json.thisMonthTotal >= 1210, "Facturación del mes incluye la factura emitida");
    assert.ok(json.thisMonthExpenses >= 363, "Gastos del mes incluyen el gasto registrado");
    assert.ok(json.thisMonthProfit >= (1210 - 363), "Beneficio del mes calcula ingresos - gastos");
    assert.ok(json.fiscal.mes.ivaRepercutido >= 210, "IVA repercutido suma los impuestos de facturas");
    assert.ok(json.fiscal.mes.ivaSoportado >= 63, "IVA soportado suma los impuestos de gastos");
    assert.ok(json.pendienteCobro >= 1210, "Pendiente de cobro incluye la factura 'sent'");
  });

  test("3. Detección precisa de facturas vencidas", async () => {
    await initializeDatabase();
    const db = getDbClient();

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 40);
    const pastDateStr = pastDate.toISOString().split("T")[0];

    const clientId = `client-${uuidv4()}`;
    await db.execute({
      sql: "INSERT INTO clients (id, name, created_at) VALUES (?, 'Cliente Vencido Test', ?)",
      args: [clientId, pastDateStr],
    });

    const overdueInvoiceId = `inv-overdue-${uuidv4()}`;
    await db.execute({
      sql: `INSERT INTO invoices (id, number, client_id, date, due_date, status, subtotal, tax_rate, tax_amount, total, created_at)
            VALUES (?, ?, ?, ?, ?, 'sent', 500, 21, 105, 605, ?)`,
      args: [overdueInvoiceId, `FAC-VENC-${Date.now()}`, clientId, pastDateStr, pastDateStr, pastDateStr],
    });

    const res = await GET();
    const json = await res.json();

    assert.ok(json.facturasVencidasCount >= 1, "Detecta al menos 1 factura vencida");
    assert.ok(json.facturasVencidasTotal >= 605, "Total de facturas vencidas acumula el importe");
    const foundAlert = json.alerts.overdueInvoices.some((inv: { id: string }) => inv.id === overdueInvoiceId);
    assert.ok(foundAlert, "La factura vencida aparece en alerts.overdueInvoices");
  });
});
