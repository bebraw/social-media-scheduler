import { RestliClient } from "linkedin-api-client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestDatabase, createTestEnv } from "../test-support";
import { loadEncryptedSecret } from "../secrets";
import {
  buildAccessTokenSecretKey,
  buildRefreshTokenSecretKey,
  createChannelConnection,
  getChannelConnection,
  listConfiguredProviders,
  listPublishingChannelConnections,
  loadChannelConnections,
  normalizeChannelConnectionDraft,
} from "./index";

describe("channel connections", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a channel connection and encrypts its credentials", async () => {
    const db = createTestDatabase();
    vi.spyOn(RestliClient.prototype, "get").mockResolvedValue({
      data: {
        id: "abc123",
        localizedFirstName: "Example",
        localizedLastName: "Member",
      },
    } as unknown as Awaited<ReturnType<RestliClient["get"]>>);

    const connection = await createChannelConnection(
      db,
      createTestEnv({
        APP_ENCRYPTION_SECRET: "dedicated-secret",
      }),
      {
        channel: "linkedin",
        label: "Company LinkedIn",
        accountHandle: "Example Company",
        accessToken: "access-token-value",
        refreshToken: "refresh-token-value",
      },
    );

    expect(connection.accountHandle).toBe("Example Member (abc123)");
    await expect(loadChannelConnections(db)).resolves.toEqual([connection]);
    await expect(loadEncryptedSecret(db, buildAccessTokenSecretKey(connection.id), "dedicated-secret")).resolves.toBe("access-token-value");
    await expect(loadEncryptedSecret(db, buildRefreshTokenSecretKey(connection.id), "dedicated-secret")).resolves.toBe(
      "refresh-token-value",
    );
  });

  it("rejects duplicate channel and account pairs", async () => {
    const db = createTestDatabase();
    const env = createTestEnv({
      APP_ENCRYPTION_SECRET: "dedicated-secret",
    });
    vi.spyOn(RestliClient.prototype, "get").mockResolvedValue({
      data: {
        id: "abc123",
        localizedFirstName: "Example",
        localizedLastName: "Member",
      },
    } as unknown as Awaited<ReturnType<RestliClient["get"]>>);

    await createChannelConnection(db, env, {
      channel: "linkedin",
      label: "Company LinkedIn",
      accountHandle: "Example Company",
      accessToken: "access-token-value",
      refreshToken: "",
    });

    await expect(
      createChannelConnection(db, env, {
        channel: "linkedin",
        label: "Duplicate LinkedIn",
        accountHandle: "example company",
        accessToken: "another-token",
        refreshToken: "",
      }),
    ).rejects.toThrow("already connected");
  });

  it("stores Bluesky session tokens instead of the submitted app password", async () => {
    const db = createTestDatabase();

    const connection = await createChannelConnection(
      db,
      createTestEnv({
        APP_ENCRYPTION_SECRET: "dedicated-secret",
      }),
      {
        channel: "bluesky",
        label: "Personal Bluesky",
        accountHandle: "juho.bsky.social",
        accessToken: "app-password-value",
        refreshToken: "",
      },
      {
        fetch: async () =>
          new Response(
            JSON.stringify({
              accessJwt: "access-jwt-value",
              refreshJwt: "refresh-jwt-value",
              handle: "juho.bsky.social",
              did: "did:plc:juho123",
              active: true,
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json",
              },
            },
          ),
      },
    );

    expect(connection).toMatchObject({
      channel: "bluesky",
      accountHandle: "juho.bsky.social",
      hasRefreshToken: true,
    });
    await expect(loadEncryptedSecret(db, buildAccessTokenSecretKey(connection.id), "dedicated-secret")).resolves.toBe("access-jwt-value");
    await expect(loadEncryptedSecret(db, buildRefreshTokenSecretKey(connection.id), "dedicated-secret")).resolves.toBe("refresh-jwt-value");
  });

  it("normalizes the saved X handle from the validated token", async () => {
    const db = createTestDatabase();

    const connection = await createChannelConnection(
      db,
      createTestEnv({
        APP_ENCRYPTION_SECRET: "dedicated-secret",
      }),
      {
        channel: "x",
        label: "Personal X",
        accountHandle: "temporary value",
        accessToken: "oauth2-token-value",
        refreshToken: "refresh-token-value",
      },
      {
        fetch: async () =>
          new Response(
            JSON.stringify({
              data: {
                id: "123",
                username: "juho",
              },
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json",
              },
            },
          ),
      },
    );

    expect(connection).toMatchObject({
      channel: "x",
      accountHandle: "@juho",
      hasRefreshToken: true,
    });
    await expect(loadEncryptedSecret(db, buildAccessTokenSecretKey(connection.id), "dedicated-secret")).resolves.toBe("oauth2-token-value");
    await expect(loadEncryptedSecret(db, buildRefreshTokenSecretKey(connection.id), "dedicated-secret")).resolves.toBe(
      "refresh-token-value",
    );
  });

  it("loads one connection by id and includes publishing metadata for scheduled runs", async () => {
    const db = createTestDatabase();
    vi.spyOn(RestliClient.prototype, "get").mockResolvedValue({
      data: {
        id: "abc123",
        localizedFirstName: "Example",
        localizedLastName: "Member",
      },
    } as unknown as Awaited<ReturnType<RestliClient["get"]>>);

    const connection = await createChannelConnection(
      db,
      createTestEnv({
        APP_ENCRYPTION_SECRET: "dedicated-secret",
      }),
      {
        channel: "linkedin",
        label: "Company LinkedIn",
        accountHandle: "Example Company",
        accessToken: "access-token-value",
        refreshToken: "",
      },
    );

    await expect(getChannelConnection(db, connection.id)).resolves.toEqual(connection);
    await expect(getChannelConnection(db, "missing-id")).resolves.toBeNull();
    await expect(listPublishingChannelConnections(db)).resolves.toEqual([
      expect.objectContaining({
        accessTokenSecretKey: buildAccessTokenSecretKey(connection.id),
        hasRefreshToken: false,
        id: connection.id,
        refreshTokenSecretKey: null,
      }),
    ]);
    expect(listConfiguredProviders([connection, { ...connection, id: "two", channel: "x" }])).toEqual(["linkedin", "x"]);
  });

  it("rejects incomplete connection drafts before hitting a provider adapter", () => {
    expect(() =>
      normalizeChannelConnectionDraft({
        channel: "mastodon",
        label: "",
        accountHandle: "",
        accessToken: "",
        refreshToken: "",
      }),
    ).toThrow("Choose a supported channel for the connection.");

    expect(() =>
      normalizeChannelConnectionDraft({
        channel: "linkedin",
        label: "",
        accountHandle: "Example Company",
        accessToken: "token",
        refreshToken: "",
      }),
    ).toThrow("Add a label so this connection is easy to identify later.");

    expect(() =>
      normalizeChannelConnectionDraft({
        channel: "linkedin",
        label: "Company LinkedIn",
        accountHandle: "",
        accessToken: "token",
        refreshToken: "",
      }),
    ).toThrow("Add a handle or profile label for the connected account.");

    expect(() =>
      normalizeChannelConnectionDraft({
        channel: "linkedin",
        label: "Company LinkedIn",
        accountHandle: "Example Company",
        accessToken: "",
        refreshToken: "",
      }),
    ).toThrow("Add an access token before saving the channel connection.");
  });
});
