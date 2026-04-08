import { describe, expect, it } from "vitest";
import type { ChannelConnection } from "../channels";
import { CHANNEL_CONSTRAINTS } from "../queue/constraints";
import { renderComposePage } from "./compose";

const connections: ChannelConnection[] = [
  {
    id: "connection-x",
    channel: "x",
    label: "Personal X",
    accountHandle: "@juho",
    hasRefreshToken: true,
    createdAt: "2026-04-03T08:30:00.000Z",
    updatedAt: "2026-04-03T09:15:00.000Z",
  },
  {
    id: "connection-linkedin",
    channel: "linkedin",
    label: "Company LinkedIn",
    accountHandle: "Example Company",
    hasRefreshToken: true,
    createdAt: "2026-04-03T08:30:00.000Z",
    updatedAt: "2026-04-03T09:15:00.000Z",
  },
];

describe("renderComposePage", () => {
  it("renders the compose page with channel tabs and server queue controls", () => {
    const html = renderComposePage({
      connections,
      user: {
        name: "Scheduler Admin",
        role: "editor",
      },
    });

    expect(html).toContain("Compose");
    expect(html).toContain("Channel drafts");
    expect(html).toContain("Personal X");
    expect(html).toContain("Company LinkedIn");
    expect(html).toContain("@juho");
    expect(html).toContain("3000 characters");
    expect(html).toContain("280 weighted characters");
    expect(html).toContain('role="tablist"');
    expect(html).toContain("data-channel-tab");
    expect(html).toContain("data-channel-column");
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("hidden");
    expect(html).toContain('action="/compose/queue"');
    expect(html).toContain("Queue for next slot");
    expect(html).toContain("Queued posts");
    expect(html).not.toContain("Dedicated composer");
    expect(html).not.toContain("Composer flow");
    expect(html).toContain('src="/home.js"');
    expect(html).not.toContain("Open demo mode");
  });

  it("renders an empty state when no channel connections exist", () => {
    const html = renderComposePage({
      connections: [],
      user: {
        name: "Scheduler Admin",
        role: "editor",
      },
    });

    expect(html).toContain("No channel connections are configured yet.");
    expect(html).toContain('href="/settings"');
    expect(html).not.toContain('role="tablist"');
  });

  it("skips a draft column if its constraint metadata is missing", () => {
    const removedConstraint = CHANNEL_CONSTRAINTS.pop();

    try {
      const html = renderComposePage({
        connections,
        user: {
          name: "Scheduler Admin",
          role: "editor",
        },
      });

      expect(removedConstraint).toBeDefined();
      expect(html).not.toContain('data-channel-kind="bluesky"');
      expect(html).not.toContain(">Demo mode<");
    } finally {
      if (removedConstraint) {
        CHANNEL_CONSTRAINTS.push(removedConstraint);
      }
    }
  });
});
