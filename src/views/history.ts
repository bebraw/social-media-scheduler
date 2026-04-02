import type { SentPostHistoryEntry } from "../history";
import type { QueueChannel } from "../queue/constraints";
import { escapeHtml, renderSessionPanel, renderWorkspaceNav } from "./shared";
import { HOME_PAGE_SCRIPT } from "./home-ui";

const pageTitle = "Sent History";
const pageDescription = "Inspect previously sent posts per channel in a dedicated workspace.";

interface HistoryPageOptions {
  demoAvailable: boolean;
  sentHistory: SentPostHistoryEntry[];
  user: {
    name: string;
    role: string;
  };
}

export function renderHistoryPage({ demoAvailable, sentHistory, user }: HistoryPageOptions): string {
  const historyFilterCounts = [
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
  ];
  const historyFiltersMarkup = historyFilterCounts
    .map(
      (filter, index) => `<button class="${buildHistoryFilterClass(index === 0)}" type="button" aria-pressed="${
        index === 0 ? "true" : "false"
      }" data-history-filter="${escapeHtml(filter.id)}">
        <span>${escapeHtml(filter.label)}</span>
        <span class="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-app-text">${escapeHtml(String(filter.count))}</span>
      </button>`,
    )
    .join("");
  const sentHistoryMarkup = sentHistory
    .map(
      (entry) => `<article class="rounded-xl border border-app-line bg-white p-5" data-history-card data-history-channel="${escapeHtml(
        entry.channel,
      )}">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded-full bg-app-canvas px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-app-accent-strong">${escapeHtml(
                channelLabel(entry.channel),
              )}</span>
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

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(pageTitle)} | Social Media Scheduler</title>
    <link rel="stylesheet" href="/styles.css">
    <script type="module" src="/home.js"></script>
  </head>
  <body class="min-h-screen bg-app-canvas text-app-text antialiased">
    <main class="mx-auto w-[min(72rem,calc(100vw-2rem))] py-10 sm:py-14">
      <article class="overflow-hidden rounded-2xl border border-app-line bg-app-surface shadow-panel">
        <section class="border-b border-app-line px-5 py-8 sm:px-8 sm:py-10">
          <div class="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div class="max-w-3xl">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-app-text-soft">Social Media Scheduler</p>
              <h1 class="mt-3 text-4xl leading-none font-semibold tracking-[-0.04em] sm:text-5xl">${escapeHtml(pageTitle)}</h1>
              <p class="mt-4 max-w-2xl text-base leading-7 text-app-text-soft sm:text-lg">${escapeHtml(pageDescription)}</p>
              ${renderWorkspaceNav({ activePath: "/history", demoAvailable })}
            </div>
            ${renderSessionPanel(user)}
          </div>
        </section>
        <div class="grid gap-4 px-5 py-5 sm:px-8 sm:py-8 lg:grid-cols-[0.8fr_1.2fr]">
          <section class="grid gap-4">
            <section class="rounded-xl border border-app-line bg-white p-6">
              <h2 class="text-lg font-semibold tracking-[-0.02em]">Filters</h2>
              <p class="mt-3 text-sm leading-6 text-app-text-soft">Filter by channel to inspect recent tone, cadence, and output patterns without leaving the scheduler.</p>
            </section>
            <section class="rounded-xl border border-app-line bg-white p-6">
              <h2 class="text-lg font-semibold tracking-[-0.02em]">Coverage</h2>
              <div class="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                <div class="rounded-xl border border-app-line bg-app-canvas/60 px-4 py-3">
                  <p class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">Tracked posts</p>
                  <p class="mt-2 text-2xl font-semibold text-app-text" data-history-count>${escapeHtml(String(sentHistory.length))}</p>
                </div>
                <div class="rounded-xl border border-app-line bg-app-canvas/60 px-4 py-3">
                  <p class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">Channels</p>
                  <p class="mt-2 text-2xl font-semibold text-app-text">3</p>
                </div>
                <div class="rounded-xl border border-app-line bg-app-canvas/60 px-4 py-3">
                  <p class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">Home</p>
                  <a class="mt-2 inline-flex text-sm font-semibold text-app-accent-strong underline decoration-app-accent/25 underline-offset-4" href="/">Return to workspace</a>
                </div>
              </div>
            </section>
          </section>
          <section class="rounded-xl border border-app-line bg-white p-6">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 class="text-lg font-semibold tracking-[-0.02em]">Channel history</h2>
                <p class="mt-1 max-w-2xl text-sm leading-6 text-app-text-soft">Review sent posts by channel to compare tone, cadence, and recent output.</p>
              </div>
              <p class="text-sm font-medium text-app-text-soft">Inspect by channel</p>
            </div>
            <div class="mt-5 flex flex-wrap gap-2" aria-label="Sent history filters">
              ${historyFiltersMarkup}
            </div>
            <div class="mt-5 grid gap-3" data-sent-history-list>${sentHistoryMarkup}</div>
            <p class="mt-4${sentHistory.length === 0 ? "" : " hidden"} rounded-xl border border-dashed border-app-line bg-app-canvas/50 px-4 py-3 text-sm text-app-text-soft" data-history-empty>No sent posts are available yet.</p>
          </section>
        </div>
      </article>
    </main>
  </body>
</html>`;
}

export { HOME_PAGE_SCRIPT };

function buildHistoryFilterClass(isActive: boolean): string {
  const base =
    "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/20";
  return isActive
    ? `${base} border-app-accent bg-app-accent/10 text-app-accent-strong`
    : `${base} border-app-line bg-app-canvas/50 text-app-text hover:bg-app-canvas`;
}

function channelLabel(channel: QueueChannel): string {
  if (channel === "linkedin") return "LinkedIn";
  if (channel === "x") return "X";
  return "Bluesky";
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
