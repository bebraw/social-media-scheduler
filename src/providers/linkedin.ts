import { RestliClient } from "linkedin-api-client";
import { ProviderConnectionValidationError } from "./errors";
import type { PreparedChannelConnectionDraft, ProviderAdapterContext } from "./types";

interface LinkedInProfileResponse {
  firstName?: string | { localized?: Record<string, string> };
  id?: string;
  lastName?: string | { localized?: Record<string, string> };
  localizedFirstName?: string;
  localizedLastName?: string;
}

export async function prepareLinkedInConnectionDraft(
  input: PreparedChannelConnectionDraft,
  _context: ProviderAdapterContext = {},
): Promise<PreparedChannelConnectionDraft> {
  const client = new RestliClient();

  let profile: LinkedInProfileResponse;

  try {
    const response = await client.get({
      resourcePath: "/me",
      accessToken: input.accessToken,
      queryParams: {
        fields: "id,firstName,lastName,localizedFirstName,localizedLastName",
      },
    });

    profile = response.data as LinkedInProfileResponse;
  } catch {
    throw new ProviderConnectionValidationError("LinkedIn token validation failed. Use a valid member access token.");
  }

  const memberId = profile.id?.trim();
  if (!memberId) {
    throw new Error("LinkedIn token validation did not return a member id.");
  }

  return {
    ...input,
    accountHandle: formatLinkedInAccountHandle({
      fullName: buildLinkedInFullName(profile),
      memberId,
    }),
  };
}

function buildLinkedInFullName(profile: LinkedInProfileResponse): string {
  const firstName = extractLinkedInName(profile.localizedFirstName, profile.firstName);
  const lastName = extractLinkedInName(profile.localizedLastName, profile.lastName);

  return [firstName, lastName]
    .filter((value) => value.length > 0)
    .join(" ")
    .trim();
}

function extractLinkedInName(localizedValue: string | undefined, rawValue: LinkedInProfileResponse["firstName"]): string {
  if (typeof localizedValue === "string" && localizedValue.trim().length > 0) {
    return localizedValue.trim();
  }

  if (typeof rawValue === "string" && rawValue.trim().length > 0) {
    return rawValue.trim();
  }

  if (rawValue && typeof rawValue === "object" && rawValue.localized && typeof rawValue.localized === "object") {
    const firstLocalized = Object.values(rawValue.localized).find((value) => typeof value === "string" && value.trim().length > 0);
    if (firstLocalized) {
      return firstLocalized.trim();
    }
  }

  return "";
}

function formatLinkedInAccountHandle(input: { fullName: string; memberId: string }): string {
  if (input.fullName.length === 0) {
    return `member:${input.memberId}`;
  }

  return `${input.fullName} (${input.memberId})`;
}
