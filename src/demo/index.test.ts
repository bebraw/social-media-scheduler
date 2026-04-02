import { describe, expect, it } from "vitest";
import { canAccessDemo, getDemoDrafts, getDemoSentHistory, isDemoModeConfigured, loadDemoQueuedPosts, scheduleDemoPost } from "./index";
import { createTestDatabase, createTestEnv, seedStateEntry } from "../test-support";

describe("demo mode", () => {
  it("requires the explicit demo env flag", () => {
    expect(isDemoModeConfigured(createTestEnv())).toBe(false);
    expect(isDemoModeConfigured(createTestEnv({ DEMO_MODE: "true" }))).toBe(true);
  });

  it("allows demo mode only on loopback hosts", () => {
    const env = createTestEnv({ DEMO_MODE: "true" });

    expect(canAccessDemo(new Request("http://127.0.0.1:8787/demo"), env)).toBe(true);
    expect(canAccessDemo(new Request("http://localhost:8787/demo"), env)).toBe(true);
    expect(canAccessDemo(new Request("http://example.com/demo"), env)).toBe(false);
  });

  it("loads seeded demo data by default", async () => {
    const db = createTestDatabase();

    await expect(loadDemoQueuedPosts(db)).resolves.toHaveLength(3);
    expect(getDemoDrafts()).toHaveLength(3);
    expect(getDemoSentHistory()).toHaveLength(5);
  });

  it("persists scheduled demo posts in app_state", async () => {
    const db = createTestDatabase();

    await scheduleDemoPost(db, {
      channel: "x",
      body: "Schedule this local-only demo post.",
      slot: "Tomorrow, 09:00",
    });

    const queuedPosts = await loadDemoQueuedPosts(db);

    expect(queuedPosts[0]).toMatchObject({
      channel: "x",
      body: "Schedule this local-only demo post.",
      time: "Tomorrow, 09:00",
      status: "Demo scheduled",
    });
  });

  it("falls back to seeded queue data when stored demo queue is invalid", async () => {
    const db = createTestDatabase();
    seedStateEntry(db, "demo_mode_queue_v1", [{ id: "bad", channel: "mastodon" }]);

    await expect(loadDemoQueuedPosts(db)).resolves.toHaveLength(3);
  });
});
