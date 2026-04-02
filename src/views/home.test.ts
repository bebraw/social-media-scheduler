import { describe, expect, it } from "vitest";
import { getDefaultPostingSchedules } from "../schedule";
import { renderQueuePage } from "./home";

describe("renderQueuePage", () => {
  it("renders the default queue view without the composer", () => {
    const html = renderQueuePage({
      demoAvailable: false,
      postingSchedules: getDefaultPostingSchedules(),
      user: {
        name: "Scheduler Admin",
        role: "editor",
      },
    });

    expect(html).toContain("Queue");
    expect(html).toContain('src="/home.js"');
    expect(html).toContain("Queued posts");
    expect(html).toContain(">Compose<");
    expect(html).toContain(">History<");
    expect(html).toContain("Posting schedule");
    expect(html).toContain('action="/posting-schedule"');
    expect(html).toContain("0 9 * * MON,WED,FRI");
    expect(html).not.toContain("Channel drafts");
    expect(html).not.toContain("data-channel-tab");
    expect(html).not.toContain("data-channel-column");
    expect(html).not.toContain("data-queue-button");
    expect(html).not.toContain("Compose next post");
    expect(html).not.toContain("Open composer");
    expect(html).not.toContain("Open demo mode");
    expect(html).not.toContain("Operations");
    expect(html).not.toContain("View sent history");
    expect(html).not.toContain("data-history-filter");
    expect(html).toContain("Scheduler Admin");
    expect(html).toContain('rel="stylesheet" href="/styles.css"');
  });

  it("shows the demo card when demo mode is available", () => {
    const html = renderQueuePage({
      demoAvailable: true,
      postingSchedules: getDefaultPostingSchedules(),
      user: {
        name: "Scheduler Admin",
        role: "editor",
      },
    });

    expect(html).toContain("Open demo mode");
  });

  it("shows the readonly schedule note for readonly users", () => {
    const html = renderQueuePage({
      demoAvailable: false,
      postingSchedules: getDefaultPostingSchedules(),
      user: {
        name: "Readonly User",
        role: "readonly",
      },
    });

    expect(html).toContain("Readonly users cannot change posting schedules.");
    expect(html).not.toContain("Save posting schedule");
  });
});
