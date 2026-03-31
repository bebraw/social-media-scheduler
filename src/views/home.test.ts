import { describe, expect, it } from "vitest";
import { renderHomePage } from "./home";

describe("renderHomePage", () => {
  it("renders the scheduler workspace without bootstrap copy", () => {
    const html = renderHomePage({
      backupConfigured: true,
      user: {
        name: "Scheduler Admin",
        role: "editor",
      },
    });

    expect(html).toContain("Social Media Scheduler");
    expect(html).toContain("Workspace");
    expect(html).toContain("Scheduler Admin");
    expect(html).not.toContain("Available routes");
    expect(html).not.toContain("Application Foundation");
    expect(html).toContain('rel="stylesheet" href="/styles.css"');
  });
});
