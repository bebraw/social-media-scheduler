import { describe, expect, it } from "vitest";
import { renderHomePage } from "./home";

describe("renderHomePage", () => {
  it("renders a simple queued-posts mockup", () => {
    const html = renderHomePage({
      backupConfigured: true,
      user: {
        name: "Scheduler Admin",
        role: "editor",
      },
    });

    expect(html).toContain("Social Media Scheduler");
    expect(html).toContain("Compose post");
    expect(html).toContain("Queued posts");
    expect(html).toContain("Add to queue");
    expect(html).toContain("Scheduler Admin");
    expect(html).toContain('rel="stylesheet" href="/styles.css"');
  });
});
