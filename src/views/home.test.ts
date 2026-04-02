import { describe, expect, it } from "vitest";
import { loadSentPostHistory } from "../history";
import { CHANNEL_CONSTRAINTS } from "../queue/constraints";
import { createTestDatabase } from "../test-support";
import { renderHomePage } from "./home";

describe("renderHomePage", () => {
  it("renders tabbed channel drafts with interaction hooks", async () => {
    const sentHistory = await loadSentPostHistory(createTestDatabase());
    const html = renderHomePage({
      backupConfigured: true,
      sentHistory,
      user: {
        name: "Scheduler Admin",
        role: "editor",
      },
    });

    expect(html).toContain("Social Media Scheduler");
    expect(html).toContain("Channel drafts");
    expect(html).toContain("LinkedIn");
    expect(html).toContain("X");
    expect(html).toContain("Bluesky");
    expect(html).toContain("3000 characters");
    expect(html).toContain("280 weighted characters");
    expect(html).toContain("300 grapheme clusters");
    expect(html).toContain('role="tablist"');
    expect(html).toContain("data-channel-tab");
    expect(html).toContain("data-channel-column");
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("hidden");
    expect(html).toContain("data-queue-button");
    expect(html).toContain('src="/home.js"');
    expect(html).toContain("Queued posts");
    expect(html).toContain("Sent history");
    expect(html).toContain("data-history-filter");
    expect(html).toContain("data-history-card");
    expect(html).toContain("Scheduler Admin");
    expect(html).toContain('rel="stylesheet" href="/styles.css"');
  });

  it("renders the backup warning when backups are not configured", async () => {
    const sentHistory = await loadSentPostHistory(createTestDatabase());
    const html = renderHomePage({
      backupConfigured: false,
      sentHistory,
      user: {
        name: "Scheduler Admin",
        role: "editor",
      },
    });

    expect(html).toContain("R2 backup binding is not configured yet.");
  });

  it("skips a draft column if its constraint metadata is missing", async () => {
    const removedConstraint = CHANNEL_CONSTRAINTS.pop();

    try {
      const sentHistory = await loadSentPostHistory(createTestDatabase());
      const html = renderHomePage({
        backupConfigured: true,
        sentHistory,
        user: {
          name: "Scheduler Admin",
          role: "editor",
        },
      });

      expect(removedConstraint).toBeDefined();
      expect(html).not.toContain('data-channel-id="bluesky"');
    } finally {
      if (removedConstraint) {
        CHANNEL_CONSTRAINTS.push(removedConstraint);
      }
    }
  });
});
