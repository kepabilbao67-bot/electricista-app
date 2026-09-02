import { ChannelAdapter, InboundPayload, OutboundPayload, SendResult } from "./base-adapter";
import { MessageDeliveryStatus } from "../types";

export class EmailDemoAdapter implements ChannelAdapter {
  channel = "email" as const;
  name = "Email Barymont Demo";
  integrationStatus = "DEMO" as const;
  capabilities = {
    supportsText: true,
    supportsRichText: true,
    supportsAttachments: true,
    supportsTemplates: true,
    supportsReadReceipts: false,
    supportsTypingIndicator: false,
    supportsVoice: false,
    supportsWebhooks: true,
  };

  async receiveInbound(rawPayload: any): Promise<InboundPayload | null> {
    if (!rawPayload || typeof rawPayload !== "object") return null;
    return {
      externalMessageId: rawPayload.messageId || `<email-${Date.now()}@barymont.demo>`,
      senderIdentifier: rawPayload.from || rawPayload.senderEmail || "cliente@ejemplo.com",
      senderName: rawPayload.fromName || "Remitente Email",
      content: rawPayload.textBody || rawPayload.htmlBody || rawPayload.content || "",
      attachments: rawPayload.attachments || [],
      rawPayload,
      timestamp: rawPayload.date || new Date().toISOString(),
    };
  }

  async sendOutbound(payload: OutboundPayload): Promise<SendResult> {
    // Simulated RFC 2822 email delivery
    return {
      success: true,
      externalMessageId: `<msg-out-${Date.now()}@barymont.demo>`,
      status: "delivered",
      providerDetails: {
        to: payload.recipientIdentifier,
        inReplyTo: payload.inReplyToExternalId || null,
        simulatedHeaders: { "X-Barymont-Channel": "email-demo" },
      },
    };
  }

  async getDeliveryStatus(_externalMessageId: string): Promise<MessageDeliveryStatus> {
    return "delivered";
  }

  async markAsRead(_externalMessageId: string): Promise<boolean> {
    return true;
  }

  verifyWebhookSignature(_headers: Record<string, string>, _body: string): boolean {
    return true;
  }
}

export class WhatsAppDemoAdapter implements ChannelAdapter {
  channel = "whatsapp" as const;
  name = "WhatsApp Cloud API Demo (Meta Oficial)";
  integrationStatus = "DEMO" as const;
  capabilities = {
    supportsText: true,
    supportsRichText: false,
    supportsAttachments: true,
    supportsTemplates: true,
    supportsReadReceipts: true,
    supportsTypingIndicator: false,
    supportsVoice: true,
    supportsWebhooks: true,
  };

  async receiveInbound(rawPayload: any): Promise<InboundPayload | null> {
    // Matches Meta WhatsApp Cloud API standard webhook structure
    if (!rawPayload) return null;
    const entry = rawPayload?.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const message = change?.messages?.[0];
    const contact = change?.contacts?.[0];

    if (message) {
      return {
        externalMessageId: message.id || `wamid-${Date.now()}`,
        senderIdentifier: message.from || contact?.wa_id || "34600000000",
        senderName: contact?.profile?.name || "Contacto WhatsApp",
        content: message.text?.body || message.caption || (message.type === "image" ? "[Imagen adjunta]" : "[Mensaje multimedia]"),
        rawPayload,
        timestamp: message.timestamp ? new Date(Number(message.timestamp) * 1000).toISOString() : new Date().toISOString(),
      };
    }

    // Direct mock format fallback
    if (rawPayload.phone || rawPayload.from) {
      return {
        externalMessageId: rawPayload.id || `wamid-${Date.now()}`,
        senderIdentifier: rawPayload.phone || rawPayload.from,
        senderName: rawPayload.name || "Contacto WhatsApp",
        content: rawPayload.message || rawPayload.text || "",
        rawPayload,
        timestamp: new Date().toISOString(),
      };
    }

    return null;
  }

  async sendOutbound(payload: OutboundPayload): Promise<SendResult> {
    return {
      success: true,
      externalMessageId: `wamid.HBgL${Date.now()}`,
      status: "delivered",
      providerDetails: {
        recipient: payload.recipientIdentifier,
        template: payload.templateId || null,
        officialApi: "Meta Cloud API (Simulada Demo)",
      },
    };
  }

  async getDeliveryStatus(_externalMessageId: string): Promise<MessageDeliveryStatus> {
    return "read";
  }

  async markAsRead(_externalMessageId: string): Promise<boolean> {
    return true;
  }

  verifyWebhookSignature(_headers: Record<string, string>, _body: string): boolean {
    return true;
  }
}

export class SmsDemoAdapter implements ChannelAdapter {
  channel = "sms" as const;
  name = "SMS Directo Barymont Demo";
  integrationStatus = "DEMO" as const;
  capabilities = {
    supportsText: true,
    supportsRichText: false,
    supportsAttachments: false,
    supportsTemplates: true,
    supportsReadReceipts: true,
    supportsTypingIndicator: false,
    supportsVoice: false,
    supportsWebhooks: true,
  };

  async receiveInbound(rawPayload: any): Promise<InboundPayload | null> {
    if (!rawPayload) return null;
    return {
      externalMessageId: rawPayload.messageSid || `sms-${Date.now()}`,
      senderIdentifier: rawPayload.from || rawPayload.phone || "34600000000",
      senderName: rawPayload.senderName || "Usuario SMS",
      content: rawPayload.body || rawPayload.text || "",
      rawPayload,
      timestamp: new Date().toISOString(),
    };
  }

  async sendOutbound(payload: OutboundPayload): Promise<SendResult> {
    return {
      success: true,
      externalMessageId: `SM${Date.now()}`,
      status: "delivered",
    };
  }

  async getDeliveryStatus(_externalMessageId: string): Promise<MessageDeliveryStatus> {
    return "delivered";
  }

  async markAsRead(_externalMessageId: string): Promise<boolean> {
    return true;
  }

  verifyWebhookSignature(_headers: Record<string, string>, _body: string): boolean {
    return true;
  }
}

export class PhoneDemoAdapter implements ChannelAdapter {
  channel = "phone" as const;
  name = "Telefonía Comercial Pedro Barymont Demo";
  integrationStatus = "DEMO" as const;
  capabilities = {
    supportsText: false,
    supportsRichText: false,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsReadReceipts: false,
    supportsTypingIndicator: false,
    supportsVoice: true,
    supportsWebhooks: true,
  };

  async receiveInbound(rawPayload: any): Promise<InboundPayload | null> {
    if (!rawPayload) return null;
    const caller = rawPayload.caller || rawPayload.from || "34600000000";
    const duration = rawPayload.duration || 0;
    const summary = rawPayload.summary || "Llamada telefónica registrada";
    return {
      externalMessageId: rawPayload.callId || `call-${Date.now()}`,
      senderIdentifier: caller,
      senderName: rawPayload.callerName || "Llamante",
      content: `[LLAMADA DE VOZ REGISTRADA]\nDuración: ${duration}s\nResumen: ${summary}`,
      rawPayload,
      timestamp: new Date().toISOString(),
    };
  }

  async sendOutbound(_payload: OutboundPayload): Promise<SendResult> {
    return {
      success: true,
      externalMessageId: `call-out-${Date.now()}`,
      status: "delivered",
    };
  }

  async getDeliveryStatus(_externalMessageId: string): Promise<MessageDeliveryStatus> {
    return "delivered";
  }

  async markAsRead(_externalMessageId: string): Promise<boolean> {
    return true;
  }

  verifyWebhookSignature(_headers: Record<string, string>, _body: string): boolean {
    return true;
  }
}

export class TelegramDemoAdapter implements ChannelAdapter {
  channel = "telegram" as const;
  name = "Telegram Bot Barymont Demo";
  integrationStatus = "DEMO" as const;
  capabilities = {
    supportsText: true,
    supportsRichText: true,
    supportsAttachments: true,
    supportsTemplates: false,
    supportsReadReceipts: false,
    supportsTypingIndicator: true,
    supportsVoice: true,
    supportsWebhooks: true,
  };

  async receiveInbound(rawPayload: any): Promise<InboundPayload | null> {
    if (!rawPayload) return null;
    const msg = rawPayload.message || rawPayload;
    const from = msg.from || {};
    return {
      externalMessageId: String(msg.message_id || `tg-${Date.now()}`),
      senderIdentifier: String(from.id || from.username || "tg-user"),
      senderName: `${from.first_name || ""} ${from.last_name || ""}`.trim() || from.username || "Usuario Telegram",
      content: msg.text || msg.caption || "[Mensaje Telegram]",
      rawPayload,
      timestamp: new Date().toISOString(),
    };
  }

  async sendOutbound(payload: OutboundPayload): Promise<SendResult> {
    return {
      success: true,
      externalMessageId: `tg-out-${Date.now()}`,
      status: "delivered",
    };
  }

  async getDeliveryStatus(_externalMessageId: string): Promise<MessageDeliveryStatus> {
    return "delivered";
  }

  async markAsRead(_externalMessageId: string): Promise<boolean> {
    return true;
  }

  verifyWebhookSignature(_headers: Record<string, string>, _body: string): boolean {
    return true;
  }
}

export class InstagramDemoAdapter implements ChannelAdapter {
  channel = "instagram" as const;
  name = "Instagram Direct Barymont Demo";
  integrationStatus = "DEMO" as const;
  capabilities = {
    supportsText: true,
    supportsRichText: false,
    supportsAttachments: true,
    supportsTemplates: false,
    supportsReadReceipts: true,
    supportsTypingIndicator: false,
    supportsVoice: false,
    supportsWebhooks: true,
  };

  async receiveInbound(rawPayload: any): Promise<InboundPayload | null> {
    if (!rawPayload) return null;
    return {
      externalMessageId: rawPayload.mid || `ig-${Date.now()}`,
      senderIdentifier: rawPayload.sender_id || rawPayload.username || "ig-user",
      senderName: rawPayload.username ? `@${rawPayload.username}` : "Usuario Instagram",
      content: rawPayload.text || "[Mensaje Directo]",
      rawPayload,
      timestamp: new Date().toISOString(),
    };
  }

  async sendOutbound(payload: OutboundPayload): Promise<SendResult> {
    return {
      success: true,
      externalMessageId: `ig-out-${Date.now()}`,
      status: "delivered",
    };
  }

  async getDeliveryStatus(_externalMessageId: string): Promise<MessageDeliveryStatus> {
    return "delivered";
  }

  async markAsRead(_externalMessageId: string): Promise<boolean> {
    return true;
  }

  verifyWebhookSignature(_headers: Record<string, string>, _body: string): boolean {
    return true;
  }
}
