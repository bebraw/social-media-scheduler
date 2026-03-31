import { describe, expect, it } from "vitest";
import { appRoutes } from "../app-routes";
import { renderHomePage } from "./home";

describe("renderHomePage", () => {
  it("renders stable starter copy and stylesheet wiring", () => {
    const html = renderHomePage({
      backupConfigured: true,
      routes: appRoutes,
      user: {
        name: "Scheduler Admin",
        role: "editor",
      },
    });

    expect(html).toContain("Social Media Scheduler");
    expect(html).toContain("D1-backed local accounts");
    expect(html).toContain("Scheduler Admin");
    expect(html).toContain('rel="stylesheet" href="/styles.css"');
  });
});
