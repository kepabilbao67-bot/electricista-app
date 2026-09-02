/**
 * PEDRO BARYMONT — CENTRO DE COMUNICACIONES 360
 * Núcleo Omnicanal: Tipos y Contratos Fundamentales
 */

export type ChannelType =
  | "webchat"
  | "form"
  | "email"
  | "whatsapp"
  | "sms"
  | "phone"
  | "voice_ai"
  | "telegram"
  | "instagram"
  | "messenger"
  | "appointment";

export type ChannelIntegrationStatus = "REAL" | "DEMO" | "PARCIAL" | "NO_DISPONIBLE" | "NO_VERIFICADO";

export interface ChannelCapabilities {
  supportsText: boolean;
  supportsRichText: boolean;
  supportsAttachments: boolean;
  supportsTemplates: boolean;
  supportsReadReceipts: boolean;
  supportsTypingIndicator: boolean;
  supportsVoice: boolean;
  supportsWebhooks: boolean;
}

export type ConversationStatus = "open" | "pending" | "waiting_client" | "urgent" | "resolved" | "archived";
export type PriorityLevel = "low" | "normal" | "high" | "urgent";
export type MessageDirection = "inbound" | "outbound";
export type SenderType = "contact" | "agent" | "bot" | "system";
export type MessageDeliveryStatus = "draft" | "queued" | "sending" | "sent" | "delivered" | "read" | "failed";

export interface Attachment {
  id: string;
  messageId?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;
  mimeType?: string;
}

export interface InternalNote {
  id: string;
  conversationId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  entityType: "conversation" | "message" | "contact" | "automation" | "opt_out" | "appointment";
  entityId: string;
  action: string;
  performedBy: string;
  details?: Record<string, unknown> | string;
  timestamp: string;
}

export interface OptOutRecord {
  id: string;
  contactId?: string;
  identifier: string;
  channel: ChannelType | "all";
  reason?: string;
  source: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AiAction {
  id: string;
  messageId?: string;
  conversationId: string;
  detectedIntent: string;
  confidence: number;
  sentiment: "positive" | "neutral" | "negative" | "frustrated";
  priority: PriorityLevel;
  draft?: string;
  requiresHumanReview: boolean;
  autoAllowed: boolean;
  reason?: string;
  executed: boolean;
  createdAt: string;
}

export interface OmniContact {
  id: string;
  clientId?: string;
  leadId?: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  telegram?: string;
  instagram?: string;
  preferredChannel?: ChannelType;
  tags: string[];
  isOptedOut?: boolean;
  possibleMatches?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ChannelIdentity {
  id: string;
  contactId: string;
  channel: ChannelType;
  identifier: string;
  displayName?: string;
  verified: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  channel: ChannelType;
  direction: MessageDirection;
  senderType: SenderType;
  senderId?: string;
  senderName?: string;
  content: string;
  externalMessageId?: string;
  provider?: string;
  status: MessageDeliveryStatus;
  attachments?: Attachment[];
  metadata?: Record<string, unknown>;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  contactId: string;
  contactName: string;
  contactIdentifier?: string;
  clientId?: string;
  opportunityId?: string;
  channel: ChannelType;
  status: ConversationStatus;
  priority: PriorityLevel;
  assignedTo?: string;
  title?: string;
  unreadCount: number;
  lastMessagePreview?: string;
  lastMessageAt: string;
  tags: string[];
  internalNotesCount: number;
  isAiAssisted: boolean;
  aiSuggestedDraft?: string;
  requiresHumanReview: boolean;
  handoffReason?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  contactId: string;
  contactName: string;
  clientId?: string;
  opportunityId?: string;
  title: string;
  date: string;
  time: string;
  durationMinutes: number;
  status: "requested" | "confirmed" | "rescheduled" | "cancelled" | "completed";
  channelOrigin: ChannelType;
  notes?: string;
  createdAt: string;
}

export interface CallRecord {
  id: string;
  contactId: string;
  contactName: string;
  clientId?: string;
  direction: "inbound" | "outbound";
  status: "missed" | "completed" | "in_progress" | "voicemail";
  durationSeconds: number;
  recordingUrl?: string;
  transcript?: string;
  summary?: string;
  aiSentiment?: "positive" | "neutral" | "negative" | "frustrated";
  createdAt: string;
}

export interface AutomationCondition {
  field: string;
  operator: "equals" | "contains" | "greater_than" | "less_than" | "in" | "is_not";
  value: unknown;
}

export interface AutomationAction {
  type: "send_draft" | "create_followup_task" | "update_crm_stage" | "assign_agent" | "tag_conversation" | "cancel_followup" | "trigger_handoff" | "schedule_appointment_request";
  payload: Record<string, unknown>;
}

export interface Automation {
  id: string;
  name: string;
  trigger: "new_inbound_message" | "new_lead_created" | "client_replied" | "no_reply_24h" | "no_reply_48h" | "opt_out_received" | "high_intent_detected";
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  active: boolean;
}

export interface AutomationRun {
  id: string;
  automationId: string;
  automationName: string;
  conversationId: string;
  status: "success" | "skipped" | "failed" | "cancelled";
  details?: string;
  executedAt: string;
}
