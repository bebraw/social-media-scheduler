import type { ChannelConnection } from "../channels";
import { listPublishingChannelConnections, type PublishingChannelConnection } from "../channels";
import type { Env } from "../app-env";
import type { D1Database } from "../db-core";
import { describeUsage } from "../queue/constraints";
import { findChannelsForTime, getNextScheduleOccurrence, loadPostingSchedules, type ChannelPostingSchedule } from "../schedule";
import { loadEncryptedSecret, resolveAppEncryptionSecret } from "../secrets";
import { appendSentPostHistoryEntry } from "../history";
import { publishChannelPost } from "../providers/publish";

const QUEUED_POSTS_STATE_KEY = "queued_posts_v1";

interface AppStateRow {
  value_json: string;
}

export interface QueuedPost {
  attemptCount: number;
  body: string;
  channel: ChannelConnection["channel"];
  connectionId: string;
  connectionLabel: string;
  createdAt: string;
  id: string;
  lastAttemptAt?: string;
  lastError?: string;
  updatedAt: string;
}

interface StoredQueuedPost extends Omit<QueuedPost, "attemptCount"> {
  attemptCount: number;
}

export interface QueuePostInput {
  body: string;
  connectionId: string;
}

export interface QueuePublishResult {
  failed: number;
  published: number;
  skipped: boolean;
}

export async function loadQueuedPosts(db: D1Database): Promise<QueuedPost[]> {
  const row = await db.prepare("SELECT value_json FROM app_state WHERE state_key = ?").bind(QUEUED_POSTS_STATE_KEY).first<AppStateRow>();
  if (!row?.value_json) {
    return [];
  }

  try {
    const parsed = JSON.parse(row.value_json);
    const queuedPosts = Array.isArray(parsed) ? parsed.map(parseQueuedPost).filter((entry) => entry !== null) : [];
    return sortQueuedPosts(queuedPosts);
  } catch {
    return [];
  }
}

export async function queuePost(db: D1Database, connections: ChannelConnection[], input: QueuePostInput): Promise<QueuedPost> {
  const connection = connections.find((candidate) => candidate.id === input.connectionId);
  if (!connection) {
    throw new QueueValidationError("Choose a saved channel connection before queueing a post.");
  }

  const body = input.body.trim();
  if (!body) {
    throw new QueueValidationError("Write post copy before queueing it.");
  }

  const usage = describeUsage(connection.channel, body);
  if (usage.state === "over") {
    throw new QueueValidationError(`${connection.label} exceeds the ${usage.limit}-character channel limit.`);
  }

  const now = new Date().toISOString();
  const queuedPost: QueuedPost = {
    attemptCount: 0,
    body,
    channel: connection.channel,
    connectionId: connection.id,
    connectionLabel: connection.label,
    createdAt: now,
    id: crypto.randomUUID(),
    updatedAt: now,
  };

  const queuedPosts = await loadQueuedPosts(db);
  queuedPosts.push(queuedPost);
  await saveQueuedPosts(db, queuedPosts);
  return queuedPost;
}

export async function deleteQueuedPost(db: D1Database, queuedPostId: string): Promise<boolean> {
  const queuedPosts = await loadQueuedPosts(db);
  const filtered = queuedPosts.filter((post) => post.id !== queuedPostId);
  if (filtered.length === queuedPosts.length) {
    return false;
  }

  await saveQueuedPosts(db, filtered);
  return true;
}

export async function deleteQueuedPostsForConnection(db: D1Database, connectionId: string): Promise<number> {
  const queuedPosts = await loadQueuedPosts(db);
  const filtered = queuedPosts.filter((post) => post.connectionId !== connectionId);
  if (filtered.length === queuedPosts.length) {
    return 0;
  }

  await saveQueuedPosts(db, filtered);
  return queuedPosts.length - filtered.length;
}

export function countQueuedPostsPublishingToday(queuedPosts: QueuedPost[], schedules: ChannelPostingSchedule[], now: Date): number {
  const scheduleByChannel = new Map(schedules.map((schedule) => [schedule.channel, schedule]));
  const endOfDay = new Date(now.getTime());
  endOfDay.setUTCHours(23, 59, 59, 999);

  return queuedPosts.filter((post) => {
    const schedule = scheduleByChannel.get(post.channel);
    if (!schedule) {
      return false;
    }

    const nextOccurrence = getNextScheduleOccurrence(schedule, now);
    return (
      nextOccurrence.getUTCFullYear() === now.getUTCFullYear() &&
      nextOccurrence.getUTCMonth() === now.getUTCMonth() &&
      nextOccurrence.getUTCDate() === now.getUTCDate() &&
      nextOccurrence.getTime() <= endOfDay.getTime()
    );
  }).length;
}

export function getQueuedPostNextOccurrence(post: QueuedPost, schedules: ChannelPostingSchedule[], now: Date): Date | null {
  const schedule = schedules.find((candidate) => candidate.channel === post.channel);
  if (!schedule) {
    return null;
  }

  return getNextScheduleOccurrence(schedule, now);
}

export async function publishDueQueuedPosts(
  db: D1Database,
  env: Pick<Env, "APP_ENCRYPTION_SECRET" | "DB" | "SESSION_SECRET">,
  options: {
    now?: Date;
    publishPost?: typeof publishChannelPost;
  } = {},
): Promise<QueuePublishResult> {
  const now = options.now || new Date();
  const schedules = await loadPostingSchedules(db);
  const dueChannels = new Set(findChannelsForTime(schedules, now));
  if (dueChannels.size === 0) {
    return { failed: 0, published: 0, skipped: true };
  }

  const queuedPosts = await loadQueuedPosts(db);
  if (queuedPosts.length === 0) {
    return { failed: 0, published: 0, skipped: true };
  }

  const publishingConnections = await listPublishingChannelConnections(db);
  const connectionsById = new Map(publishingConnections.map((connection) => [connection.id, connection]));
  const encryptionSecret = resolveAppEncryptionSecret(env);
  const publishPost = options.publishPost || publishChannelPost;

  const candidates = selectDueQueuedPosts(queuedPosts, dueChannels, connectionsById);
  if (candidates.length === 0) {
    return { failed: 0, published: 0, skipped: true };
  }

  let published = 0;
  let failed = 0;
  const queuedPostsById = new Map(queuedPosts.map((post) => [post.id, { ...post }]));

  for (const post of candidates) {
    const connection = connectionsById.get(post.connectionId);
    if (!connection) {
      continue;
    }

    try {
      const accessToken = await loadEncryptedSecret(db, connection.accessTokenSecretKey, encryptionSecret);
      if (!accessToken) {
        throw new Error("The saved access token is unavailable.");
      }

      const refreshToken = connection.refreshTokenSecretKey
        ? await loadEncryptedSecret(db, connection.refreshTokenSecretKey, encryptionSecret)
        : null;
      const outcome = await publishPost({
        accessToken,
        body: post.body,
        channel: post.channel,
        connection,
        refreshToken,
      });

      queuedPostsById.delete(post.id);
      await appendSentPostHistoryEntry(db, {
        body: post.body,
        channel: post.channel,
        connectionId: post.connectionId,
        connectionLabel: post.connectionLabel,
        id: post.id,
        outcome,
        project: "Queued publish",
        sentAt: now.toISOString(),
      });
      published += 1;
    } catch (error) {
      const queuedPost = queuedPostsById.get(post.id);
      if (!queuedPost) {
        continue;
      }

      queuedPost.attemptCount += 1;
      queuedPost.lastAttemptAt = now.toISOString();
      queuedPost.lastError = error instanceof Error ? error.message : String(error);
      queuedPost.updatedAt = now.toISOString();
      queuedPostsById.set(post.id, queuedPost);
      failed += 1;
    }
  }

  await saveQueuedPosts(db, sortQueuedPosts(Array.from(queuedPostsById.values())));
  return {
    failed,
    published,
    skipped: published === 0 && failed === 0,
  };
}

export class QueueValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueueValidationError";
  }
}

function parseQueuedPost(value: unknown): QueuedPost | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<StoredQueuedPost>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.connectionId !== "string" ||
    typeof candidate.connectionLabel !== "string" ||
    typeof candidate.channel !== "string" ||
    typeof candidate.body !== "string" ||
    typeof candidate.createdAt !== "string" ||
    typeof candidate.updatedAt !== "string" ||
    typeof candidate.attemptCount !== "number"
  ) {
    return null;
  }

  if (candidate.channel !== "linkedin" && candidate.channel !== "x" && candidate.channel !== "bluesky") {
    return null;
  }

  return {
    attemptCount: candidate.attemptCount,
    body: candidate.body,
    channel: candidate.channel,
    connectionId: candidate.connectionId,
    connectionLabel: candidate.connectionLabel,
    createdAt: candidate.createdAt,
    id: candidate.id,
    lastAttemptAt: typeof candidate.lastAttemptAt === "string" ? candidate.lastAttemptAt : undefined,
    lastError: typeof candidate.lastError === "string" ? candidate.lastError : undefined,
    updatedAt: candidate.updatedAt,
  };
}

async function saveQueuedPosts(db: D1Database, queuedPosts: QueuedPost[]): Promise<void> {
  const stored: StoredQueuedPost[] = queuedPosts.map((post) => ({
    attemptCount: post.attemptCount,
    body: post.body,
    channel: post.channel,
    connectionId: post.connectionId,
    connectionLabel: post.connectionLabel,
    createdAt: post.createdAt,
    id: post.id,
    lastAttemptAt: post.lastAttemptAt,
    lastError: post.lastError,
    updatedAt: post.updatedAt,
  }));

  await db
    .prepare(
      "INSERT INTO app_state (state_key, value_json) VALUES (?, ?) ON CONFLICT(state_key) DO UPDATE SET value_json = excluded.value_json",
    )
    .bind(QUEUED_POSTS_STATE_KEY, JSON.stringify(stored))
    .run();
}

function selectDueQueuedPosts(
  queuedPosts: QueuedPost[],
  dueChannels: Set<ChannelConnection["channel"]>,
  connectionsById: Map<string, PublishingChannelConnection>,
): QueuedPost[] {
  const oldestByConnection = new Map<string, QueuedPost>();

  for (const post of sortQueuedPosts(queuedPosts)) {
    if (!dueChannels.has(post.channel)) {
      continue;
    }

    if (!connectionsById.has(post.connectionId)) {
      continue;
    }

    if (!oldestByConnection.has(post.connectionId)) {
      oldestByConnection.set(post.connectionId, post);
    }
  }

  return Array.from(oldestByConnection.values());
}

function sortQueuedPosts(queuedPosts: QueuedPost[]): QueuedPost[] {
  return [...queuedPosts].sort((left, right) => {
    const createdDiff = Date.parse(left.createdAt) - Date.parse(right.createdAt);
    if (Number.isFinite(createdDiff) && createdDiff !== 0) {
      return createdDiff;
    }

    return left.id.localeCompare(right.id);
  });
}
