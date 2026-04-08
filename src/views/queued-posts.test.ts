import { describe, expect, it } from "vitest";
import type { QueuedPost } from "../publishing";
import { buildPostingSchedule } from "../schedule";
import { renderQueuedPosts } from "./queued-posts";

const queuedPost: QueuedPost = {
  attemptCount: 1,
  body: "Queue the next LinkedIn update.",
  channel: "linkedin",
  connectionId: "connection-1",
  connectionLabel: "Company LinkedIn",
  createdAt: "2026-04-06T10:00:00.000Z",
  id: "queued-post-1",
  lastError: "Token expired",
  updatedAt: "2026-04-06T10:30:00.000Z",
};

describe("renderQueuedPosts", () => {
  it("renders the persisted queue entry with its next eligible slot and delete action", () => {
    const html = renderQueuedPosts([queuedPost], [buildPostingSchedule({ channel: "linkedin", time: "10:30", weekdays: ["MON", "WED"] })], {
      canEdit: true,
      now: new Date("2026-04-06T09:00:00.000Z"),
    });

    expect(html).toContain("Queue the next LinkedIn update.");
    expect(html).toContain("Company LinkedIn");
    expect(html).toContain("Next eligible slot:");
    expect(html).toContain("Last error: Token expired");
    expect(html).toContain('action="/queue/delete"');
    expect(html).toContain("Remove from queue");
  });

  it("renders a schedule fallback without edit controls for readonly views", () => {
    const html = renderQueuedPosts([queuedPost], [], {
      canEdit: false,
      now: new Date("2026-04-06T09:00:00.000Z"),
    });

    expect(html).toContain("No schedule available");
    expect(html).not.toContain('action="/queue/delete"');
  });
});
