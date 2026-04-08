import { describe, expect, it } from "vitest";
import {
  buildCloudflareCron,
  buildPostingSchedule,
  findChannelsForTime,
  findChannelsForCron,
  getDefaultPostingSchedules,
  getNextScheduleOccurrence,
  isScheduleDueAt,
  loadPostingSchedules,
  PostingScheduleValidationError,
  savePostingSchedules,
} from "./index";
import { createTestDatabase, seedStateEntry } from "../test-support";

describe("posting schedules", () => {
  it("loads the default per-channel schedule set", async () => {
    const db = createTestDatabase();

    const schedules = await loadPostingSchedules(db);

    expect(schedules).toEqual(getDefaultPostingSchedules());
  });

  it("builds normalized Cloudflare cron strings from weekdays and time", () => {
    expect(buildCloudflareCron({ time: "09:00", weekdays: ["WED", "MON", "WED"] })).toBe("0 9 * * MON,WED");
  });

  it("rejects invalid schedule inputs", () => {
    expect(() => buildPostingSchedule({ channel: "linkedin", time: "9:00", weekdays: ["MON"] })).toThrow(PostingScheduleValidationError);
    expect(() => buildPostingSchedule({ channel: "linkedin", time: "09:00", weekdays: [] })).toThrow(PostingScheduleValidationError);
  });

  it("persists schedule changes in app_state", async () => {
    const db = createTestDatabase();
    const nextSchedules = [
      buildPostingSchedule({ channel: "linkedin", time: "10:45", weekdays: ["TUE", "THU"] }),
      buildPostingSchedule({ channel: "x", time: "16:30", weekdays: ["MON", "WED", "FRI"] }),
      buildPostingSchedule({ channel: "bluesky", time: "11:15", weekdays: ["SAT"] }),
    ];

    await savePostingSchedules(db, nextSchedules);

    await expect(loadPostingSchedules(db)).resolves.toEqual(nextSchedules);
  });

  it("falls back to defaults when stored schedules are invalid", async () => {
    const db = createTestDatabase();
    seedStateEntry(db, "posting_schedules_v1", [{ channel: "linkedin", cron: "bad cron" }]);

    await expect(loadPostingSchedules(db)).resolves.toEqual(getDefaultPostingSchedules());
  });

  it("matches channels against normalized cron expressions", () => {
    const schedules = [
      buildPostingSchedule({ channel: "linkedin", time: "10:45", weekdays: ["THU", "TUE"] }),
      buildPostingSchedule({ channel: "x", time: "16:30", weekdays: ["MON", "TUE", "WED", "THU", "FRI"] }),
      buildPostingSchedule({ channel: "bluesky", time: "11:15", weekdays: ["SAT"] }),
    ];

    expect(findChannelsForCron(schedules, "45 10 * * TUE,THU")).toEqual(["linkedin"]);
    expect(findChannelsForCron(schedules, "bad cron")).toEqual([]);
  });

  it("finds due channels for the current UTC slot", () => {
    const schedules = [
      buildPostingSchedule({ channel: "linkedin", time: "10:30", weekdays: ["MON"] }),
      buildPostingSchedule({ channel: "x", time: "10:45", weekdays: ["MON"] }),
      buildPostingSchedule({ channel: "bluesky", time: "10:30", weekdays: ["TUE"] }),
    ];

    expect(findChannelsForTime(schedules, new Date("2026-04-06T10:30:00.000Z"))).toEqual(["linkedin"]);
  });

  it("checks whether an individual schedule is due", () => {
    const schedule = buildPostingSchedule({ channel: "linkedin", time: "10:30", weekdays: ["MON", "WED"] });

    expect(isScheduleDueAt(schedule, new Date("2026-04-06T10:30:00.000Z"))).toBe(true);
    expect(isScheduleDueAt(schedule, new Date("2026-04-06T10:45:00.000Z"))).toBe(false);
    expect(isScheduleDueAt(schedule, new Date("2026-04-07T10:30:00.000Z"))).toBe(false);
  });

  it("finds the next weekly occurrence after the current slot", () => {
    const schedule = buildPostingSchedule({ channel: "linkedin", time: "10:30", weekdays: ["MON", "WED"] });

    expect(getNextScheduleOccurrence(schedule, new Date("2026-04-06T09:00:00.000Z")).toISOString()).toBe("2026-04-06T10:30:00.000Z");
    expect(getNextScheduleOccurrence(schedule, new Date("2026-04-06T10:30:00.000Z")).toISOString()).toBe("2026-04-08T10:30:00.000Z");
  });
});
