import test from "node:test";
import assert from "node:assert/strict";
import { CRM_STAGES, isCrmStage } from "../crm";
import { buildWhatsAppUrl, normalizePhoneForWhatsApp } from "../phone";
import { fillTemplate, templates } from "../templates";

test("el pipeline conserva las etapas comerciales en orden y sin duplicados", () => {
  // El pipeline del CRM incluye las etapas comerciales genéricas del vertical
  // electricista (visita, presupuesto, aceptado, trabajo, facturado, cobrado) más
  // las etapas de seguimiento. El test fija el ORDEN y la AUSENCIA de duplicados,
  // que es el invariante real: si se añade una etapa, este test debe actualizarse
  // en el mismo cambio.
  const esperadas = [
    "nuevo", "contactado", "reunion", "seguimiento", "interesado", "doc_pendiente",
    "propuesta", "negociacion", "cliente", "no_interesado", "perdido", "visita",
    "presupuesto", "aceptado", "trabajo", "facturado", "cobrado",
  ];
  assert.deepEqual([...CRM_STAGES], esperadas);
  assert.equal(new Set(CRM_STAGES).size, CRM_STAGES.length, "sin etapas duplicadas");
  assert.equal(isCrmStage("facturado"), true);
  assert.equal(isCrmStage("enviado"), false);
});

test("normaliza un teléfono español y crea un wa.me seguro", () => {
  const normalized = normalizePhoneForWhatsApp("612 345 678");
  assert.equal(normalized.valid, true);
  assert.equal(normalized.international, "34612345678");
  assert.equal(buildWhatsAppUrl("+34 612 345 678", "Hola & gracias").url, "https://wa.me/34612345678?text=Hola%20%26%20gracias");
});

test("rechaza teléfonos ambiguos o inválidos", () => {
  assert.equal(normalizePhoneForWhatsApp("12345").valid, false);
  assert.equal(normalizePhoneForWhatsApp("2025550123").valid, false);
  assert.equal(normalizePhoneForWhatsApp("+1 202 555 0123").valid, true);
});

test("las plantillas se editan mediante variables y no afirman envío", () => {
  const template = templates.find((item) => item.id === "recordatorio_pago_amable");
  assert.ok(template);
  const rendered = fillTemplate(template, { nombre: "Cliente Demo", numero: "DEMO-001", total: 120 });
  assert.match(rendered.body, /Cliente Demo/);
  assert.doesNotMatch(rendered.body.toLowerCase(), /mensaje enviado|mensaje entregado|mensaje leído/);
});
