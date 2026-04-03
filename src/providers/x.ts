import { Client } from "@xdevplatform/xdk";
import { ProviderConnectionValidationError } from "./errors";
import type { PreparedChannelConnectionDraft, ProviderAdapterContext } from "./types";

export async function prepareXConnectionDraft(
  input: PreparedChannelConnectionDraft,
  context: ProviderAdapterContext = {},
): Promise<PreparedChannelConnectionDraft> {
  const client = new Client({
    accessToken: input.accessToken,
  });
  const runtimeHttpClient = client.httpClient as unknown as { fetch: typeof globalThis.fetch };
  runtimeHttpClient.fetch = (context.fetch ?? globalThis.fetch).bind(globalThis);

  let response: { data?: { id?: string; username?: string } };

  try {
    response = await client.users.getMe();
  } catch {
    throw new ProviderConnectionValidationError("X token validation failed. Use a valid user-context access token.");
  }

  const username = response.data?.username?.trim();
  if (!username) {
    throw new Error("X token validation did not return a username.");
  }

  return {
    ...input,
    accountHandle: normalizeXHandle(username),
  };
}

function normalizeXHandle(username: string): string {
  return username.startsWith("@") ? username : `@${username}`;
}
