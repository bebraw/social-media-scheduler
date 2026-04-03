import { describe, expect, it, vi } from "vitest";
import { prepareBlueskyConnectionDraft } from "./bluesky";
import { ProviderConnectionValidationError } from "./index";

describe("prepareBlueskyConnectionDraft", () => {
  it("logs into Bluesky and replaces the app password with session tokens", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === "https://bsky.social/xrpc/com.atproto.server.createSession") {
        const body = init?.body instanceof Uint8Array ? new TextDecoder().decode(init.body) : String(init?.body || "");

        expect(init?.method).toBe("post");
        expect(JSON.parse(body)).toEqual({
          identifier: "juho.bsky.social",
          password: "app-password-value",
        });

        return new Response(
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
        );
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    await expect(
      prepareBlueskyConnectionDraft(
        {
          channel: "bluesky",
          label: "Personal Bluesky",
          accountHandle: "juho.bsky.social",
          accessToken: "app-password-value",
          refreshToken: "",
        },
        { fetch },
      ),
    ).resolves.toEqual({
      channel: "bluesky",
      label: "Personal Bluesky",
      accountHandle: "juho.bsky.social",
      accessToken: "access-jwt-value",
      refreshToken: "refresh-jwt-value",
    });
  });

  it("rejects manual refresh-token input", async () => {
    await expect(
      prepareBlueskyConnectionDraft({
        channel: "bluesky",
        label: "Personal Bluesky",
        accountHandle: "juho.bsky.social",
        accessToken: "app-password-value",
        refreshToken: "manual-refresh-token",
      }),
    ).rejects.toThrow(
      new ProviderConnectionValidationError("Bluesky connections use a handle and app password. Leave the refresh token blank."),
    );
  });

  it("surfaces a friendly login failure", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () =>
        new Response(JSON.stringify({ error: "AuthMissing", message: "Bad credentials" }), {
          status: 401,
          headers: {
            "content-type": "application/json",
          },
        }),
    );

    await expect(
      prepareBlueskyConnectionDraft(
        {
          channel: "bluesky",
          label: "Personal Bluesky",
          accountHandle: "juho.bsky.social",
          accessToken: "wrong-password",
          refreshToken: "",
        },
        { fetch },
      ),
    ).rejects.toThrow(new ProviderConnectionValidationError("Bluesky sign-in failed. Check the handle and app password."));
  });
});
