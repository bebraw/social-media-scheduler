import { getChannelConstraint } from "../queue/constraints";
import { POSTING_SCHEDULE_WEEKDAYS, type ChannelPostingSchedule } from "../schedule";
import { renderButton, renderPanel, renderSectionHeader } from "./components";
import { escapeHtml } from "./shared";

interface PostingSchedulePanelOptions {
  canEdit: boolean;
  error?: string;
  saved?: boolean;
  schedules: ChannelPostingSchedule[];
}

export function renderPostingSchedulePanel({ canEdit, error, saved, schedules }: PostingSchedulePanelOptions): string {
  return renderPanel(`
    ${renderSectionHeader({
      className: "items-start",
      description:
        schedules.length > 0
          ? "Set the weekly UTC posting window for each configured provider in 15-minute increments. Each saved schedule is stored as a Cloudflare cron expression."
          : "Posting schedules appear after at least one channel connection is configured in Settings.",
      title: "Posting schedule",
    })}
    ${
      saved
        ? '<p class="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Posting schedule saved.</p>'
        : ""
    }
    ${error ? `<p class="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">${escapeHtml(error)}</p>` : ""}
    ${
      schedules.length === 0
        ? '<p class="mt-5 rounded-xl border border-dashed border-app-line bg-app-canvas/50 px-4 py-4 text-sm leading-6 text-app-text-soft">Add a channel connection in Settings before editing the posting schedule.</p>'
        : `<form class="mt-5 grid gap-4" method="post" action="/posting-schedule">
      ${schedules.map((schedule) => renderPostingScheduleCard(schedule, canEdit)).join("")}
      <div class="flex flex-col gap-3 border-t border-app-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-sm leading-6 text-app-text-soft">These saved schedules now drive the production publishing poller directly. Use 15-minute UTC increments here and keep the fixed Worker cron triggers in deployment config.</p>
        ${
          canEdit
            ? renderButton({ label: "Save posting schedule", type: "submit", variant: "primary" })
            : '<p class="text-sm font-medium text-app-text-soft">Readonly users cannot change posting schedules.</p>'
        }
      </div>
    </form>`
    }
  `);
}

function renderPostingScheduleCard(schedule: ChannelPostingSchedule, canEdit: boolean): string {
  const channel = getChannelConstraint(schedule.channel);
  const disabledAttributes = canEdit ? "" : " disabled";

  return `<section class="rounded-xl border border-app-line bg-app-canvas/40 p-4" data-posting-schedule-card="${schedule.channel}">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 class="text-base font-semibold tracking-[-0.02em] text-app-text">${escapeHtml(channel.name)}</h3>
        <p class="mt-1 text-sm leading-6 text-app-text-soft">${escapeHtml(channel.notes)}</p>
      </div>
      <code class="rounded-lg border border-app-line bg-white px-3 py-2 text-xs font-semibold text-app-text-soft" data-posting-cron="${schedule.channel}">${escapeHtml(
        schedule.cron,
      )}</code>
    </div>
    <div class="mt-4 grid gap-4 lg:grid-cols-[1.8fr_0.9fr]">
      <fieldset>
        <legend class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">Days</legend>
        <div class="mt-3 flex flex-wrap gap-2">
          ${POSTING_SCHEDULE_WEEKDAYS.map((weekday) => renderWeekdayOption(schedule, weekday.id, weekday.label, canEdit)).join("")}
        </div>
      </fieldset>
      <label class="grid gap-2 text-sm font-medium">
        <span>UTC time</span>
        <input class="rounded-xl border border-app-line bg-white px-4 py-3 text-sm text-app-text focus:border-app-accent focus:outline-none focus:ring-2 focus:ring-app-accent/10 disabled:cursor-not-allowed disabled:bg-app-canvas disabled:text-app-text-soft" type="time" name="${schedule.channel}-time" value="${escapeHtml(
          schedule.time,
        )}" step="900" aria-label="${escapeHtml(channel.name)} UTC time"${disabledAttributes}>
      </label>
    </div>
  </section>`;
}

function renderWeekdayOption(schedule: ChannelPostingSchedule, weekday: string, label: string, canEdit: boolean): string {
  const channel = getChannelConstraint(schedule.channel);
  const disabledAttributes = canEdit ? "" : " disabled";
  const checkedAttributes = schedule.weekdays.includes(weekday as ChannelPostingSchedule["weekdays"][number]) ? " checked" : "";

  return `<label class="inline-flex items-center gap-2 rounded-full border border-app-line bg-white px-3 py-2 text-sm text-app-text">
    <input class="size-4 rounded border-app-line text-app-accent focus:ring-app-accent/20" type="checkbox" name="${schedule.channel}-weekday" value="${weekday}" aria-label="${escapeHtml(
      `${channel.name} ${label}`,
    )}"${checkedAttributes}${disabledAttributes}>
    <span>${escapeHtml(label)}</span>
  </label>`;
}
