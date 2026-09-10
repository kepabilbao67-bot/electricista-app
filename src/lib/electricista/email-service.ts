/**
 * ELECTRICISTA360 — Email Service Foundation
 * Crea y valida borradores. No conecta proveedores externos ni almacena credenciales.
 */

export type EmailStatus = "draft" | "queued" | "sent" | "failed" | "cancelled";
export type DocumentType = "budget" | "invoice" | "work_order" | "signed_document" | "reminder" | "generic";

export interface EmailDraft {
  id: string;
  clientId: string;
  clientEmail: string;
  subject: string;
  body: string;
  attachmentRef?: string;
  attachmentType?: DocumentType;
  status: EmailStatus;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  errorMessage?: string;
  communicationId?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 50_000;

export interface EmailValidationResult { valid: boolean; errors: string[] }

export function validateEmailDraft(draft: Partial<EmailDraft>): EmailValidationResult {
  const errors: string[] = [];
  if (!draft.clientEmail || !EMAIL_REGEX.test(draft.clientEmail)) errors.push("Email del destinatario inválido o ausente.");
  if (!draft.subject || draft.subject.trim().length === 0) errors.push("El asunto no puede estar vacío.");
  else if (draft.subject.length > MAX_SUBJECT_LENGTH) errors.push(`El asunto excede ${MAX_SUBJECT_LENGTH} caracteres.`);
  if (!draft.body || draft.body.trim().length === 0) errors.push("El cuerpo del mensaje no puede estar vacío.");
  else if (draft.body.length > MAX_BODY_LENGTH) errors.push(`El cuerpo excede ${MAX_BODY_LENGTH} caracteres.`);
  if (!draft.clientId) errors.push("Falta identificador del cliente.");
  return { valid: errors.length === 0, errors };
}

export function sanitizeEmailContent(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

export interface EmailProvider {
  readonly name: string;
  send(draft: EmailDraft): Promise<EmailSendResult>;
}

export interface EmailSendResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

export function createEmailDraft(params: {
  id: string;
  clientId: string;
  clientEmail: string;
  subject: string;
  body: string;
  attachmentRef?: string;
  attachmentType?: DocumentType;
}): EmailDraft {
  const now = new Date().toISOString();
  return {
    id: params.id,
    clientId: params.clientId,
    clientEmail: params.clientEmail,
    subject: sanitizeEmailContent(params.subject),
    body: sanitizeEmailContent(params.body),
    attachmentRef: params.attachmentRef,
    attachmentType: params.attachmentType,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}
