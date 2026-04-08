import { describe, expect, it } from "vitest";
import { renderWorkspacePage } from "./layout";

describe("renderWorkspacePage", () => {
  it("renders the default wide layout", () => {
    const html = renderWorkspacePage({
      activePath: "/",
      content: "<section>Queue content</section>",
      description: "Queue overview",
      title: "Queue",
      user: {
        name: "Scheduler Admin",
        role: "editor",
      },
    });

    expect(html).toContain("w-[min(72rem,calc(100vw-2rem))]");
    expect(html).toContain(">Compose<");
    expect(html).not.toContain(">Demo mode<");
  });

  it("renders the base-width layout when requested", () => {
    const html = renderWorkspacePage({
      activePath: "/settings",
      content: "<section>Settings content</section>",
      description: "Settings overview",
      title: "Settings",
      user: {
        name: "Scheduler Admin",
        role: "editor",
      },
      width: "base",
    });

    expect(html).toContain("w-[min(64rem,calc(100vw-2rem))]");
    expect(html).toContain(">Settings<");
  });
});
