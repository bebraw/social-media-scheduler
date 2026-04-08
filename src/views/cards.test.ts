import { describe, expect, it } from "vitest";
import { renderQueuedPostsSection, renderStatGrid } from "./cards";

describe("renderStatGrid", () => {
  it("renders both value cards and custom content cards", () => {
    const html = renderStatGrid([
      {
        label: "Queued",
        value: "3",
        valueAttributes: 'data-metric-queued="true"',
      },
      {
        content: "<p>Custom block</p>",
      },
    ]);

    expect(html).toContain("Queued");
    expect(html).toContain(">3<");
    expect(html).toContain('data-metric-queued="true"');
    expect(html).toContain("<p>Custom block</p>");
  });
});

describe("renderQueuedPostsSection", () => {
  it("renders the empty state when there are no posts", () => {
    const html = renderQueuedPostsSection({
      description: "Posts lined up across the queue.",
      emptyText: "No posts are queued yet.",
      title: "Queued posts",
    });

    expect(html).toContain("Queued posts");
    expect(html).toContain("No posts are queued yet.");
    expect(html).not.toContain("hidden");
  });

  it("renders posts and hides the empty state when markup exists", () => {
    const html = renderQueuedPostsSection({
      badge: "Local only",
      description: "Posts lined up across the queue.",
      emptyText: "No posts are queued yet.",
      postsMarkup: "<article>Queued post</article>",
      title: "Queued posts",
    });

    expect(html).toContain("Local only");
    expect(html).toContain("<article>Queued post</article>");
    expect(html).toContain("hidden");
  });
});
