import { describe, expect, it } from "vitest";
import { getDemoDrafts, getDemoSentHistory, loadDemoQueuedPosts } from "../demo";
import { createTestDatabase } from "../test-support";
import { renderDemoPage } from "./demo";

describe("renderDemoPage", () => {
  it("renders the dev-only demo workspace", async () => {
    const db = createTestDatabase();
    const html = renderDemoPage({
      drafts: getDemoDrafts(),
      queuedPosts: await loadDemoQueuedPosts(db),
      sentHistory: getDemoSentHistory(),
      user: {
        name: "Scheduler Admin",
        role: "editor",
      },
    });

    expect(html).toContain("Demo Mode");
    expect(html).toContain("Demo mode");
    expect(html).not.toContain("Development-only sandbox");
    expect(html).toContain('action="/demo/queue"');
    expect(html).toContain("Schedule demo post");
    expect(html).toContain("data-history-filter");
  });
});
