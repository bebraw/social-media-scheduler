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

export async function loadSentPostHistory(db: D1Database): Promise<SentPostHistoryEntry[]> {
  const row = await db
    .prepare("SELECT value_json FROM app_state WHERE state_key = ?")
    .bind(SENT_POST_HISTORY_STATE_KEY)
    .first<AppStateRow>();

  if (!row?.value_json) {
    return [];
  }

  try {
    const parsed = JSON.parse(row.value_json);
    const entries = Array.isArray(parsed) ? parsed.map(parseSentPostHistoryEntry).filter((entry) => entry !== null) : [];
    return sortSentPostHistory(entries);
  } catch {
    return [];
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
