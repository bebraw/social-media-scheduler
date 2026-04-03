import { describe, expect, it } from "vitest";
import { prepareXConnectionDraft } from "./x";
import { ProviderConnectionValidationError } from "./index";

describe("prepareXConnectionDraft", () => {
  it("validates the token and normalizes the saved handle from the authenticated user", async () => {
    await expect(
      prepareXConnectionDraft(
        {
          channel: "x",
          label: "Personal X",
          accountHandle: "temporary label",
          accessToken: "oauth2-token-value",
          refreshToken: "refresh-token-value",
        },
        {
          fetch: async (input, init) => {
            const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

            expect(url).toBe("https://api.x.com/2/users/me");
            expect(init?.method).toBe("GET");

            const headers = init?.headers instanceof Headers ? init.headers : new Headers(init?.headers);
            expect(headers.get("Authorization")).toBe("Bearer oauth2-token-value");

            return new Response(
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
            );
          },
        },
      ),
    ).resolves.toEqual({
      channel: "x",
      label: "Personal X",
      accountHandle: "@juho",
      accessToken: "oauth2-token-value",
      refreshToken: "refresh-token-value",
    });
  });

  it("surfaces a friendly validation failure", async () => {
    await expect(
      prepareXConnectionDraft(
        {
          channel: "x",
          label: "Personal X",
          accountHandle: "@juho",
          accessToken: "bad-token",
          refreshToken: "",
        },
        {
          fetch: async () =>
            new Response(
              JSON.stringify({
                title: "Unauthorized",
              }),
              {
                status: 401,
                headers: {
                  "content-type": "application/json",
                },
              },
            ),
        },
      ),
    ).rejects.toThrow(new ProviderConnectionValidationError("X token validation failed. Use a valid user-context access token."));
  });
});
