import { describe, expect, it } from "vitest";
import { loadSentPostHistory } from "./index";
import { createTestDatabase, seedStateEntry } from "../test-support";

describe("loadSentPostHistory", () => {
  it("returns fallback entries when no stored history exists", async () => {
    const db = createTestDatabase();

    const history = await loadSentPostHistory(db);

    expect(history.length).toBeGreaterThan(0);
    expect(history[0]?.channel).toBe("linkedin");
  });

  it("returns stored history entries sorted from newest to oldest", async () => {
    const db = createTestDatabase();
    seedStateEntry(db, "sent_post_history_v1", [
      {
        id: "older-x",
        channel: "x",
        project: "Older",
        body: "Older post",
        sentAt: "2026-03-10T08:00:00.000Z",
        outcome: "Published",
      },
      {
        id: "newer-linkedin",
        channel: "linkedin",
        project: "Newer",
        body: "Newer post",
        sentAt: "2026-03-12T09:00:00.000Z",
        outcome: "Published",
      },
    ]);

    const history = await loadSentPostHistory(db);

    expect(history.map((entry) => entry.id)).toEqual(["newer-linkedin", "older-x"]);
  });

  it("falls back when stored history is invalid", async () => {
    const db = createTestDatabase();
    seedStateEntry(db, "sent_post_history_v1", [
      {
        id: "broken-entry",
        channel: "mastodon",
        project: "Broken",
        body: "Unsupported channel",
        sentAt: "2026-03-12T09:00:00.000Z",
        outcome: "Published",
      },
    ]);

    const history = await loadSentPostHistory(db);

    expect(history.length).toBeGreaterThan(0);
    expect(history.some((entry) => entry.id === "broken-entry")).toBe(false);
  });
});
