import { describe, expect, it } from "vitest";
import type { ChannelConnection } from "../channels";
import type { SentPostHistoryEntry } from "../history";
import { renderHistoryPage } from "./history";

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
];

describe("renderHistoryPage", () => {
  it("renders the history page with filter controls", () => {
    const sentHistory: SentPostHistoryEntry[] = [
      {
        connectionId: "connection-x",
        connectionLabel: "Personal X",
        id: "one",
        channel: "x",
        project: "Test",
        body: "Past post",
        sentAt: "2026-03-12T09:00:00.000Z",
        outcome: "Published",
      },
    ];
    const html = renderHistoryPage({
      connections,
      sentHistory,
      user: {
        name: "Scheduler Admin",
        role: "editor",
      },
    });

    expect(html).toContain("History");
    expect(html).toContain("data-history-filter");
    expect(html).toContain("data-history-card");
    expect(html).toContain("Personal X");
    expect(html).toContain('href="/"');
    expect(html).toContain('src="/home.js"');
  });

  it("renders the empty state when no history exists", () => {
    const html = renderHistoryPage({
      connections: [],
      sentHistory: [],
      user: {
        name: "Scheduler Admin",
        role: "editor",
      },
    });

    expect(html).toContain("No sent posts are available yet.");
    expect(html).toContain("No channel connections are configured yet.");
  });
});
