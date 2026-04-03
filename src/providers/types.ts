import type { QueueChannel } from "../queue/constraints";

export interface PreparedChannelConnectionDraft {
  accessToken: string;
  accountHandle: string;
  channel: QueueChannel;
  label: string;
  refreshToken: string;
}

export interface ProviderAdapterContext {
  fetch?: typeof globalThis.fetch;
}

export interface SocialProviderAdapter {
  prepareConnectionDraft(input: PreparedChannelConnectionDraft, context?: ProviderAdapterContext): Promise<PreparedChannelConnectionDraft>;
}
