import { prepareBlueskyConnectionDraft } from "./bluesky";
import type { ProviderAdapterContext, PreparedChannelConnectionDraft, SocialProviderAdapter } from "./types";

const adapters: Partial<Record<PreparedChannelConnectionDraft["channel"], SocialProviderAdapter>> = {
  bluesky: {
    prepareConnectionDraft: prepareBlueskyConnectionDraft,
  },
};

export async function prepareChannelConnectionDraft(
  input: PreparedChannelConnectionDraft,
  context: ProviderAdapterContext = {},
): Promise<PreparedChannelConnectionDraft> {
  const adapter = adapters[input.channel];
  if (!adapter) {
    return input;
  }

  return await adapter.prepareConnectionDraft(input, context);
}

export { ProviderConnectionValidationError } from "./errors";
export type { ProviderAdapterContext, PreparedChannelConnectionDraft, SocialProviderAdapter } from "./types";
