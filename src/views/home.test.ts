import { describe, expect, it } from "vitest";
import { renderQueuePage } from "./home";

describe("renderQueuePage", () => {
  it("renders the default queue view without the composer", () => {
    const html = renderQueuePage({
      backupConfigured: true,
      demoAvailable: false,
      user: {
        name: "Scheduler Admin",
        role: "editor",
      },
    });

    expect(html).toContain("Queue");
    expect(html).toContain('src="/home.js"');
    expect(html).toContain("Queued posts");
    expect(html).toContain("Open composer");
    expect(html).toContain("View sent history");
    expect(html).not.toContain("Channel drafts");
    expect(html).not.toContain("data-channel-tab");
    expect(html).not.toContain("data-channel-column");
    expect(html).not.toContain("data-queue-button");
    expect(html).not.toContain("Open demo mode");
    expect(html).not.toContain("data-history-filter");
    expect(html).toContain("Scheduler Admin");
    expect(html).toContain('rel="stylesheet" href="/styles.css"');
  });

  it("renders the backup warning when backups are not configured", () => {
    const html = renderQueuePage({
      backupConfigured: false,
      demoAvailable: false,
      user: {
        name: "Scheduler Admin",
        role: "editor",
      },
    });

    expect(html).toContain("R2 backup binding is not configured yet.");
  });

  it("shows the demo card when demo mode is available", () => {
    const html = renderQueuePage({
      backupConfigured: true,
      demoAvailable: true,
      user: {
        name: "Scheduler Admin",
        role: "editor",
      },
    });

    expect(html).toContain("Open demo mode");
  });
});
