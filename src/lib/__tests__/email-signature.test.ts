import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  validateEmailDraft,
  sanitizeEmailContent,
  createEmailDraft,
} from "../autonomo360/email-service";
import {
  validateSignatureRecord,
  createSignatureRequest,
  acceptSignature,
  hashDocument,
} from "../autonomo360/signature-service";

// --- Email Service ---

describe("email-service: validateEmailDraft", () => {
  test("draft válido pasa validación", () => {
    const result = validateEmailDraft({
      clientId: "c1",
      clientEmail: "test@example.com",
      subject: "Presupuesto adjunto",
      body: "Hola, te adjunto el presupuesto.",
    });
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  test("email inválido falla", () => {
    const result = validateEmailDraft({
      clientId: "c1",
      clientEmail: "noesunmail",
      subject: "Test",
      body: "Contenido",
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("inválido")));
  });

  test("sin asunto falla", () => {
    const result = validateEmailDraft({
      clientId: "c1",
      clientEmail: "a@b.com",
      subject: "",
      body: "Contenido",
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("asunto")));
  });

  test("sin body falla", () => {
    const result = validateEmailDraft({
      clientId: "c1",
      clientEmail: "a@b.com",
      subject: "Test",
      body: "",
    });
    assert.equal(result.valid, false);
  });

  test("sin clientId falla", () => {
    const result = validateEmailDraft({
      clientEmail: "a@b.com",
      subject: "Test",
      body: "OK",
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("cliente")));
  });
});

describe("email-service: sanitizeEmailContent", () => {
  test("elimina caracteres de control", () => {
    const result = sanitizeEmailContent("Hola\x00mundo\x07test");
    assert.equal(result, "Holamundotest");
  });

  test("normaliza CRLF a LF", () => {
    const result = sanitizeEmailContent("Linea1\r\nLinea2\rLinea3");
    assert.equal(result, "Linea1\nLinea2\nLinea3");
  });

  test("texto normal no se modifica", () => {
    const input = "Hola, te envío el presupuesto.\nSaludos.";
    assert.equal(sanitizeEmailContent(input), input);
  });
});

describe("email-service: createEmailDraft", () => {
  test("crea draft con status draft", () => {
    const draft = createEmailDraft({
      id: "e1",
      clientId: "c1",
      clientEmail: "test@mail.com",
      subject: "Asunto",
      body: "Cuerpo del mensaje",
    });
    assert.equal(draft.status, "draft");
    assert.equal(draft.id, "e1");
    assert.ok(draft.createdAt);
    assert.ok(draft.updatedAt);
  });

  test("no envía realmente (no hay side effects)", () => {
    const draft = createEmailDraft({
      id: "e2",
      clientId: "c2",
      clientEmail: "otro@mail.com",
      subject: "Test",
      body: "Body",
    });
    assert.equal(draft.sentAt, undefined);
    assert.equal(draft.status, "draft");
  });
});

// --- Signature Service ---

describe("signature-service: validateSignatureRecord", () => {
  test("registro válido pasa", () => {
    const result = validateSignatureRecord({
      documentId: "doc1",
      documentType: "budget",
      documentHash: "abcdef1234567890abcdef1234567890",
      signerRole: "client",
      signerName: "Juan García",
      consentText: "Acepto los términos",
      consentAccepted: true,
    });
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  test("sin documentId falla", () => {
    const result = validateSignatureRecord({
      documentType: "budget",
      documentHash: "abcdef1234567890abcdef",
      signerRole: "client",
      signerName: "Test",
      consentText: "Acepto",
      consentAccepted: true,
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("documentId")));
  });

  test("hash demasiado corto falla", () => {
    const result = validateSignatureRecord({
      documentId: "doc1",
      documentType: "budget",
      documentHash: "abc",
      signerRole: "client",
      signerName: "Test",
      consentText: "Acepto",
      consentAccepted: true,
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("Hash")));
  });

  test("consentimiento no aceptado falla", () => {
    const result = validateSignatureRecord({
      documentId: "doc1",
      documentType: "budget",
      documentHash: "abcdef1234567890abcdef",
      signerRole: "client",
      signerName: "Test",
      consentText: "Acepto",
      consentAccepted: false,
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("consentimiento")));
  });
});

describe("signature-service: createSignatureRequest", () => {
  test("crea request en estado pending", () => {
    const request = createSignatureRequest({
      id: "sig1",
      documentId: "doc1",
      documentType: "budget",
      documentHash: "hash1234567890abcdef1234567890abcdef",
      signerRole: "client",
      signerName: "Ana Pérez",
      consentText: "Acepto firmar este presupuesto.",
    });
    assert.equal(request.status, "pending");
    assert.equal(request.consentAccepted, false);
    assert.ok(request.requestedAt);
    assert.equal(request.signedAt, undefined);
  });

  test("no afirma firma cualificada", () => {
    const request = createSignatureRequest({
      id: "sig2",
      documentId: "doc2",
      documentType: "work_order",
      documentHash: "hash1234567890abcdef1234",
      signerRole: "professional",
      signerName: "Profesional",
      consentText: "Confirmo la ejecución.",
    });
    // No hay campo que indique validez jurídica cualificada
    assert.equal((request as unknown as Record<string, unknown>).qualified, undefined);
    assert.equal((request as unknown as Record<string, unknown>).legalValidity, undefined);
  });
});

describe("signature-service: acceptSignature", () => {
  test("firma correctamente con consentimiento", () => {
    const request = createSignatureRequest({
      id: "sig3",
      documentId: "doc3",
      documentType: "budget",
      documentHash: "hash1234567890abcdef1234567890abcdef",
      signerRole: "client",
      signerName: "Test",
      consentText: "Acepto",
    });
    // Simular aceptación de consentimiento
    const withConsent = { ...request, consentAccepted: true };
    const signed = acceptSignature(withConsent, { captureMethod: "tap_confirm" });
    assert.equal(signed.status, "signed");
    assert.ok(signed.signedAt);
    assert.equal(signed.metadata?.captureMethod, "tap_confirm");
  });

  test("sin consentimiento lanza error", () => {
    const request = createSignatureRequest({
      id: "sig4",
      documentId: "doc4",
      documentType: "budget",
      documentHash: "hash1234567890abcdef1234567890abcdef",
      signerRole: "client",
      signerName: "Test",
      consentText: "Acepto",
    });
    assert.throws(() => acceptSignature(request), /consentimiento/);
  });

  test("estado no pending lanza error", () => {
    const request = createSignatureRequest({
      id: "sig5",
      documentId: "doc5",
      documentType: "budget",
      documentHash: "hash1234567890abcdef1234567890abcdef",
      signerRole: "client",
      signerName: "Test",
      consentText: "Acepto",
    });
    const signed = { ...request, consentAccepted: true, status: "signed" as const };
    assert.throws(() => acceptSignature(signed), /inválido/);
  });
});

describe("signature-service: hashDocument", () => {
  test("genera hash SHA-256 de 64 caracteres hex", async () => {
    const hash = await hashDocument("Contenido del documento de prueba");
    assert.equal(hash.length, 64);
    assert.match(hash, /^[0-9a-f]{64}$/);
  });

  test("mismo contenido produce mismo hash", async () => {
    const h1 = await hashDocument("test123");
    const h2 = await hashDocument("test123");
    assert.equal(h1, h2);
  });

  test("contenido diferente produce hash diferente", async () => {
    const h1 = await hashDocument("documentoA");
    const h2 = await hashDocument("documentoB");
    assert.notEqual(h1, h2);
  });
});
