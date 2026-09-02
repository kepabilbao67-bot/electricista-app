import {
  ChannelType,
  ChannelCapabilities,
  ChannelIntegrationStatus,
  Message,
  MessageDeliveryStatus,
  Attachment,
} from "../types";

export interface InboundPayload {
  externalMessageId: string;
  senderIdentifier: string;
  senderName?: string;
  content: string;
  attachments?: Attachment[];
  rawPayload?: unknown;
  timestamp?: string;
}

export interface OutboundPayload {
  conversationId: string;
  recipientIdentifier: string;
  content: string;
  attachments?: Attachment[];
  templateId?: string;
  templateParams?: Record<string, string>;
  inReplyToExternalId?: string;
}

export interface SendResult {
  success: boolean;
  externalMessageId?: string;
  status: MessageDeliveryStatus;
  error?: string;
  providerDetails?: Record<string, unknown>;
}

export interface ChannelAdapter {
  channel: ChannelType;
  name: string;
  integrationStatus: ChannelIntegrationStatus;
  capabilities: ChannelCapabilities;

  /** Parse and normalize raw inbound webhook/event */
  receiveInbound(rawPayload: unknown): Promise<InboundPayload | null>;

  /** Send outbound message */
  sendOutbound(payload: OutboundPayload): Promise<SendResult>;

  /** Query or check delivery status */
  getDeliveryStatus(externalMessageId: string): Promise<MessageDeliveryStatus>;

  /** Mark message as read on provider side */
  markAsRead(externalMessageId: string): Promise<boolean>;

  /** Verify webhook signature */
  verifyWebhookSignature(headers: Record<string, string>, body: string): boolean;
}
