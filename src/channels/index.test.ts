import { describe, expect, it } from "vitest";
import { createTestDatabase, createTestEnv } from "../test-support";
import { loadEncryptedSecret } from "../secrets";
import { buildAccessTokenSecretKey, buildRefreshTokenSecretKey, createChannelConnection, loadChannelConnections } from "./index";

describe("channel connections", () => {
  it("creates a channel connection and encrypts its credentials", async () => {
    const db = createTestDatabase();

    const connection = await createChannelConnection(
      db,
      createTestEnv({
        APP_ENCRYPTION_SECRET: "dedicated-secret",
      }),
      {
        channel: "x",
        label: "Personal X",
        accountHandle: "@juho",
        accessToken: "access-token-value",
        refreshToken: "refresh-token-value",
      },
    );

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

    await createChannelConnection(db, env, {
      channel: "x",
      label: "Personal X",
      accountHandle: "@juho",
      accessToken: "access-token-value",
      refreshToken: "",
    });

    await expect(
      createChannelConnection(db, env, {
        channel: "x",
        label: "Duplicate X",
        accountHandle: "@Juho",
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
});
