import { afterEach, describe, expect, it, vi } from "vitest";

const mockResumeSession = vi.fn();
const mockBlueskyPost = vi.fn();
const mockXCreatePost = vi.fn();
const mockLinkedInGet = vi.fn();
const mockLinkedInCreate = vi.fn();

vi.mock("@atproto/api", () => ({
  AtpAgent: class {
    post = mockBlueskyPost;
    resumeSession = mockResumeSession;
  },
}));

vi.mock("@xdevplatform/xdk", () => ({
  Client: class {
    posts = {
      create: mockXCreatePost,
    };
  },
}));

vi.mock("linkedin-api-client", () => ({
  RestliClient: class {
    create = mockLinkedInCreate;
    get = mockLinkedInGet;
  },
}));

import type { PublishingChannelConnection } from "../channels";
import { publishChannelPost } from "./publish";

const baseConnection: PublishingChannelConnection = {
  accessTokenSecretKey: "secret:access",
  accountHandle: "@scheduler-admin",
  channel: "bluesky",
  createdAt: "2026-04-08T10:00:00.000Z",
  hasRefreshToken: true,
  id: "connection-1",
  label: "Scheduler Admin",
  refreshTokenSecretKey: "secret:refresh",
  updatedAt: "2026-04-08T10:00:00.000Z",
};

describe("publishChannelPost", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("publishes to Bluesky with a resumed session", async () => {
    mockBlueskyPost.mockResolvedValue({
      uri: "at://did:plc:example/app.bsky.feed.post/123",
    });

    await expect(
      publishChannelPost({
        accessToken: buildJwt({ sub: "did:plc:example" }),
        body: "Ship the queued Bluesky post.",
        channel: "bluesky",
        connection: baseConnection,
        refreshToken: "refresh-token",
      }),
    ).resolves.toBe("Published to Bluesky (at://did:plc:example/app.bsky.feed.post/123)");

    expect(mockResumeSession).toHaveBeenCalledWith({
      accessJwt: buildJwt({ sub: "did:plc:example" }),
      active: true,
      did: "did:plc:example",
      handle: "@scheduler-admin",
      refreshJwt: "refresh-token",
    });
    expect(mockBlueskyPost).toHaveBeenCalledWith({
      text: "Ship the queued Bluesky post.",
    });
  });

  it("rejects Bluesky publishing when the refresh token is missing", async () => {
    await expect(
      publishChannelPost({
        accessToken: buildJwt({ sub: "did:plc:example" }),
        body: "Ship the queued Bluesky post.",
        channel: "bluesky",
        connection: baseConnection,
      }),
    ).rejects.toThrow("Bluesky publishing requires a saved refresh token.");
  });

  it("rejects Bluesky publishing when the access token cannot provide a DID", async () => {
    await expect(
      publishChannelPost({
        accessToken: "not-a-jwt",
        body: "Ship the queued Bluesky post.",
        channel: "bluesky",
        connection: baseConnection,
        refreshToken: "refresh-token",
      }),
    ).rejects.toThrow("The saved Bluesky session is missing a valid DID.");
  });

  it("publishes to X and returns the created post id", async () => {
    mockXCreatePost.mockResolvedValue({
      data: {
        id: "tweet-123",
      },
    });

    await expect(
      publishChannelPost({
        accessToken: "x-access-token",
        body: "Ship the queued X post.",
        channel: "x",
        connection: {
          ...baseConnection,
          accountHandle: "@scheduler-x",
          channel: "x",
        },
      }),
    ).resolves.toBe("Published to X (tweet-123)");
  });

  it("falls back to generic success messages when provider ids are unavailable", async () => {
    mockBlueskyPost.mockResolvedValue({});
    mockXCreatePost.mockResolvedValue({
      data: {},
    });
    mockLinkedInGet.mockResolvedValue({
      data: {
        id: "member-123",
      },
    });
    mockLinkedInCreate.mockResolvedValue({});

    await expect(
      publishChannelPost({
        accessToken: buildJwt({ sub: "did:plc:example" }),
        body: "Ship the queued Bluesky post.",
        channel: "bluesky",
        connection: baseConnection,
        refreshToken: "refresh-token",
      }),
    ).resolves.toBe("Published to Bluesky");

    await expect(
      publishChannelPost({
        accessToken: "x-access-token",
        body: "Ship the queued X post.",
        channel: "x",
        connection: {
          ...baseConnection,
          accountHandle: "@scheduler-x",
          channel: "x",
        },
      }),
    ).resolves.toBe("Published to X");

    await expect(
      publishChannelPost({
        accessToken: "linkedin-access-token",
        body: "Ship the queued LinkedIn post.",
        channel: "linkedin",
        connection: {
          ...baseConnection,
          channel: "linkedin",
        },
      }),
    ).resolves.toBe("Published to LinkedIn");
  });

  it("publishes to LinkedIn and returns the created entity id", async () => {
    mockLinkedInGet.mockResolvedValue({
      data: {
        id: "member-123",
      },
    });
    mockLinkedInCreate.mockResolvedValue({
      createdEntityId: "urn:li:share:123",
    });

    await expect(
      publishChannelPost({
        accessToken: "linkedin-access-token",
        body: "Ship the queued LinkedIn post.",
        channel: "linkedin",
        connection: {
          ...baseConnection,
          accountHandle: "Member 123",
          channel: "linkedin",
        },
      }),
    ).resolves.toBe("Published to LinkedIn (urn:li:share:123)");

    expect(mockLinkedInGet).toHaveBeenCalledWith({
      accessToken: "linkedin-access-token",
      queryParams: {
        fields: "id",
      },
      resourcePath: "/me",
      versionString: "202603",
    });
    expect(mockLinkedInCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "linkedin-access-token",
        resourcePath: "/posts",
        versionString: "202603",
      }),
    );
  });

  it("rejects LinkedIn publishing when the profile lookup does not return a member id", async () => {
    mockLinkedInGet.mockResolvedValue({
      data: {},
    });

    await expect(
      publishChannelPost({
        accessToken: "linkedin-access-token",
        body: "Ship the queued LinkedIn post.",
        channel: "linkedin",
        connection: {
          ...baseConnection,
          channel: "linkedin",
        },
      }),
    ).rejects.toThrow("LinkedIn publishing could not resolve the authenticated member id.");
  });
});

function buildJwt(payload: Record<string, string>): string {
  return `header.${encodeBase64Url(JSON.stringify(payload))}.signature`;
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}
