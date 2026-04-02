import { renderPill } from "./components";
import type { SentPostHistoryEntry } from "../history";
import type { QueueChannel } from "../queue/constraints";
import { escapeHtml } from "./shared";

export function renderHistoryFilters(sentHistory: SentPostHistoryEntry[]): string {
  return [
    { id: "all", label: "All channels", count: sentHistory.length },
    ...(
      [
        { id: "linkedin", label: "LinkedIn" },
        { id: "x", label: "X" },
        { id: "bluesky", label: "Bluesky" },
      ] as const
    ).map((channel) => ({
      id: channel.id,
      label: channel.label,
      count: sentHistory.filter((entry) => entry.channel === channel.id).length,
    })),
  ]
    .map(
      (filter, index) => `<button class="${buildHistoryFilterClass(index === 0)}" type="button" aria-pressed="${
        index === 0 ? "true" : "false"
      }" data-history-filter="${escapeHtml(filter.id)}">
        <span>${escapeHtml(filter.label)}</span>
        <span class="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-app-text">${escapeHtml(String(filter.count))}</span>
      </button>`,
    )
    .join("");
}

export function renderHistoryCards(sentHistory: SentPostHistoryEntry[]): string {
  return sentHistory
    .map(
      (entry) => `<article class="rounded-xl border border-app-line bg-white p-5" data-history-card data-history-channel="${escapeHtml(
        entry.channel,
      )}">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              ${renderPill(formatChannelLabel(entry.channel), { tone: "quiet-accent" })}
              <span class="text-xs font-medium uppercase tracking-[0.12em] text-app-text-soft">${escapeHtml(entry.project)}</span>
            </div>
            <p class="mt-3 max-w-2xl text-sm leading-6 text-app-text">${escapeHtml(entry.body)}</p>
          </div>
          <div class="sm:max-w-56 sm:text-right">
            <p class="text-sm font-medium text-app-text">${escapeHtml(formatHistoryTimestamp(entry.sentAt))}</p>
            <p class="mt-1 text-sm text-app-text-soft">${escapeHtml(entry.outcome)}</p>
          </div>
        </div>
      </article>`,
    )
    .join("");
}

export function formatChannelLabel(channel: QueueChannel): string {
  if (channel === "linkedin") return "LinkedIn";
  if (channel === "x") return "X";
  return "Bluesky";
}

function buildHistoryFilterClass(isActive: boolean): string {
  const base =
    "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/20";
  return isActive
    ? `${base} border-app-accent bg-app-accent/10 text-app-accent-strong`
    : `${base} border-app-line bg-app-canvas/50 text-app-text hover:bg-app-canvas`;
}

function formatHistoryTimestamp(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(timestamp));
}
