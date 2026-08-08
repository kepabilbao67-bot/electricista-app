/**
 * CORREO 360 — Email Service Foundation
 *
 * Define tipos e interfaz para envío de emails desacoplado del proveedor.
 * No conecta SMTP, Gmail ni ningún servicio externo.
 * No almacena credenciales.
 *
 * El flujo es:
 * 1. Crear EmailDraft (registra intención)
 * 2. Validar/sanitizar
 * 3. Encolar (estado queued)
 * 4. Enviar mediante provider (fase futura)
 * 5. Actualizar estado (sent/failed)
 *
 * Se integra con la tabla communications existente para trazabilidad.
 */

// --- Tipos ---

export type EmailStatus = "draft" | "queued" | "sent" | "failed" | "cancelled";

export type DocumentType = "budget" | "invoice" | "work_order" | "signed_document" | "reminder" | "generic";

export interface EmailDraft {
  id: string;
  /** Cliente destinatario */
  clientId: string;
  clientEmail: string;
  /** Contenido */
  subject: string;
  body: string;
  /** Documento adjunto (referencia, no contenido) */
  attachmentRef?: string;
  attachmentType?: DocumentType;
  /** Estado actual */
  status: EmailStatus;
  /** Timestamps ISO */
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  /** Error si falló (sin incluir credenciales/tokens) */
  errorMessage?: string;
  /** Relación con comunicaciones existentes */
  communicationId?: string;
}

// --- Validación ---

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 50_000;

export interface EmailValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Valida un borrador de email antes de encolarlo.
 * No valida credenciales de envío (no las tiene).
 */
export function validateEmailDraft(draft: Partial<EmailDraft>): EmailValidationResult {
  const errors: string[] = [];

  if (!draft.clientEmail || !EMAIL_REGEX.test(draft.clientEmail)) {
    errors.push("Email del destinatario inválido o ausente.");
  }

  if (!draft.subject || draft.subject.trim().length === 0) {
    errors.push("El asunto no puede estar vacío.");
  } else if (draft.subject.length > MAX_SUBJECT_LENGTH) {
    errors.push(`El asunto excede ${MAX_SUBJECT_LENGTH} caracteres.`);
  }

  if (!draft.body || draft.body.trim().length === 0) {
    errors.push("El cuerpo del mensaje no puede estar vacío.");
  } else if (draft.body.length > MAX_BODY_LENGTH) {
    errors.push(`El cuerpo excede ${MAX_BODY_LENGTH} caracteres.`);
  }

  if (!draft.clientId) {
    errors.push("Falta identificador del cliente.");
  }

  return { valid: errors.length === 0, errors };
}

// --- Sanitización ---

/**
 * Sanitiza el contenido de un email eliminando posibles inyecciones de cabeceras.
 */
export function sanitizeEmailContent(text: string): string {
  // Eliminar caracteres de control y posibles inyecciones CRLF en cabeceras
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

// --- Provider Interface (para implementar en fase futura) ---

export interface EmailProvider {
  /** Nombre del proveedor (para logs) */
  readonly name: string;
  /**
   * Envía un email. Retorna true si fue aceptado por el proveedor.
   * No debe lanzar excepciones; devuelve resultado con error.
   */
  send(draft: EmailDraft): Promise<EmailSendResult>;
}

export interface EmailSendResult {
  success: boolean;
  /** ID externo del mensaje si el proveedor lo devuelve */
  externalId?: string;
  /** Mensaje de error sanitizado (sin credenciales) */
  error?: string;
}

// --- Draft Factory ---

/**
 * Crea un EmailDraft con valores por defecto.
 * No persiste nada. No envía nada.
 */
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
