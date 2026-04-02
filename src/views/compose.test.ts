import { describe, expect, it } from "vitest";
import { CHANNEL_CONSTRAINTS } from "../queue/constraints";
import { renderComposePage } from "./compose";

describe("renderComposePage", () => {
  it("renders the dedicated composer with channel tabs and local queue controls", () => {
    const html = renderComposePage({
      demoAvailable: false,
      user: {
        name: "Scheduler Admin",
        role: "editor",
      },
    });

    expect(html).toContain("Compose");
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
    expect(html).toContain("Queued posts");
    expect(html).toContain('src="/home.js"');
    expect(html).not.toContain("Open demo mode");
  });

  it("skips a draft column if its constraint metadata is missing", () => {
    const removedConstraint = CHANNEL_CONSTRAINTS.pop();

    try {
      const html = renderComposePage({
        demoAvailable: true,
        user: {
          name: "Scheduler Admin",
          role: "editor",
        },
      });

      expect(removedConstraint).toBeDefined();
      expect(html).not.toContain('data-channel-id="bluesky"');
      expect(html).toContain(">Demo mode<");
    } finally {
      if (removedConstraint) {
        CHANNEL_CONSTRAINTS.push(removedConstraint);
      }
    }
  });
});
