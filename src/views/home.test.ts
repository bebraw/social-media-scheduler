import { describe, expect, it } from "vitest";
import { renderQueuePage } from "./home";

describe("renderQueuePage", () => {
  it("renders the default queue view without the composer", () => {
    const html = renderQueuePage({
      demoAvailable: false,
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
      user: {
        name: "Scheduler Admin",
        role: "editor",
      },
    });

    expect(html).toContain("Open demo mode");
  });
});
