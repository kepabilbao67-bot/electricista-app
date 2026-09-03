import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { NextRequest } from "next/server";
import { useIsolatedTestDb } from "./test-db";
import { initializeDatabase, getDbClient } from "../db";
import { getStrictBizkaiaFiscalProfile } from "@/lib/core/company";
import { POST } from "@/app/api/ticketbai/route";
import { POST as createInvoiceRoute } from "@/app/api/invoices/route";
import { TICKETBAI_CONFIG } from "../ticketbai/config";
import { v4 as uuidv4 } from "uuid";

// Registra hooks de base de datos aislada en memoria para esta suite
useIsolatedTestDb();

describe("TicketBAI Bizkaia / Batuz — Control Territorial y Validación Estricta", () => {
  let originalFetch: typeof globalThis.fetch;
  let fetchCallsCount = 0;

  beforeEach(() => {
    fetchCallsCount = 0;
    originalFetch = globalThis.fetch;
    // Spy / Mock explícito sobre el transporte HTTP nativo para garantizar cero peticiones externas
    globalThis.fetch = (async (..._args: any[]) => {
      fetchCallsCount++;
      throw new Error("PROHIBIDO: Intento de conexión externa durante pruebas de TicketBAI");
    }) as any;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // --- B. GENERACIÓN TICKETBAI Y TERRITORIOS ---

  test("1. Empresa con fiscal_territory = 'common' recibe HTTP 403 y se bloquea TicketBAI", async () => {
    await initializeDatabase();
    const db = getDbClient();

    const companyId = "default";
    await db.execute({
      sql: `INSERT OR REPLACE INTO company_settings (id, trade_name, legal_name, nif, fiscal_territory)
            VALUES (?, 'Empresa Madrid S.L.', 'Empresa Madrid S.L.', 'B88888888', 'common')`,
      args: [companyId],
    });

    const clientId = uuidv4();
    await db.execute({
      sql: `INSERT INTO clients (id, name, nif) VALUES (?, 'Cliente Madrid', 'A11111111')`,
      args: [clientId],
    });

    const invoiceId = uuidv4();
    await db.execute({
      sql: `INSERT INTO invoices (id, number, client_id, date, status, subtotal, tax_rate, tax_amount, total)
            VALUES (?, 'FAC-2026-0001', ?, '2026-03-01', 'draft', 100.0, 21, 21.0, 121.0)`,
      args: [invoiceId, clientId],
    });

    const req = new NextRequest("http://localhost/api/ticketbai", {
      method: "POST",
      body: JSON.stringify({ invoice_id: invoiceId, action: "generate" }),
    });

    const response = await POST(req);
    assert.strictEqual(response.status, 403, "Devuelve HTTP 403 para territorio común");

    const data = await response.json();
    assert.strictEqual(data.xml, undefined, "No se genera XML");
    assert.ok(data.error.includes("Bizkaia"), "El error indica que TicketBAI es exclusivo de Bizkaia");
    assert.strictEqual(fetchCallsCount, 0, "Cero llamadas de red externa");
  });

  test("2. Empresa con fiscal_territory = 'araba' recibe HTTP 403", async () => {
    await initializeDatabase();
    const db = getDbClient();

    await db.execute({
      sql: `INSERT OR REPLACE INTO company_settings (id, trade_name, legal_name, nif, fiscal_territory)
            VALUES ('default', 'Empresa Vitoria S.L.', 'Empresa Vitoria S.L.', 'B77777777', 'araba')`,
      args: [],
    });

    const clientId = uuidv4();
    await db.execute({
      sql: `INSERT INTO clients (id, name, nif) VALUES (?, 'Cliente Vitoria', 'A22222222')`,
      args: [clientId],
    });

    const invoiceId = uuidv4();
    await db.execute({
      sql: `INSERT INTO invoices (id, number, client_id, date, status, subtotal, tax_rate, tax_amount, total)
            VALUES (?, 'FAC-2026-0002', ?, '2026-03-02', 'draft', 50.0, 21, 10.5, 60.5)`,
      args: [invoiceId, clientId],
    });

    const req = new NextRequest("http://localhost/api/ticketbai", {
      method: "POST",
      body: JSON.stringify({ invoice_id: invoiceId, action: "generate" }),
    });

    const response = await POST(req);
    assert.strictEqual(response.status, 403, "Devuelve HTTP 403 para araba");

    const data = await response.json();
    assert.ok(data.error.includes("araba"), "Menciona el territorio araba en el mensaje");
    assert.strictEqual(fetchCallsCount, 0, "Cero llamadas de red externa");
  });

  test("3. Empresa con fiscal_territory = 'gipuzkoa' recibe HTTP 403", async () => {
    await initializeDatabase();
    const db = getDbClient();

    await db.execute({
      sql: `INSERT OR REPLACE INTO company_settings (id, trade_name, legal_name, nif, fiscal_territory)
            VALUES ('default', 'Empresa Donostia S.L.', 'Empresa Donostia S.L.', 'B66666666', 'gipuzkoa')`,
      args: [],
    });

    const clientId = uuidv4();
    await db.execute({
      sql: `INSERT INTO clients (id, name, nif) VALUES (?, 'Cliente Donostia', 'A33333333')`,
      args: [clientId],
    });

    const invoiceId = uuidv4();
    await db.execute({
      sql: `INSERT INTO invoices (id, number, client_id, date, status, subtotal, tax_rate, tax_amount, total)
            VALUES (?, 'FAC-2026-0003', ?, '2026-03-03', 'draft', 60.0, 21, 12.6, 72.6)`,
      args: [invoiceId, clientId],
    });

    const req = new NextRequest("http://localhost/api/ticketbai", {
      method: "POST",
      body: JSON.stringify({ invoice_id: invoiceId, action: "generate" }),
    });

    const response = await POST(req);
    assert.strictEqual(response.status, 403, "Devuelve HTTP 403 para gipuzkoa");

    const data = await response.json();
    assert.ok(data.error.includes("gipuzkoa"), "Menciona gipuzkoa en el mensaje");
    assert.strictEqual(fetchCallsCount, 0, "Cero llamadas de red externa");
  });

  test("4. Empresa en Bizkaia completa genera XML TicketBAI y LROE correctamente", async () => {
    await initializeDatabase();
    const db = getDbClient();

    const customNif = "B87654321";
    const customLegalName = "Instalaciones Eléctricas Bizkaia S.L.";
    await db.execute({
      sql: `INSERT OR REPLACE INTO company_settings
            (id, trade_name, legal_name, owner_name, nif, fiscal_territory, updated_at)
            VALUES ('default', ?, ?, 'Pedro Bilbao', ?, 'bizkaia', datetime('now'))`,
      args: [customLegalName, customLegalName, customNif],
    });

    const clientId = uuidv4();
    await db.execute({
      sql: `INSERT INTO clients (id, name, nif, address, city, postal_code, province)
            VALUES (?, 'Cliente Bilbao S.A.', 'A44444444', 'Gran Vía 1', 'Bilbao', '48001', 'Bizkaia')`,
      args: [clientId],
    });

    const invoiceId = uuidv4();
    await db.execute({
      sql: `INSERT INTO invoices (id, number, client_id, date, status, subtotal, tax_rate, tax_amount, total)
            VALUES (?, 'TBAI2026-0001', ?, '2026-03-01', 'draft', 100.0, 21, 21.0, 121.0)`,
      args: [invoiceId, clientId],
    });

    await db.execute({
      sql: `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total, sort_order)
            VALUES (?, ?, 'Instalación eléctrica', 1, 100.0, 100.0, 0)`,
      args: [uuidv4(), invoiceId],
    });

    const req = new NextRequest("http://localhost/api/ticketbai", {
      method: "POST",
      body: JSON.stringify({ invoice_id: invoiceId, action: "generate" }),
    });

    const response = await POST(req);
    assert.strictEqual(response.status, 200, "Respuesta HTTP 200 OK");

    const data = await response.json();
    assert.ok(data.xml.includes(`<NIF>${customNif}</NIF>`), "NIF dinámico en XML");
    assert.ok(data.xml.includes(`<ApellidosNombreRazonSocial>${customLegalName}</ApellidosNombreRazonSocial>`), "Razón Social en XML");
    assert.ok(data.lroeXml, "Genera LROE XML para Batuz");
    assert.strictEqual(fetchCallsCount, 0, "Cero conexiones de red externas");
  });

  test("5. Empresa en Bizkaia sin NIF recibe HTTP 400 y no genera XML", async () => {
    await initializeDatabase();
    const db = getDbClient();

    await db.execute({
      sql: `INSERT OR REPLACE INTO company_settings (id, trade_name, legal_name, nif, fiscal_territory)
            VALUES ('default', 'Empresa Sin NIF S.L.', 'Empresa Sin NIF S.L.', '', 'bizkaia')`,
      args: [],
    });

    const clientId = uuidv4();
    await db.execute({
      sql: `INSERT INTO clients (id, name, nif) VALUES (?, 'Cliente X', 'X11111111')`,
      args: [clientId],
    });

    const invoiceId = uuidv4();
    await db.execute({
      sql: `INSERT INTO invoices (id, number, client_id, date, status, subtotal, tax_rate, tax_amount, total)
            VALUES (?, 'TBAI2026-0005', ?, '2026-03-05', 'draft', 10.0, 21, 2.1, 12.1)`,
      args: [invoiceId, clientId],
    });

    const req = new NextRequest("http://localhost/api/ticketbai", {
      method: "POST",
      body: JSON.stringify({ invoice_id: invoiceId }),
    });

    const response = await POST(req);
    assert.strictEqual(response.status, 400, "Responde HTTP 400 por NIF ausente");

    const data = await response.json();
    assert.strictEqual(data.xml, undefined, "No genera XML");
    assert.ok(data.error.includes("NIF"), "Error explicita falta de NIF");
    assert.strictEqual(fetchCallsCount, 0, "Cero conexiones de red externas");
  });

  test("6. Empresa en Bizkaia sin legal_name (razón social fiscal) recibe HTTP 400 aunque exista trade_name", async () => {
    await initializeDatabase();
    const db = getDbClient();

    await db.execute({
      sql: `INSERT OR REPLACE INTO company_settings (id, trade_name, legal_name, nif, fiscal_territory)
            VALUES ('default', 'Nombre Comercial Electromédica', '', 'B12345678', 'bizkaia')`,
      args: [],
    });

    const clientId = uuidv4();
    await db.execute({
      sql: `INSERT INTO clients (id, name, nif) VALUES (?, 'Cliente Y', 'Y22222222')`,
      args: [clientId],
    });

    const invoiceId = uuidv4();
    await db.execute({
      sql: `INSERT INTO invoices (id, number, client_id, date, status, subtotal, tax_rate, tax_amount, total)
            VALUES (?, 'TBAI2026-0006', ?, '2026-03-06', 'draft', 20.0, 21, 4.2, 24.2)`,
      args: [invoiceId, clientId],
    });

    const req = new NextRequest("http://localhost/api/ticketbai", {
      method: "POST",
      body: JSON.stringify({ invoice_id: invoiceId }),
    });

    const response = await POST(req);
    assert.strictEqual(response.status, 400, "Responde HTTP 400 por razón social (legal_name) ausente");

    const data = await response.json();
    assert.strictEqual(data.xml, undefined, "No genera XML");
    assert.ok(data.error.includes("razón social"), "Error exige razón social fiscal explícita");
    assert.strictEqual(fetchCallsCount, 0, "Cero conexiones de red externas");
  });

  test("7. No se utiliza el emisor fallback estático por defecto (Endurecida)", async () => {
    await initializeDatabase();
    const db = getDbClient();

    const customName = "Empresa Bizkaia Real S.L.";
    await db.execute({
      sql: `INSERT OR REPLACE INTO company_settings (id, trade_name, legal_name, nif, fiscal_territory)
            VALUES ('default', ?, ?, 'B99887766', 'bizkaia')`,
      args: [customName, customName],
    });

    const clientId = uuidv4();
    await db.execute({
      sql: `INSERT INTO clients (id, name, nif) VALUES (?, 'Cliente Z', 'Z33333333')`,
      args: [clientId],
    });

    const invoiceId = uuidv4();
    await db.execute({
      sql: `INSERT INTO invoices (id, number, client_id, date, status, subtotal, tax_rate, tax_amount, total)
            VALUES (?, 'TBAI2026-0007', ?, '2026-03-07', 'draft', 30.0, 21, 6.3, 36.3)`,
      args: [invoiceId, clientId],
    });

    const req = new NextRequest("http://localhost/api/ticketbai", {
      method: "POST",
      body: JSON.stringify({ invoice_id: invoiceId }),
    });

    const response = await POST(req);
    assert.strictEqual(response.status, 200, "Responde HTTP 200 OK");

    const data = await response.json();
    assert.ok(typeof data.xml === "string" && data.xml.length > 0, "El XML generado es una cadena no vacía");
    assert.ok(
      data.xml.includes(`<ApellidosNombreRazonSocial>${customName}</ApellidosNombreRazonSocial>`),
      "El XML contiene la razón social dinámica configurada"
    );

    if (TICKETBAI_CONFIG.emisor.nombre !== customName) {
      assert.strictEqual(
        data.xml.includes(`<ApellidosNombreRazonSocial>${TICKETBAI_CONFIG.emisor.nombre}</ApellidosNombreRazonSocial>`),
        false,
        "El emisor fallback estático no aparece en el XML"
      );
    }

    assert.strictEqual(fetchCallsCount, 0, "Garantía de cero conexiones de red externas");
  });

  // --- C. ENDURECIMIENTO Y PRUEBAS DE LA API CONFIRM ---

  test("8. Solicitud con invoice_id ausente o no string recibe HTTP 400", async () => {
    await initializeDatabase();

    const req = new NextRequest("http://localhost/api/ticketbai", {
      method: "POST",
      body: JSON.stringify({ action: "generate", invoice_id: "   " }),
    });

    const response = await POST(req);
    assert.strictEqual(response.status, 400, "Responde 400 si invoice_id está vacío");

    const data = await response.json();
    assert.ok(data.error.includes("invoice_id"), "Error explicita invoice_id obligatorio");
  });

  test("9. Solicitud con acción no permitida (ej: 'delete') recibe HTTP 400", async () => {
    await initializeDatabase();

    const req = new NextRequest("http://localhost/api/ticketbai", {
      method: "POST",
      body: JSON.stringify({ action: "delete", invoice_id: uuidv4() }),
    });

    const response = await POST(req);
    assert.strictEqual(response.status, 400, "Responde 400 para acción desconocida");

    const data = await response.json();
    assert.ok(data.error.includes("Acción no válida"), "Informa que solo se admite generate o confirm");
  });

  test("10. Solicitud confirmación con campos TicketBAI vacíos o tipos incorrectos recibe HTTP 400", async () => {
    await initializeDatabase();

    const req = new NextRequest("http://localhost/api/ticketbai", {
      method: "POST",
      body: JSON.stringify({
        action: "confirm",
        invoice_id: uuidv4(),
        ticketbai_id: "",
        ticketbai_signature: 12345, // No string
        ticketbai_qr: "QR-OK",
      }),
    });

    const response = await POST(req);
    assert.strictEqual(response.status, 400, "Responde 400 si faltan o no son texto los campos de confirmación");

    const data = await response.json();
    assert.ok(data.error.includes("Faltan datos de confirmación"), "Detalla campos inválidos");
  });

  test("11. Intento de confirmación sobre factura en estado 'draft' recibe HTTP 409", async () => {
    await initializeDatabase();
    const db = getDbClient();

    await db.execute({
      sql: `INSERT OR REPLACE INTO company_settings (id, trade_name, legal_name, nif, fiscal_territory)
            VALUES ('default', 'Empresa Bizkaia S.L.', 'Empresa Bizkaia S.L.', 'B87654321', 'bizkaia')`,
      args: [],
    });

    const clientId = uuidv4();
    await db.execute({
      sql: `INSERT INTO clients (id, name, nif) VALUES (?, 'Cliente Batuz', 'B99991111')`,
      args: [clientId],
    });

    const invoiceId = uuidv4();
    await db.execute({
      sql: `INSERT INTO invoices (id, number, client_id, date, status, subtotal, tax_rate, tax_amount, total)
            VALUES (?, 'TBAI2026-8888', ?, '2026-03-08', 'draft', 100.0, 21, 21.0, 121.0)`,
      args: [invoiceId, clientId],
    });

    const req = new NextRequest("http://localhost/api/ticketbai", {
      method: "POST",
      body: JSON.stringify({
        action: "confirm",
        invoice_id: invoiceId,
        ticketbai_id: "TBAI-DRAFT-001",
        ticketbai_signature: "SIG-DRAFT-001",
        ticketbai_qr: "QR-DRAFT-001",
      }),
    });

    const response = await POST(req);
    assert.strictEqual(response.status, 409, "Responde 409 porque la factura no está en pending_batuz");

    const data = await response.json();
    assert.ok(data.error.includes("pending_batuz") || data.error.includes("pendiente"), "Indica estado incorrecto");
  });

  test("12. Confirmación válida desde estado 'pending_batuz' en Bizkaia actualiza factura a status 'sent'", async () => {
    await initializeDatabase();
    const db = getDbClient();

    await db.execute({
      sql: `INSERT OR REPLACE INTO company_settings (id, trade_name, legal_name, nif, fiscal_territory)
            VALUES ('default', 'Empresa Bizkaia S.L.', 'Empresa Bizkaia S.L.', 'B87654321', 'bizkaia')`,
      args: [],
    });

    const clientId = uuidv4();
    await db.execute({
      sql: `INSERT INTO clients (id, name, nif) VALUES (?, 'Cliente Batuz S.L.', 'B99991111')`,
      args: [clientId],
    });

    const invoiceId = uuidv4();
    await db.execute({
      sql: `INSERT INTO invoices (id, number, client_id, date, status, subtotal, tax_rate, tax_amount, total)
            VALUES (?, 'TBAI2026-9999', ?, '2026-03-09', 'pending_batuz', 100.0, 21, 21.0, 121.0)`,
      args: [invoiceId, clientId],
    });

    const req = new NextRequest("http://localhost/api/ticketbai", {
      method: "POST",
      body: JSON.stringify({
        action: "confirm",
        invoice_id: invoiceId,
        ticketbai_id: "TBAI-CONFIRMED-001",
        ticketbai_signature: "SIG-CONFIRMED-001",
        ticketbai_qr: "QR-CONFIRMED-001",
      }),
    });

    const response = await POST(req);
    assert.strictEqual(response.status, 200, "Responde HTTP 200 OK");

    const invRes = await db.execute({
      sql: "SELECT status, ticketbai_id, ticketbai_signature, ticketbai_qr FROM invoices WHERE id = ?",
      args: [invoiceId],
    });

    assert.strictEqual(invRes.rows[0].status, "sent", "Factura actualizada a status sent");
    assert.strictEqual(invRes.rows[0].ticketbai_id, "TBAI-CONFIRMED-001", "ticketbai_id guardado");
  });

  // --- D. FACTURACIÓN COMÚN Y ERRORES INTERNOS SEGUROS ---

  test("13. La creación de facturas ordinarias vía API continúa funcionando independientemente de TicketBAI (fiscal_territory=common)", async () => {
    await initializeDatabase();
    const db = getDbClient();

    await db.execute({
      sql: `INSERT OR REPLACE INTO company_settings (id, trade_name, legal_name, nif, fiscal_territory)
            VALUES ('default', 'Empresa Nacional S.L.', 'Empresa Nacional S.L.', 'B12312312', 'common')`,
      args: [],
    });

    const clientId = uuidv4();
    await db.execute({
      sql: `INSERT INTO clients (id, name, nif) VALUES (?, 'Cliente Nacional S.L.', 'B12312312')`,
      args: [clientId],
    });

    const req = new NextRequest("http://localhost/api/invoices", {
      method: "POST",
      body: JSON.stringify({
        client_id: clientId,
        date: "2026-03-10",
        tax_rate: 21,
        items: [
          { description: "Servicio de instalación estándar", quantity: 1, unit_price: 250 },
        ],
      }),
    });

    const response = await createInvoiceRoute(req);
    assert.strictEqual(response.status, 201, "Creación de factura ordinaria responde 201 Created");

    const data = await response.json();
    assert.ok(data.id, "Factura ordinaria creada con ID");

    const checkDb = await db.execute({
      sql: "SELECT ticketbai_id, status FROM invoices WHERE id = ?",
      args: [data.id],
    });

    assert.strictEqual(checkDb.rows[0].ticketbai_id, null, "La factura ordinaria mantiene ticketbai_id = null");
    assert.notStrictEqual(checkDb.rows[0].status, "pending_batuz", "El estado NO es pending_batuz");
  });

  test("14. Error interno en getStrictBizkaiaFiscalProfile responde con status 500 y mensaje seguro sin revelar trazas", async () => {
    const sentinelMsg = "DATABASE_INTERNAL_ERROR_SENTINEL_12345";
    const stubDb = {
      execute: async () => {
        throw new Error(sentinelMsg);
      },
    } as any;

    const originalConsoleError = console.error;
    console.error = () => {}; // Silenciar log de servidor durante el test para evitar ruido en consola

    try {
      const res = await getStrictBizkaiaFiscalProfile(stubDb);

      assert.strictEqual(res.success, false, "Devuelve success === false");
      assert.strictEqual(res.status, 500, "Devuelve status === 500");
      assert.strictEqual(
        res.error,
        "No se pudo verificar la configuración fiscal de la empresa.",
        "Mensaje público genérico exacto"
      );
      assert.strictEqual(res.error.includes(sentinelMsg), false, "No expone el texto centinela interno");
      assert.strictEqual(res.error.includes("stack"), false, "No expone trazas de stack");
    } finally {
      console.error = originalConsoleError; // Restauración obligatoria en finally
    }
  });
});
