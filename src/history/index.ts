import type { D1Database } from "../db-core";
import type { QueueChannel } from "../queue/constraints";

const SENT_POST_HISTORY_STATE_KEY = "sent_post_history_v1";

export interface SentPostHistoryEntry {
  id: string;
  channel: QueueChannel;
  project: string;
  body: string;
  sentAt: string;
  outcome: string;
}

interface AppStateRow {
  value_json: string;
}

const FALLBACK_SENT_POST_HISTORY: SentPostHistoryEntry[] = [
  {
    id: "history-linkedin-foundation",
    channel: "linkedin",
    project: "Scheduler Foundation",
    body: "Shipped the first authenticated scheduler shell so private planning stays out of public demos while the publishing workflow is still forming.",
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
    body: "Started shaping the channel-specific queue so each draft can fit the cadence and tone of the platform instead of pretending every post is interchangeable.",
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

export async function loadSentPostHistory(db: D1Database): Promise<SentPostHistoryEntry[]> {
  const row = await db
    .prepare("SELECT value_json FROM app_state WHERE state_key = ?")
    .bind(SENT_POST_HISTORY_STATE_KEY)
    .first<AppStateRow>();

  if (!row?.value_json) {
    return FALLBACK_SENT_POST_HISTORY;
  }

  try {
    const parsed = JSON.parse(row.value_json);
    const entries = Array.isArray(parsed) ? parsed.map(parseSentPostHistoryEntry).filter((entry) => entry !== null) : [];
    return entries.length > 0 ? sortSentPostHistory(entries) : FALLBACK_SENT_POST_HISTORY;
  } catch {
    return FALLBACK_SENT_POST_HISTORY;
  }
}

function parseSentPostHistoryEntry(value: unknown): SentPostHistoryEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    !isQueueChannel(candidate.channel) ||
    typeof candidate.project !== "string" ||
    typeof candidate.body !== "string" ||
    typeof candidate.sentAt !== "string" ||
    typeof candidate.outcome !== "string"
  ) {
    return null;
  }

  return {
    id: candidate.id,
    channel: candidate.channel,
    project: candidate.project,
    body: candidate.body,
    sentAt: candidate.sentAt,
    outcome: candidate.outcome,
  };
}

function isQueueChannel(value: unknown): value is QueueChannel {
  return value === "linkedin" || value === "x" || value === "bluesky";
}

function sortSentPostHistory(entries: SentPostHistoryEntry[]): SentPostHistoryEntry[] {
  return [...entries].sort((left, right) => right.sentAt.localeCompare(left.sentAt));
}
