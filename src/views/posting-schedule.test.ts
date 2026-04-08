import { describe, expect, it } from "vitest";
import { getDefaultPostingSchedules } from "../schedule";
import { renderPostingSchedulePanel } from "./posting-schedule";

describe("renderPostingSchedulePanel", () => {
  it("renders the per-channel editor with Cloudflare cron output", () => {
    const html = renderPostingSchedulePanel({
      canEdit: true,
      schedules: getDefaultPostingSchedules(),
    });

    expect(html).toContain("Posting schedule");
    expect(html).toContain("Cloudflare cron expression");
    expect(html).toContain("LinkedIn UTC time");
    expect(html).toContain("15-minute increments");
    expect(html).toContain('data-posting-cron="linkedin"');
    expect(html).toContain("Save posting schedule");
  });

  it("renders notices for saved and error states", () => {
    const html = renderPostingSchedulePanel({
      canEdit: true,
      error: "Choose at least one posting day for LinkedIn.",
      saved: true,
      schedules: getDefaultPostingSchedules(),
    });

    expect(html).toContain("Posting schedule saved.");
    expect(html).toContain("Choose at least one posting day for LinkedIn.");
  });
});
