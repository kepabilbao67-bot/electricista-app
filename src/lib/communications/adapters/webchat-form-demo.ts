import { ChannelAdapter, InboundPayload, OutboundPayload, SendResult } from "./base-adapter";
import { MessageDeliveryStatus } from "../types";

export class WebChatDemoAdapter implements ChannelAdapter {
  channel = "webchat" as const;
  name = "WebChat Barymont Demo";
  integrationStatus = "DEMO" as const;
  capabilities = {
    supportsText: true,
    supportsRichText: true,
    supportsAttachments: true,
    supportsTemplates: false,
    supportsReadReceipts: true,
    supportsTypingIndicator: true,
    supportsVoice: false,
    supportsWebhooks: true,
  };

  async receiveInbound(rawPayload: any): Promise<InboundPayload | null> {
    if (!rawPayload || typeof rawPayload !== "object") return null;
    return {
      externalMessageId: rawPayload.id || `wc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      senderIdentifier: rawPayload.visitorId || rawPayload.email || "visitante-anonimo",
      senderName: rawPayload.visitorName || "Visitante Web",
      content: rawPayload.message || rawPayload.content || "",
      attachments: rawPayload.attachments || [],
      rawPayload,
      timestamp: rawPayload.timestamp || new Date().toISOString(),
    };
  }

  async sendOutbound(payload: OutboundPayload): Promise<SendResult> {
    // Pure local demo - no external network call
    return {
      success: true,
      externalMessageId: `wc-out-${Date.now()}`,
      status: "delivered",
      providerDetails: { simulatedChannel: "webchat", recipient: payload.recipientIdentifier },
    };
  }

  async getDeliveryStatus(_externalMessageId: string): Promise<MessageDeliveryStatus> {
    return "delivered";
  }

  async markAsRead(_externalMessageId: string): Promise<boolean> {
    return true;
  }

  verifyWebhookSignature(_headers: Record<string, string>, _body: string): boolean {
    return true; // Demo mock
  }
}

export class FormDemoAdapter implements ChannelAdapter {
  channel = "form" as const;
  name = "Formulario Web Barymont Demo";
  integrationStatus = "DEMO" as const;
  capabilities = {
    supportsText: true,
    supportsRichText: false,
    supportsAttachments: true,
    supportsTemplates: false,
    supportsReadReceipts: false,
    supportsTypingIndicator: false,
    supportsVoice: false,
    supportsWebhooks: true,
  };

  async receiveInbound(rawPayload: any): Promise<InboundPayload | null> {
    if (!rawPayload || typeof rawPayload !== "object") return null;
    const name = rawPayload.name || rawPayload.nombre || "Contacto Formulario";
    const email = rawPayload.email || "";
    const phone = rawPayload.phone || rawPayload.telefono || "";
    const interest = rawPayload.interest || rawPayload.servicio || "Consulta general";
    const comments = rawPayload.message || rawPayload.mensaje || rawPayload.comments || "";

    const content = `[FORMULARIO RECIBIDO]\nNombre: ${name}\nEmail: ${email}\nTeléfono: ${phone}\nInterés: ${interest}\n\nMensaje:\n${comments}`;

    return {
      externalMessageId: rawPayload.submissionId || `form-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      senderIdentifier: email || phone || `form-lead-${Date.now()}`,
      senderName: name,
      content,
      rawPayload,
      timestamp: new Date().toISOString(),
    };
  }

  async sendOutbound(_payload: OutboundPayload): Promise<SendResult> {
    // Forms are primarily inbound; auto-responder is delivered via email/sms
    return {
      success: true,
      externalMessageId: `form-ack-${Date.now()}`,
      status: "sent",
    };
  }

  async getDeliveryStatus(_externalMessageId: string): Promise<MessageDeliveryStatus> {
    return "sent";
  }

  async markAsRead(_externalMessageId: string): Promise<boolean> {
    return true;
  }

  verifyWebhookSignature(_headers: Record<string, string>, _body: string): boolean {
    return true;
  }
}
