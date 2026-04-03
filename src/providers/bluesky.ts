import { AtpAgent } from "@atproto/api";
import { ProviderConnectionValidationError } from "./errors";
import type { ProviderAdapterContext, PreparedChannelConnectionDraft } from "./types";

export const BLUESKY_SERVICE_URL = "https://bsky.social";

export async function prepareBlueskyConnectionDraft(
  input: PreparedChannelConnectionDraft,
  context: ProviderAdapterContext = {},
): Promise<PreparedChannelConnectionDraft> {
  if (input.refreshToken) {
    throw new ProviderConnectionValidationError("Bluesky connections use a handle and app password. Leave the refresh token blank.");
  }

  const agent = new AtpAgent({
    service: BLUESKY_SERVICE_URL,
    fetch: context.fetch,
  });

  try {
    await agent.login({
      identifier: input.accountHandle,
      password: input.accessToken,
    });
  } catch {
    throw new ProviderConnectionValidationError("Bluesky sign-in failed. Check the handle and app password.");
  }

  const session = agent.session;
  if (!session?.accessJwt || !session.refreshJwt || !session.handle) {
    throw new Error("Bluesky login did not return a complete session.");
  }

  return {
    ...input,
    accountHandle: session.handle,
    accessToken: session.accessJwt,
    refreshToken: session.refreshJwt,
  };
}
