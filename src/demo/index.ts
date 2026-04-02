import type { Env } from "../app-env";
import type { D1Database } from "../db-core";
import type { SentPostHistoryEntry } from "../history";
import { parsePostImageAttachment, type PostImageAttachment } from "../media";
import { describeUsage, type QueueChannel } from "../queue/constraints";

const DEMO_QUEUE_STATE_KEY = "demo_mode_queue_v1";

export interface DemoDraft {
  id: QueueChannel;
  subtitle: string;
  accent: string;
  content: string;
  slot: string;
}

export interface DemoQueuedPost {
  attachments: PostImageAttachment[];
  id: string;
  channel: QueueChannel;
  project: string;
  time: string;
  body: string;
  status: string;
}

interface AppStateRow {
  value_json: string;
}

const DEMO_DRAFTS: DemoDraft[] = [
  {
    id: "linkedin",
    subtitle: "Longer project update",
    accent: "Professional update",
    content:
      "Shipping a quieter but more useful improvement this week: the scheduler now keeps private planning, backups, and channel-specific writing in one place. Each draft stays tailored to the channel instead of forcing one message everywhere.",
    slot: "Tomorrow, 09:00",
  },
  {
    id: "x",
    subtitle: "Short post with tighter budget",
    accent: "Tight summary",
    content:
      "The scheduler now keeps LinkedIn, X, and Bluesky drafts separate so each post can match the channel instead of being squeezed into one shared format.",
    slot: "Today, 16:30",
  },
  {
    id: "bluesky",
    subtitle: "Short post with room for voice",
    accent: "Concise status post",
    content:
      "Keeping channel-specific drafts side by side makes it easier to keep the voice relaxed here while still staying aligned with the broader posting plan.",
    slot: "Thu, 11:15",
  },
];

const FALLBACK_DEMO_QUEUE: DemoQueuedPost[] = [
  {
    attachments: [],
    id: "demo-queued-x-1",
    channel: "x",
    project: "Scheduler Update",
    time: "Today, 16:30",
    body: "Built the first channel-specific queue flow so short updates can stay tight without squeezing the longer formats.",
    status: "Demo scheduled",
  },
  {
    attachments: [],
    id: "demo-queued-linkedin-1",
    channel: "linkedin",
    project: "Open Source Note",
    time: "Tomorrow, 09:00",
    body: "Writing up what changed in the worker auth setup and why the backup flow stays intentionally lightweight.",
    status: "Demo scheduled",
  },
  {
    attachments: [],
    id: "demo-queued-bluesky-1",
    channel: "bluesky",
    project: "Scheduler Plan",
    time: "Thu, 11:15",
    body: "Keeping the posting plan visible across channels makes it easier to space updates and keep the tone distinct.",
    status: "Demo scheduled",
  },
];

const DEMO_SENT_HISTORY: SentPostHistoryEntry[] = [
  {
    id: "history-linkedin-foundation",
    channel: "linkedin",
    project: "Scheduler Foundation",
    body: "Private planning now stays in one workspace, with authenticated access and channel-specific writing flows built into the daily routine.",
    sentAt: "2026-03-31T09:00:00.000Z",
    outcome: "Published",
  },
  {
    id: "history-x-auth",
    channel: "x",
    project: "Daily Build Log",
    body: "Wrapped the scheduler in local auth and kept the setup small enough to clone without dragging in a bigger app stack.",
    sentAt: "2026-03-30T16:30:00.000Z",
    outcome: "Published",
  },
  {
    id: "history-bluesky-queue",
    channel: "bluesky",
    project: "UI Notes",
    body: "Channel-specific drafting makes it easier to keep the cadence and tone of each platform distinct instead of treating every post as interchangeable.",
    sentAt: "2026-03-29T11:15:00.000Z",
    outcome: "Published",
  },
  {
    id: "history-x-backups",
    channel: "x",
    project: "Ops Note",
    body: "Automated R2 backups are in place now, which makes the scheduler safer to iterate on before the real publishing data starts to accumulate.",
    sentAt: "2026-03-28T08:45:00.000Z",
    outcome: "Published",
  },
  {
    id: "history-linkedin-architecture",
    channel: "linkedin",
    project: "Architecture Decision",
    body: "Documented why the scheduler keeps lightweight Cloudflare-native persistence instead of expanding into a heavier service layout too early.",
    sentAt: "2026-03-27T13:00:00.000Z",
    outcome: "Published",
  },
];

export function getDemoDrafts(): DemoDraft[] {
  return DEMO_DRAFTS;
}

export function getDemoSentHistory(): SentPostHistoryEntry[] {
  return DEMO_SENT_HISTORY;
}

export function isDemoModeConfigured(env: Env): boolean {
  const value = (env.DEMO_MODE || "").trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

export function canAccessDemo(request: Request, env: Env): boolean {
  if (!isDemoModeConfigured(env)) {
    return false;
  }

  const hostname = new URL(request.url).hostname;
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]";
}

export async function loadDemoQueuedPosts(db: D1Database): Promise<DemoQueuedPost[]> {
  const row = await db.prepare("SELECT value_json FROM app_state WHERE state_key = ?").bind(DEMO_QUEUE_STATE_KEY).first<AppStateRow>();

  if (!row?.value_json) {
    return FALLBACK_DEMO_QUEUE;
  }

  try {
    const parsed = JSON.parse(row.value_json);
    const entries = Array.isArray(parsed) ? parsed.map(parseDemoQueuedPost).filter((entry) => entry !== null) : [];
    return entries.length > 0 ? entries : FALLBACK_DEMO_QUEUE;
  } catch {
    return FALLBACK_DEMO_QUEUE;
  }
}

export async function scheduleDemoPost(
  db: D1Database,
  input: {
    attachments?: PostImageAttachment[];
    channel: QueueChannel;
    body: string;
    slot: string;
  },
): Promise<void> {
  const body = input.body.trim();
  const slot = input.slot.trim() || "Next available slot";

  if (!body) {
    throw new Error("Demo post body is required.");
  }

  const usage = describeUsage(input.channel, body);
  if (usage.state === "over") {
    throw new Error("Demo post exceeds the channel limit.");
  }

  const current = await loadDemoQueuedPosts(db);
  const next: DemoQueuedPost[] = [
    {
      attachments: input.attachments || [],
      id: `demo-queued-${input.channel}-${Date.now()}`,
      channel: input.channel,
      project: "Demo Mode",
      time: slot,
      body,
      status: "Demo scheduled",
    },
    ...current,
  ];

  await db
    .prepare(
      "INSERT INTO app_state (state_key, value_json) VALUES (?, ?) ON CONFLICT(state_key) DO UPDATE SET value_json = excluded.value_json",
    )
    .bind(DEMO_QUEUE_STATE_KEY, JSON.stringify(next))
    .run();
}

function parseDemoQueuedPost(value: unknown): DemoQueuedPost | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    !isQueueChannel(candidate.channel) ||
    typeof candidate.project !== "string" ||
    typeof candidate.time !== "string" ||
    typeof candidate.body !== "string" ||
    typeof candidate.status !== "string"
  ) {
    return null;
  }

  return {
    attachments: parsePostImageAttachmentList(candidate.attachments),
    id: candidate.id,
    channel: candidate.channel,
    project: candidate.project,
    time: candidate.time,
    body: candidate.body,
    status: candidate.status,
  };
}

function isQueueChannel(value: unknown): value is QueueChannel {
  return value === "linkedin" || value === "x" || value === "bluesky";
}

function parsePostImageAttachmentList(value: unknown): PostImageAttachment[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  const attachments = value.map((entry) => parsePostImageAttachment(entry)).filter((entry) => entry !== null);
  return attachments.length === value.length ? attachments : [];
}
