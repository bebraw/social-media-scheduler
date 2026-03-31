import { describe, expect, it } from "vitest";
import {
  countBlueskyGraphemes,
  countChannelCharacters,
  countLinkedInCharacters,
  countXCharacters,
  describeUsage,
  getChannelConstraint,
} from "./constraints";

describe("queue constraints", () => {
  it("counts LinkedIn characters directly", () => {
    expect(countLinkedInCharacters("hello")).toBe(5);
  });

  it("counts Bluesky graphemes", () => {
    expect(countBlueskyGraphemes("A👍🏽B")).toBeGreaterThanOrEqual(3);
  });

  it("falls back to code point counting when Intl.Segmenter is unavailable", () => {
    const originalSegmenter = Intl.Segmenter;
    Reflect.deleteProperty(Intl, "Segmenter");

    try {
      expect(countBlueskyGraphemes("A👍🏽B")).toBe(Array.from("A👍🏽B").length);
    } finally {
      Object.defineProperty(Intl, "Segmenter", {
        value: originalSegmenter,
        configurable: true,
      });
    }
  });

  it("counts X URLs and weighted characters", () => {
    expect(countXCharacters("link https://example.com/test")).toBe(5 + 23);
    expect(countXCharacters("emoji 👍")).toBeGreaterThan(countLinkedInCharacters("emoji 👍"));
  });

  it("dispatches counting by channel", () => {
    expect(countChannelCharacters("linkedin", "hello")).toBe(5);
    expect(countChannelCharacters("x", "hello")).toBe(5);
    expect(countChannelCharacters("bluesky", "hello")).toBe(5);
  });

  it("describes usage state by channel budget", () => {
    expect(describeUsage("linkedin", "Short note").state).toBe("ready");
    expect(describeUsage("x", "x".repeat(250)).state).toBe("warning");
    expect(describeUsage("bluesky", "x".repeat(301)).state).toBe("over");
  });

  it("returns channel metadata", () => {
    expect(getChannelConstraint("linkedin").limit).toBe(3000);
    expect(getChannelConstraint("x").limit).toBe(280);
    expect(getChannelConstraint("bluesky").limit).toBe(300);
  });

  it("throws for an unknown channel", () => {
    expect(() => getChannelConstraint("mastodon" as never)).toThrow("Unknown queue channel: mastodon");
  });
});
