import { describe, expect, it } from "vitest";
import type { ChannelConnection } from "../channels";
import { renderSettingsPage } from "./settings";

const channelConnection: ChannelConnection = {
  id: "connection-1",
  channel: "x",
  label: "Personal X",
  accountHandle: "@juho",
  hasRefreshToken: true,
  createdAt: "2026-04-03T08:30:00.000Z",
  updatedAt: "2026-04-03T09:15:00.000Z",
};

describe("renderSettingsPage", () => {
  it("renders existing connections and the add form", () => {
    const html = renderSettingsPage({
      canEdit: true,
      connections: [channelConnection],
      demoAvailable: false,
      user: {
        name: "Scheduler Admin",
        role: "editor",
      },
    });

    expect(html).toContain("Settings");
    expect(html).toContain("Channel setup");
    expect(html).toContain("Personal X");
    expect(html).toContain("@juho");
    expect(html).toContain("Tokens are encrypted before they are written to D1.");
    expect(html).toContain("For Bluesky, enter a handle and app password");
    expect(html).toContain("for X, use a user-context access token");
    expect(html).toContain("Save channel connection");
  });

  it("renders saved and error states", () => {
    const html = renderSettingsPage({
      canEdit: true,
      connections: [],
      demoAvailable: false,
      error: "Add an access token before saving the channel connection.",
      saved: true,
      user: {
        name: "Scheduler Admin",
        role: "editor",
      },
    });

    expect(html).toContain("Channel connection saved.");
    expect(html).toContain("Add an access token before saving the channel connection.");
  });
});
