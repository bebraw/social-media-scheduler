import { RestliClient } from "linkedin-api-client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createChannelConnection, loadChannelConnections } from "../channels";
import { loadSentPostHistory } from "../history";
import { buildPostingSchedule, getDefaultPostingSchedules, savePostingSchedules } from "../schedule";
import { createTestDatabase, createTestEnv, seedStateEntry } from "../test-support";
import {
  countQueuedPostsPublishingToday,
  deleteQueuedPost,
  getQueuedPostNextOccurrence,
  loadQueuedPosts,
  publishDueQueuedPosts,
  queuePost,
  QueueValidationError,
} from "./index";

const APP_ENCRYPTION_SECRET = "dedicated-secret";

function mockLinkedInProfileLookup(): void {
  vi.spyOn(RestliClient.prototype, "get").mockResolvedValue({
    data: {
      id: "abc123",
      localizedFirstName: "Example",
      localizedLastName: "Member",
    },
  } as unknown as Awaited<ReturnType<RestliClient["get"]>>);
}

describe("publishing queue", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("queues validated posts against a saved connection", async () => {
    const db = createTestDatabase();
    const env = createTestEnv({ APP_ENCRYPTION_SECRET: APP_ENCRYPTION_SECRET });
    mockLinkedInProfileLookup();
    await createChannelConnection(db, env, {
      accessToken: "linkedin-access-token",
      accountHandle: "Example Company",
      channel: "linkedin",
      label: "Company LinkedIn",
      refreshToken: "",
    });

    const connections = await loadChannelConnections(db);
    const queuedPost = await queuePost(db, connections, {
      body: "Queue the next LinkedIn update.",
      connectionId: connections[0]?.id || "",
    });

    expect(queuedPost.connectionLabel).toBe("Company LinkedIn");
    await expect(loadQueuedPosts(db)).resolves.toEqual([expect.objectContaining({ body: "Queue the next LinkedIn update." })]);
  });

  it("rejects queue entries that exceed the channel limit", async () => {
    const db = createTestDatabase();
    const env = createTestEnv({ APP_ENCRYPTION_SECRET: APP_ENCRYPTION_SECRET });
    mockLinkedInProfileLookup();
    await createChannelConnection(
      db,
      env,
      {
        accessToken: "x-access-token",
        accountHandle: "@example",
        channel: "x",
        label: "Personal X",
        refreshToken: "",
      },
      {
        fetch: async () =>
          new Response(JSON.stringify({ data: { username: "example" } }), {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          }),
      },
    );

    const connections = await loadChannelConnections(db);
    await expect(
      queuePost(db, connections, {
        body: "x".repeat(281),
        connectionId: connections[0]?.id || "",
      }),
    ).rejects.toBeInstanceOf(QueueValidationError);
  });

  it("can remove a queued post by id", async () => {
    const db = createTestDatabase();
    const env = createTestEnv({ APP_ENCRYPTION_SECRET: APP_ENCRYPTION_SECRET });
    mockLinkedInProfileLookup();
    await createChannelConnection(db, env, {
      accessToken: "linkedin-access-token",
      accountHandle: "Example Company",
      channel: "linkedin",
      label: "Company LinkedIn",
      refreshToken: "",
    });

    const connections = await loadChannelConnections(db);
    const queuedPost = await queuePost(db, connections, {
      body: "Delete this queued post.",
      connectionId: connections[0]?.id || "",
    });

    await expect(deleteQueuedPost(db, queuedPost.id)).resolves.toBe(true);
    await expect(deleteQueuedPost(db, queuedPost.id)).resolves.toBe(false);
    await expect(loadQueuedPosts(db)).resolves.toEqual([]);
  });

  it("calculates the next slot and today's publishing count from saved schedules", async () => {
    const schedules = [
      buildPostingSchedule({ channel: "linkedin", time: "10:30", weekdays: ["MON"] }),
      ...getDefaultPostingSchedules().filter((schedule) => schedule.channel !== "linkedin"),
    ];
    const queuedPost = {
      attemptCount: 0,
      body: "Count this queued LinkedIn update.",
      channel: "linkedin" as const,
      connectionId: "connection-1",
      connectionLabel: "Company LinkedIn",
      createdAt: "2026-04-06T09:00:00.000Z",
      id: "queued-post-1",
      updatedAt: "2026-04-06T09:00:00.000Z",
    };
    const now = new Date("2026-04-06T09:30:00.000Z");

    expect(getQueuedPostNextOccurrence(queuedPost, schedules, now)?.toISOString()).toBe("2026-04-06T10:30:00.000Z");
    expect(getQueuedPostNextOccurrence(queuedPost, [], now)).toBeNull();
    expect(countQueuedPostsPublishingToday([queuedPost], schedules, now)).toBe(1);
    expect(countQueuedPostsPublishingToday([queuedPost], [], now)).toBe(0);
  });

  it("skips publishing when no saved schedule is due", async () => {
    const db = createTestDatabase();
    const env = createTestEnv({ APP_ENCRYPTION_SECRET: APP_ENCRYPTION_SECRET, DB: db });
    mockLinkedInProfileLookup();
    await createChannelConnection(db, env, {
      accessToken: "linkedin-access-token",
      accountHandle: "Example Company",
      channel: "linkedin",
      label: "Company LinkedIn",
      refreshToken: "",
    });
    const connections = await loadChannelConnections(db);
    await queuePost(db, connections, {
      body: "Queued, but not due yet.",
      connectionId: connections[0]?.id || "",
    });

    await savePostingSchedules(db, [
      buildPostingSchedule({ channel: "linkedin", time: "10:30", weekdays: ["MON"] }),
      ...getDefaultPostingSchedules().filter((schedule) => schedule.channel !== "linkedin"),
    ]);

    await expect(
      publishDueQueuedPosts(db, env, {
        now: new Date("2026-04-06T10:00:00.000Z"),
      }),
    ).resolves.toEqual({ failed: 0, published: 0, skipped: true });
  });

  it("returns an empty queue when the stored payload is invalid", async () => {
    const db = createTestDatabase();
    seedStateEntry(db, "queued_posts_v1", [{ id: "broken-entry", channel: "mastodon" }]);

    await expect(loadQueuedPosts(db)).resolves.toEqual([]);
  });

  it("skips publishing when no queued posts exist", async () => {
    const db = createTestDatabase();
    const env = createTestEnv({ APP_ENCRYPTION_SECRET: APP_ENCRYPTION_SECRET, DB: db });

    await savePostingSchedules(db, [
      buildPostingSchedule({ channel: "linkedin", time: "10:30", weekdays: ["MON"] }),
      ...getDefaultPostingSchedules().filter((schedule) => schedule.channel !== "linkedin"),
    ]);

    await expect(
      publishDueQueuedPosts(db, env, {
        now: new Date("2026-04-06T10:30:00.000Z"),
      }),
    ).resolves.toEqual({ failed: 0, published: 0, skipped: true });
  });

  it("skips due posts whose saved connection no longer exists", async () => {
    const db = createTestDatabase();
    const env = createTestEnv({ APP_ENCRYPTION_SECRET: APP_ENCRYPTION_SECRET, DB: db });
    mockLinkedInProfileLookup();
    const connection = await createChannelConnection(db, env, {
      accessToken: "linkedin-access-token",
      accountHandle: "Example Company",
      channel: "linkedin",
      label: "Company LinkedIn",
      refreshToken: "",
    });

    seedStateEntry(db, "queued_posts_v1", [
      {
        attemptCount: 0,
        body: "This post points at a deleted connection.",
        channel: "linkedin",
        connectionId: connection.id,
        connectionLabel: "Company LinkedIn",
        createdAt: "2026-04-06T09:00:00.000Z",
        id: "queued-post-1",
        updatedAt: "2026-04-06T09:00:00.000Z",
      },
    ]);
    db.state.channelConnections.clear();

    await savePostingSchedules(db, [
      buildPostingSchedule({ channel: "linkedin", time: "10:30", weekdays: ["MON"] }),
      ...getDefaultPostingSchedules().filter((schedule) => schedule.channel !== "linkedin"),
    ]);

    await expect(
      publishDueQueuedPosts(db, env, {
        now: new Date("2026-04-06T10:30:00.000Z"),
      }),
    ).resolves.toEqual({ failed: 0, published: 0, skipped: true });
  });

  it("marks queued posts as failed when the saved access token is unavailable", async () => {
    const db = createTestDatabase();
    const env = createTestEnv({ APP_ENCRYPTION_SECRET: APP_ENCRYPTION_SECRET, DB: db });
    mockLinkedInProfileLookup();
    const connection = await createChannelConnection(db, env, {
      accessToken: "linkedin-access-token",
      accountHandle: "Example Company",
      channel: "linkedin",
      label: "Company LinkedIn",
      refreshToken: "",
    });
    const connections = await loadChannelConnections(db);
    await queuePost(db, connections, {
      body: "This post should fail without its saved secret.",
      connectionId: connection.id,
    });
    db.state.appSecrets.clear();

    await savePostingSchedules(db, [
      buildPostingSchedule({ channel: "linkedin", time: "10:30", weekdays: ["MON"] }),
      ...getDefaultPostingSchedules().filter((schedule) => schedule.channel !== "linkedin"),
    ]);

    await expect(
      publishDueQueuedPosts(db, env, {
        now: new Date("2026-04-06T10:30:00.000Z"),
      }),
    ).resolves.toEqual({ failed: 1, published: 0, skipped: false });

    await expect(loadQueuedPosts(db)).resolves.toEqual([
      expect.objectContaining({
        lastError: "The saved access token is unavailable.",
      }),
    ]);
  });

  it("publishes the oldest due queued post per connection and appends history", async () => {
    const db = createTestDatabase();
    const env = createTestEnv({ APP_ENCRYPTION_SECRET: APP_ENCRYPTION_SECRET, DB: db });
    mockLinkedInProfileLookup();
    await createChannelConnection(db, env, {
      accessToken: "linkedin-access-token",
      accountHandle: "Example Company",
      channel: "linkedin",
      label: "Company LinkedIn",
      refreshToken: "",
    });
    const connections = await loadChannelConnections(db);
    const firstQueuedPost = await queuePost(db, connections, {
      body: "First queued LinkedIn update.",
      connectionId: connections[0]?.id || "",
    });
    const secondQueuedPost = await queuePost(db, connections, {
      body: "Second queued LinkedIn update.",
      connectionId: connections[0]?.id || "",
    });
    seedStateEntry(db, "queued_posts_v1", [
      {
        ...firstQueuedPost,
        createdAt: "2026-04-06T09:00:00.000Z",
        updatedAt: "2026-04-06T09:00:00.000Z",
      },
      {
        ...secondQueuedPost,
        createdAt: "2026-04-06T09:15:00.000Z",
        updatedAt: "2026-04-06T09:15:00.000Z",
      },
    ]);

    await savePostingSchedules(db, [
      buildPostingSchedule({ channel: "linkedin", time: "10:30", weekdays: ["MON"] }),
      ...getDefaultPostingSchedules().filter((schedule) => schedule.channel !== "linkedin"),
    ]);

    const publishPost = vi.fn().mockResolvedValue("Published to LinkedIn");
    const result = await publishDueQueuedPosts(db, env, {
      now: new Date("2026-04-06T10:30:00.000Z"),
      publishPost,
    });

    expect(result).toEqual({ failed: 0, published: 1, skipped: false });
    await expect(loadQueuedPosts(db)).resolves.toEqual([expect.objectContaining({ body: "Second queued LinkedIn update." })]);
    await expect(loadSentPostHistory(db)).resolves.toEqual([
      expect.objectContaining({
        body: "First queued LinkedIn update.",
        connectionLabel: "Company LinkedIn",
        outcome: "Published to LinkedIn",
      }),
    ]);
  });

  it("keeps queued posts when publishing fails and stores the last error", async () => {
    const db = createTestDatabase();
    const env = createTestEnv({ APP_ENCRYPTION_SECRET: APP_ENCRYPTION_SECRET, DB: db });
    mockLinkedInProfileLookup();
    await createChannelConnection(db, env, {
      accessToken: "linkedin-access-token",
      accountHandle: "Example Company",
      channel: "linkedin",
      label: "Company LinkedIn",
      refreshToken: "",
    });
    const connections = await loadChannelConnections(db);
    await queuePost(db, connections, {
      body: "LinkedIn update that should fail.",
      connectionId: connections[0]?.id || "",
    });

    await savePostingSchedules(db, [
      buildPostingSchedule({ channel: "linkedin", time: "10:30", weekdays: ["MON"] }),
      ...getDefaultPostingSchedules().filter((schedule) => schedule.channel !== "linkedin"),
    ]);

    const result = await publishDueQueuedPosts(db, env, {
      now: new Date("2026-04-06T10:30:00.000Z"),
      publishPost: vi.fn().mockRejectedValue(new Error("Token expired")),
    });

    expect(result).toEqual({ failed: 1, published: 0, skipped: false });
    await expect(loadQueuedPosts(db)).resolves.toEqual([
      expect.objectContaining({
        attemptCount: 1,
        body: "LinkedIn update that should fail.",
        lastError: "Token expired",
      }),
    ]);
    await expect(loadSentPostHistory(db)).resolves.toEqual([]);
  });
});
