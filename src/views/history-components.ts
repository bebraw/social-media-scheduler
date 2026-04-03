import type { ChannelConnection } from "../channels";
import { renderPill } from "./components";
import type { SentPostHistoryEntry } from "../history";
import type { QueueChannel } from "../queue/constraints";
import { escapeHtml } from "./shared";

export function renderHistoryFilters(connections: ChannelConnection[], sentHistory: SentPostHistoryEntry[]): string {
  const filters = [
    { id: "all", label: "All channels", count: sentHistory.length },
    ...connections.map((connection) => ({
      id: buildConnectionFilterId(connection.id),
      label: connection.label,
      count: sentHistory.filter((entry) => entry.connectionId === connection.id).length,
    })),
    ...listLegacyHistoryChannels(connections, sentHistory).map((channel) => ({
      id: buildLegacyChannelFilterId(channel),
      label: formatChannelLabel(channel),
      count: sentHistory.filter((entry) => !entry.connectionId && entry.channel === channel).length,
    })),
  ];

  return filters
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
      (entry) => `<article class="rounded-xl border border-app-line bg-white p-5" data-history-card data-history-filter-key="${escapeHtml(
        resolveHistoryFilterKey(entry),
      )}">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              ${renderPill(formatChannelLabel(entry.channel), { tone: "quiet-accent" })}
              ${entry.connectionLabel ? renderPill(entry.connectionLabel) : ""}
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

function resolveHistoryFilterKey(entry: SentPostHistoryEntry): string {
  return entry.connectionId ? buildConnectionFilterId(entry.connectionId) : buildLegacyChannelFilterId(entry.channel);
}

function listLegacyHistoryChannels(connections: ChannelConnection[], sentHistory: SentPostHistoryEntry[]): QueueChannel[] {
  const configuredProviders = new Set(connections.map((connection) => connection.channel));
  const legacyProviders = new Set<QueueChannel>();

  for (const entry of sentHistory) {
    if (!entry.connectionId && !configuredProviders.has(entry.channel)) {
      legacyProviders.add(entry.channel);
    }
  }

  const orderedProviders: QueueChannel[] = ["linkedin", "x", "bluesky"];
  return orderedProviders.filter((channel) => legacyProviders.has(channel));
}

function buildConnectionFilterId(connectionId: string): string {
  return `connection:${connectionId}`;
}

function buildLegacyChannelFilterId(channel: QueueChannel): string {
  return `channel:${channel}`;
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
