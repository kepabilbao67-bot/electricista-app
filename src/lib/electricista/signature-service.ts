/**
 * ELECTRICISTA360 — Signature Service Foundation
 * Firma simple con consentimiento y trazabilidad. No afirma firma cualificada.
 */

export type SignatureStatus = "pending" | "signed" | "rejected" | "expired" | "revoked";
export type SignerRole = "professional" | "client" | "witness";
export type SignableDocumentType = "budget" | "work_order" | "invoice" | "authorization" | "generic";

export interface SignatureRecord {
  id: string;
  documentId: string;
  documentType: SignableDocumentType;
  documentHash: string;
  signerRole: SignerRole;
  signerName: string;
  signerIdentifier?: string;
  consentText: string;
  consentAccepted: boolean;
  status: SignatureStatus;
  requestedAt: string;
  signedAt?: string;
  signedDocumentRef?: string;
  metadata?: SignatureMetadata;
}

export interface SignatureMetadata {
  captureMethod?: string;
  userAgent?: string;
}

export interface SignatureValidationResult { valid: boolean; errors: string[] }

export function validateSignatureRecord(record: Partial<SignatureRecord>): SignatureValidationResult {
  const errors: string[] = [];
  if (!record.documentId) errors.push("Falta documentId.");
  if (!record.documentType) errors.push("Falta documentType.");
  if (!record.documentHash || record.documentHash.length < 16) errors.push("documentHash ausente o demasiado corto.");
  if (!record.signerRole) errors.push("Falta signerRole.");
  if (!record.signerName || record.signerName.trim().length === 0) errors.push("Falta signerName.");
  if (!record.consentText || record.consentText.trim().length === 0) errors.push("Falta texto de consentimiento.");
  if (record.consentAccepted !== true) errors.push("El consentimiento debe ser aceptado explícitamente.");
  return { valid: errors.length === 0, errors };
}

export async function hashDocument(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

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

export function acceptSignature(record: SignatureRecord, metadata?: SignatureMetadata): SignatureRecord {
  if (!record.consentAccepted) throw new Error("No se puede firmar sin consentimiento aceptado.");
  if (record.status !== "pending") throw new Error(`Estado inválido para firmar: "${record.status}". Se esperaba "pending".`);
  return { ...record, status: "signed", signedAt: new Date().toISOString(), metadata: metadata || record.metadata };
}
