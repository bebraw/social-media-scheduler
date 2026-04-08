import { AtpAgent } from "@atproto/api";
import { RestliClient } from "linkedin-api-client";
import { Client } from "@xdevplatform/xdk";
import type { PublishingChannelConnection } from "../channels";
import type { QueueChannel } from "../queue/constraints";
import { BLUESKY_SERVICE_URL } from "./bluesky";

const LINKEDIN_VERSION = "202603";

export async function publishChannelPost(input: {
  accessToken: string;
  body: string;
  channel: QueueChannel;
  connection: PublishingChannelConnection;
  refreshToken?: string | null;
}): Promise<string> {
  switch (input.channel) {
    case "bluesky":
      return await publishBlueskyPost(input);
    case "x":
      return await publishXPost(input);
    case "linkedin":
      return await publishLinkedInPost(input);
  }
}

async function publishBlueskyPost(input: {
  accessToken: string;
  body: string;
  connection: PublishingChannelConnection;
  refreshToken?: string | null;
}): Promise<string> {
  if (!input.refreshToken) {
    throw new Error("Bluesky publishing requires a saved refresh token.");
  }

  const did = decodeDidFromJwt(input.accessToken);
  if (!did) {
    throw new Error("The saved Bluesky session is missing a valid DID.");
  }

  const agent = new AtpAgent({
    service: BLUESKY_SERVICE_URL,
  });
  await agent.resumeSession({
    accessJwt: input.accessToken,
    active: true,
    did,
    handle: input.connection.accountHandle,
    refreshJwt: input.refreshToken,
  });

  const response = await agent.post({
    text: input.body,
  });

  return response.uri ? `Published to Bluesky (${response.uri})` : "Published to Bluesky";
}

async function publishXPost(input: { accessToken: string; body: string }): Promise<string> {
  const client = new Client({
    accessToken: input.accessToken,
  });
  const response = await client.posts.create({
    text: input.body,
  });

  const postId = response.data?.id;
  return typeof postId === "string" && postId.length > 0 ? `Published to X (${postId})` : "Published to X";
}

async function publishLinkedInPost(input: { accessToken: string; body: string }): Promise<string> {
  const client = new RestliClient();
  const profileResponse = await client.get({
    accessToken: input.accessToken,
    queryParams: {
      fields: "id",
    },
    resourcePath: "/me",
    versionString: LINKEDIN_VERSION,
  });

  const memberId = String((profileResponse.data as { id?: string } | undefined)?.id || "").trim();
  if (!memberId) {
    throw new Error("LinkedIn publishing could not resolve the authenticated member id.");
  }

  const response = await client.create({
    accessToken: input.accessToken,
    entity: {
      author: `urn:li:person:${memberId}`,
      commentary: input.body,
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      isReshareDisabledByAuthor: false,
      lifecycleState: "PUBLISHED",
      visibility: "PUBLIC",
    },
    resourcePath: "/posts",
    versionString: LINKEDIN_VERSION,
  });

  return response.createdEntityId ? `Published to LinkedIn (${response.createdEntityId})` : "Published to LinkedIn";
}

function decodeDidFromJwt(token: string): string | null {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(parts[1] || ""));
    return typeof payload.sub === "string" && payload.sub.startsWith("did:") ? payload.sub : null;
  } catch {
    return null;
  }
}

function decodeBase64Url(value: string): string {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  return atob(padded);
}
