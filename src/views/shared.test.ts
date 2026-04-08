import { describe, expect, it } from "vitest";
import { MAX_POST_IMAGE_ALT_TEXT_LENGTH } from "../media";
import { getPostImageAltTextLimit, renderPostImageAttachments, renderWorkspaceNav } from "./shared";

describe("renderWorkspaceNav", () => {
  it("renders only the production workspace links", () => {
    const html = renderWorkspaceNav({ activePath: "/compose" });

    expect(html).toContain('href="/"');
    expect(html).toContain('href="/compose"');
    expect(html).toContain('href="/history"');
    expect(html).toContain('href="/settings"');
    expect(html).not.toContain('href="/demo"');
    expect(html).toContain("bg-app-accent text-white");
  });
});

describe("renderPostImageAttachments", () => {
  it("returns empty markup when there are no attachments", () => {
    expect(renderPostImageAttachments([])).toBe("");
  });

  it("renders attachment cards with image metadata", () => {
    const html = renderPostImageAttachments([
      {
        id: "attachment-1",
        objectKey: "uploads/image-1.png",
        fileName: "image-1.png",
        contentType: "image/png",
        sizeBytes: 1024,
        altText: "Screenshot of the scheduler queue",
      },
    ]);

    expect(html).toContain("Attached images");
    expect(html).toContain("/media/uploads%2Fimage-1.png");
    expect(html).toContain("Screenshot of the scheduler queue");
    expect(html).toContain("1 attached");
  });
});

describe("getPostImageAltTextLimit", () => {
  it("returns the shared alt-text limit", () => {
    expect(getPostImageAltTextLimit()).toBe(MAX_POST_IMAGE_ALT_TEXT_LENGTH);
  });
});
