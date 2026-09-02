import { ChannelType, ChannelIntegrationStatus } from "../types";
import { ChannelAdapter } from "./base-adapter";
import { WebChatDemoAdapter, FormDemoAdapter } from "./webchat-form-demo";
import {
  EmailDemoAdapter,
  WhatsAppDemoAdapter,
  SmsDemoAdapter,
  PhoneDemoAdapter,
  TelegramDemoAdapter,
  InstagramDemoAdapter,
} from "./omni-demo-adapters";

class AdapterRegistry {
  private adapters: Map<ChannelType, ChannelAdapter> = new Map();

  constructor() {
    this.register(new WebChatDemoAdapter());
    this.register(new FormDemoAdapter());
    this.register(new EmailDemoAdapter());
    this.register(new WhatsAppDemoAdapter());
    this.register(new SmsDemoAdapter());
    this.register(new PhoneDemoAdapter());
    this.register(new TelegramDemoAdapter());
    this.register(new InstagramDemoAdapter());
  }

  register(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.channel, adapter);
  }

  get(channel: ChannelType): ChannelAdapter | undefined {
    return this.adapters.get(channel);
  }

  getAll(): ChannelAdapter[] {
    return Array.from(this.adapters.values());
  }

  getStatusMap(): Record<ChannelType, { name: string; status: ChannelIntegrationStatus }> {
    const map: Partial<Record<ChannelType, { name: string; status: ChannelIntegrationStatus }>> = {};
    for (const [ch, adapter] of this.adapters.entries()) {
      map[ch] = {
        name: adapter.name,
        status: adapter.integrationStatus,
      };
    }
    return map as Record<ChannelType, { name: string; status: ChannelIntegrationStatus }>;
  }
}

export const adapterRegistry = new AdapterRegistry();
