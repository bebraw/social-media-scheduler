import { describe, expect, it } from "vitest";
import type { SentPostHistoryEntry } from "../history";
import { renderHistoryPage } from "./history";

describe("renderHistoryPage", () => {
  it("renders the sent history page with filter controls", () => {
    const sentHistory: SentPostHistoryEntry[] = [
      {
        id: "one",
        channel: "x",
        project: "Test",
        body: "Past post",
        sentAt: "2026-03-12T09:00:00.000Z",
        outcome: "Published",
      },
    ];
    const html = renderHistoryPage({
      demoAvailable: false,
      sentHistory,
      user: {
        name: "Scheduler Admin",
        role: "editor",
      },
    });

    expect(html).toContain("Sent History");
    expect(html).toContain("data-history-filter");
    expect(html).toContain("data-history-card");
    expect(html).toContain('href="/"');
    expect(html).toContain('src="/home.js"');
  });

  it("renders the empty state when no history exists", () => {
    const html = renderHistoryPage({
      demoAvailable: false,
      sentHistory: [],
      user: {
        name: "Scheduler Admin",
        role: "editor",
      },
    });

    expect(html).toContain("No sent posts are available yet.");
  });
});
