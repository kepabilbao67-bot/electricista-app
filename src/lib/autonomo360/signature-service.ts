/**
 * FIRMA 360 — Signature Service Foundation
 *
 * Modelo de datos y lógica para registro de firmas con trazabilidad.
 *
 * IMPORTANTE:
 * - NO afirma validez jurídica de firma electrónica cualificada.
 * - NO integra proveedores externos de firma.
 * - Registra intención, consentimiento, timestamp y hash del documento.
 * - Pensado para firma simple (consentimiento + evidencia) en esta fase.
 */

// --- Tipos ---

export type SignatureStatus = "pending" | "signed" | "rejected" | "expired" | "revoked";

export type SignerRole = "professional" | "client" | "witness";

export type SignableDocumentType = "budget" | "work_order" | "invoice" | "authorization" | "generic";

export interface SignatureRecord {
  id: string;
  /** Documento firmado */
  documentId: string;
  documentType: SignableDocumentType;
  /** Hash SHA-256 del contenido del documento en el momento de firma */
  documentHash: string;
  /** Firmante */
  signerRole: SignerRole;
  signerName: string;
  signerIdentifier?: string; // Email o teléfono (no NIF en esta fase)
  /** Consentimiento */
  consentText: string;
  consentAccepted: boolean;
  /** Estado */
  status: SignatureStatus;
  /** Timestamps ISO */
  requestedAt: string;
  signedAt?: string;
  /** Referencia al documento firmado generado (PDF con evidencia) */
  signedDocumentRef?: string;
  /** Metadatos de contexto (IP no se almacena sin aviso; user-agent opcional) */
  metadata?: SignatureMetadata;
}

export interface SignatureMetadata {
  /** Método de captura: "tap_confirm" | "draw" | "typed" */
  captureMethod?: string;
  /** User agent del firmante (si se informó) */
  userAgent?: string;
}

// --- Validación ---

export interface SignatureValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Valida que un registro de firma tenga los campos obligatorios.
 */
export function validateSignatureRecord(record: Partial<SignatureRecord>): SignatureValidationResult {
  const errors: string[] = [];

  if (!record.documentId) errors.push("Falta documentId.");
  if (!record.documentType) errors.push("Falta documentType.");
  if (!record.documentHash || record.documentHash.length < 16) {
    errors.push("documentHash ausente o demasiado corto.");
  }
  if (!record.signerRole) errors.push("Falta signerRole.");
  if (!record.signerName || record.signerName.trim().length === 0) {
    errors.push("Falta signerName.");
  }
  if (!record.consentText || record.consentText.trim().length === 0) {
    errors.push("Falta texto de consentimiento.");
  }
  if (record.consentAccepted !== true) {
    errors.push("El consentimiento debe ser aceptado explícitamente.");
  }

  return { valid: errors.length === 0, errors };
}

// --- Hash helper ---

/**
 * Genera un hash SHA-256 de un string (contenido del documento).
 * Usa Web Crypto API (disponible en Node 18+ y navegadores modernos).
 *
 * NOTA: En entorno de servidor Next.js, crypto.subtle está disponible.
 * En fases futuras se puede usar el hash del PDF generado.
 */
export async function hashDocument(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// --- Factory ---

/**
 * Crea un registro de firma en estado "pending".
 * No persiste nada. No genera PDF.
 */
export function createSignatureRequest(params: {
  id: string;
  documentId: string;
  documentType: SignableDocumentType;
  documentHash: string;
  signerRole: SignerRole;
  signerName: string;
  signerIdentifier?: string;
  consentText: string;
}): SignatureRecord {
  return {
    id: params.id,
    documentId: params.documentId,
    documentType: params.documentType,
    documentHash: params.documentHash,
    signerRole: params.signerRole,
    signerName: params.signerName,
    signerIdentifier: params.signerIdentifier,
    consentText: params.consentText,
    consentAccepted: false,
    status: "pending",
    requestedAt: new Date().toISOString(),
  };
}

/**
 * Marca un registro de firma como firmado.
 * Requiere que consentAccepted sea true.
 * Retorna una copia nueva (inmutable).
 */
export function acceptSignature(
  record: SignatureRecord,
  metadata?: SignatureMetadata
): SignatureRecord {
  if (!record.consentAccepted) {
    throw new Error("No se puede firmar sin consentimiento aceptado.");
  }
  if (record.status !== "pending") {
    throw new Error(`Estado inválido para firmar: "${record.status}". Se esperaba "pending".`);
  }
  return {
    ...record,
    status: "signed",
    signedAt: new Date().toISOString(),
    metadata: metadata || record.metadata,
  };
}
