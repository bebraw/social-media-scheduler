import { describe, expect, it } from "vitest";
import type { ChannelConnection } from "../channels";
import type { SentPostHistoryEntry } from "../history";
import { formatChannelLabel, renderHistoryCards, renderHistoryFilters } from "./history-components";

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

describe("renderHistoryFilters", () => {
  it("renders connection filters plus legacy channel fallbacks", () => {
    const sentHistory: SentPostHistoryEntry[] = [
      {
        connectionId: "connection-x",
        connectionLabel: "Personal X",
        id: "entry-one",
        channel: "x",
        project: "Launch Note",
        body: "Queued an update.",
        sentAt: "2026-03-12T09:00:00.000Z",
        outcome: "Published",
      },
      {
        id: "entry-two",
        channel: "linkedin",
        project: "Legacy Post",
        body: "Published before connection records existed.",
        sentAt: "2026-03-11T09:00:00.000Z",
        outcome: "Published",
      },
    ];

    const html = renderHistoryFilters(connections, sentHistory);

    expect(html).toContain('data-history-filter="all"');
    expect(html).toContain('data-history-filter="connection:connection-x"');
    expect(html).toContain('data-history-filter="channel:linkedin"');
    expect(html).toContain(">Personal X<");
    expect(html).toContain(">LinkedIn<");
    expect(html).toContain(">2<");
    expect(html).toContain(">1<");
  });
});

describe("renderHistoryCards", () => {
  it("renders cards for connected and legacy history entries", () => {
    const html = renderHistoryCards([
      {
        connectionId: "connection-x",
        connectionLabel: "Personal X",
        id: "entry-one",
        channel: "x",
        project: "Launch Note",
        body: "Queued an update.",
        sentAt: "2026-03-12T09:00:00.000Z",
        outcome: "Published",
      },
      {
        id: "entry-two",
        channel: "bluesky",
        project: "Legacy Post",
        body: "Published before connection records existed.",
        sentAt: "not-a-date",
        outcome: "Published",
      },
    ]);

    expect(html).toContain('data-history-filter-key="connection:connection-x"');
    expect(html).toContain('data-history-filter-key="channel:bluesky"');
    expect(html).toContain("Personal X");
    expect(html).toContain("Queued an update.");
    expect(html).toContain("Published before connection records existed.");
    expect(html).toContain("not-a-date");
  });
});

describe("formatChannelLabel", () => {
  it("formats each supported channel label", () => {
    expect(formatChannelLabel("linkedin")).toBe("LinkedIn");
    expect(formatChannelLabel("x")).toBe("X");
    expect(formatChannelLabel("bluesky")).toBe("Bluesky");
  });
});
