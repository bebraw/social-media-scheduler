import type { D1Database } from "../db-core";
import { CHANNEL_CONSTRAINTS, type QueueChannel } from "../queue/constraints";

const POSTING_SCHEDULE_STATE_KEY = "posting_schedules_v1";

interface AppStateRow {
  value_json: string;
}

export const POSTING_SCHEDULE_WEEKDAYS = [
  { id: "MON", label: "Mon" },
  { id: "TUE", label: "Tue" },
  { id: "WED", label: "Wed" },
  { id: "THU", label: "Thu" },
  { id: "FRI", label: "Fri" },
  { id: "SAT", label: "Sat" },
  { id: "SUN", label: "Sun" },
] as const;

export type PostingScheduleWeekday = (typeof POSTING_SCHEDULE_WEEKDAYS)[number]["id"];

export interface ChannelPostingSchedule {
  channel: QueueChannel;
  cron: string;
  time: string;
  weekdays: PostingScheduleWeekday[];
}

interface StoredPostingSchedule {
  channel: QueueChannel;
  cron: string;
}

const DEFAULT_CRONS: Record<QueueChannel, string> = {
  linkedin: "0 9 * * MON,WED,FRI",
  x: "30 16 * * MON,TUE,WED,THU,FRI",
  bluesky: "15 11 * * TUE,THU,SAT",
};

export class PostingScheduleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PostingScheduleValidationError";
  }
}

export function getDefaultPostingSchedules(): ChannelPostingSchedule[] {
  return CHANNEL_CONSTRAINTS.map((constraint) => buildScheduleFromStored({ channel: constraint.id, cron: DEFAULT_CRONS[constraint.id] })!);
}

export async function loadPostingSchedules(db: D1Database): Promise<ChannelPostingSchedule[]> {
  const row = await db
    .prepare("SELECT value_json FROM app_state WHERE state_key = ?")
    .bind(POSTING_SCHEDULE_STATE_KEY)
    .first<AppStateRow>();

  if (!row?.value_json) {
    return getDefaultPostingSchedules();
  }

  try {
    const parsed = JSON.parse(row.value_json);
    const schedules = Array.isArray(parsed) ? parsed.map((entry) => buildScheduleFromStored(entry)).filter((entry) => entry !== null) : [];
    return buildCompleteScheduleList(schedules);
  } catch {
    return getDefaultPostingSchedules();
  }
}

export async function savePostingSchedules(db: D1Database, schedules: ChannelPostingSchedule[]): Promise<void> {
  const normalized = buildCompleteScheduleList(schedules);
  const stored: StoredPostingSchedule[] = normalized.map((schedule) => ({
    channel: schedule.channel,
    cron: schedule.cron,
  }));

  await db
    .prepare(
      "INSERT INTO app_state (state_key, value_json) VALUES (?, ?) ON CONFLICT(state_key) DO UPDATE SET value_json = excluded.value_json",
    )
    .bind(POSTING_SCHEDULE_STATE_KEY, JSON.stringify(stored))
    .run();
}

export function buildPostingSchedule(input: { channel: QueueChannel; time: string; weekdays: string[] }): ChannelPostingSchedule {
  const time = normalizeTime(input.time);
  const weekdays = normalizeWeekdays(input.weekdays);

  if (!time) {
    throw new PostingScheduleValidationError(`Choose a valid UTC time for ${getChannelLabel(input.channel)}.`);
  }

  if (weekdays.length === 0) {
    throw new PostingScheduleValidationError(`Choose at least one posting day for ${getChannelLabel(input.channel)}.`);
  }

  return {
    channel: input.channel,
    cron: buildCloudflareCron({ time, weekdays }),
    time,
    weekdays,
  };
}

export function buildCloudflareCron(input: { time: string; weekdays: string[] }): string {
  const time = normalizeTime(input.time);
  const weekdays = normalizeWeekdays(input.weekdays);

  if (!time) {
    throw new PostingScheduleValidationError("Posting schedules require a valid UTC time.");
  }

  if (weekdays.length === 0) {
    throw new PostingScheduleValidationError("Posting schedules require at least one weekday.");
  }

  const [hour, minute] = time.split(":");
  return `${Number(minute)} ${Number(hour)} * * ${weekdays.join(",")}`;
}

export function findChannelsForCron(schedules: ChannelPostingSchedule[], cron: string): QueueChannel[] {
  const normalized = normalizeCron(cron);
  if (!normalized) {
    return [];
  }

  return schedules.filter((schedule) => schedule.cron === normalized).map((schedule) => schedule.channel);
}

export function findChannelsForTime(schedules: ChannelPostingSchedule[], date: Date): QueueChannel[] {
  return schedules.filter((schedule) => isScheduleDueAt(schedule, date)).map((schedule) => schedule.channel);
}

export function isScheduleDueAt(schedule: ChannelPostingSchedule, date: Date): boolean {
  return schedule.weekdays.includes(getUtcWeekday(date)) && schedule.time === formatUtcTime(date);
}

export function getNextScheduleOccurrence(schedule: ChannelPostingSchedule, fromDate: Date): Date {
  for (let offset = 0; offset < 14; offset += 1) {
    const candidate = new Date(fromDate.getTime());
    candidate.setUTCDate(candidate.getUTCDate() + offset);
    candidate.setUTCHours(0, 0, 0, 0);

    const weekday = getUtcWeekday(candidate);
    if (!schedule.weekdays.includes(weekday)) {
      continue;
    }

    const [hourText, minuteText] = schedule.time.split(":");
    candidate.setUTCHours(Number(hourText || "0"), Number(minuteText || "0"), 0, 0);
    if (candidate.getTime() > fromDate.getTime()) {
      return candidate;
    }
  }

  const [fallbackHourText, fallbackMinuteText] = schedule.time.split(":");
  const fallback = new Date(fromDate.getTime());
  fallback.setUTCDate(fallback.getUTCDate() + 7);
  fallback.setUTCHours(Number(fallbackHourText || "0"), Number(fallbackMinuteText || "0"), 0, 0);
  return fallback;
}

function buildCompleteScheduleList(schedules: ChannelPostingSchedule[]): ChannelPostingSchedule[] {
  const byChannel = new Map(schedules.map((schedule) => [schedule.channel, schedule]));

  return CHANNEL_CONSTRAINTS.map((constraint) => byChannel.get(constraint.id) || getDefaultPostingSchedule(constraint.id));
}

function buildScheduleFromStored(value: unknown): ChannelPostingSchedule | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<StoredPostingSchedule>;
  if (!isQueueChannel(candidate.channel) || typeof candidate.cron !== "string") {
    return null;
  }

  const normalizedCron = normalizeCron(candidate.cron);
  if (!normalizedCron) {
    return null;
  }

  const parsed = parseCloudflareCron(normalizedCron);
  if (!parsed) {
    return null;
  }

  return {
    channel: candidate.channel,
    cron: normalizedCron,
    time: parsed.time,
    weekdays: parsed.weekdays,
  };
}

function getDefaultPostingSchedule(channel: QueueChannel): ChannelPostingSchedule {
  return buildScheduleFromStored({ channel, cron: DEFAULT_CRONS[channel] })!;
}

function parseCloudflareCron(cron: string): { time: string; weekdays: PostingScheduleWeekday[] } | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    return null;
  }

  const [minuteField, hourField, dayOfMonthField, monthField, dayOfWeekField] = parts;
  if (dayOfMonthField !== "*" || monthField !== "*") {
    return null;
  }

  const minute = Number.parseInt(minuteField || "", 10);
  const hour = Number.parseInt(hourField || "", 10);
  if (!Number.isInteger(minute) || !Number.isInteger(hour) || minute < 0 || minute > 59 || hour < 0 || hour > 23) {
    return null;
  }

  const weekdays = normalizeWeekdays((dayOfWeekField || "").split(","));
  if (weekdays.length === 0) {
    return null;
  }

  return {
    time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    weekdays,
  };
}

function normalizeCron(value: string): string | null {
  const parsed = parseCloudflareCron(value);
  return parsed ? buildCloudflareCron(parsed) : null;
}

function normalizeTime(value: string): string | null {
  const normalized = value.trim();
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(normalized);
  return match ? `${match[1]}:${match[2]}` : null;
}

function normalizeWeekdays(values: string[]): PostingScheduleWeekday[] {
  const allowed = new Set<PostingScheduleWeekday>(POSTING_SCHEDULE_WEEKDAYS.map((day) => day.id));
  const unique = new Set<PostingScheduleWeekday>();

  for (const value of values) {
    const normalized = value.trim().toUpperCase() as PostingScheduleWeekday;
    if (allowed.has(normalized)) {
      unique.add(normalized);
    }
  }

  return POSTING_SCHEDULE_WEEKDAYS.map((day) => day.id).filter((day) => unique.has(day));
}

function isQueueChannel(value: unknown): value is QueueChannel {
  return value === "linkedin" || value === "x" || value === "bluesky";
}

function getChannelLabel(channel: QueueChannel): string {
  return CHANNEL_CONSTRAINTS.find((constraint) => constraint.id === channel)?.name || channel;
}

function getUtcWeekday(date: Date): PostingScheduleWeekday {
  const index = date.getUTCDay();
  const ordered: PostingScheduleWeekday[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  return ordered[index] || "MON";
}

function formatUtcTime(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}
