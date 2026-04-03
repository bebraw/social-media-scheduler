import { RestliClient } from "linkedin-api-client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProviderConnectionValidationError } from "./index";
import { prepareLinkedInConnectionDraft } from "./linkedin";

describe("prepareLinkedInConnectionDraft", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("validates the token and normalizes the saved member identifier from the profile", async () => {
    vi.spyOn(RestliClient.prototype, "get").mockResolvedValue({
      data: {
        id: "abc123",
        localizedFirstName: "Example",
        localizedLastName: "Member",
      },
    } as unknown as Awaited<ReturnType<RestliClient["get"]>>);

    await expect(
      prepareLinkedInConnectionDraft({
        channel: "linkedin",
        label: "Company LinkedIn",
        accountHandle: "temporary value",
        accessToken: "member-access-token",
        refreshToken: "refresh-token-value",
      }),
    ).resolves.toEqual({
      channel: "linkedin",
      label: "Company LinkedIn",
      accountHandle: "Example Member (abc123)",
      accessToken: "member-access-token",
      refreshToken: "refresh-token-value",
    });
  });

  it("surfaces a friendly validation failure", async () => {
    vi.spyOn(RestliClient.prototype, "get").mockRejectedValue(new Error("Unauthorized"));

    await expect(
      prepareLinkedInConnectionDraft({
        channel: "linkedin",
        label: "Company LinkedIn",
        accountHandle: "temporary value",
        accessToken: "bad-token",
        refreshToken: "",
      }),
    ).rejects.toThrow(new ProviderConnectionValidationError("LinkedIn token validation failed. Use a valid member access token."));
  });
});
