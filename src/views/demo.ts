import type { DemoDraft, DemoQueuedPost } from "../demo";
import type { SentPostHistoryEntry } from "../history";
import { CHANNEL_CONSTRAINTS, type QueueChannel } from "../queue/constraints";
import { escapeHtml, renderAttachmentComposer, renderPostImageAttachments, renderSessionPanel, renderWorkspaceNav } from "./shared";
import { HOME_PAGE_SCRIPT } from "./home-ui";

interface DemoPageOptions {
  drafts: DemoDraft[];
  queuedPosts: DemoQueuedPost[];
  sentHistory: SentPostHistoryEntry[];
  user: {
    name: string;
    role: string;
  };
}

export function renderDemoPage({ drafts, queuedPosts, sentHistory, user }: DemoPageOptions): string {
  const draftEntries = drafts.flatMap((draft) => {
    const constraint = CHANNEL_CONSTRAINTS.find((item) => item.id === draft.id);
    if (!constraint) {
      return [];
    }

    return [{ draft, constraint }];
  });

  const tabsMarkup = draftEntries
    .map(({ draft, constraint }, index) => {
      const isSelected = index === 0;
      return `<button class="${isSelected ? "bg-app-accent text-white shadow-sm" : "bg-white text-app-text hover:bg-app-canvas"} rounded-xl px-4 py-3 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/20" type="button" role="tab" id="demo-tab-${escapeHtml(
        draft.id,
      )}" aria-selected="${isSelected ? "true" : "false"}" aria-controls="demo-panel-${escapeHtml(
        draft.id,
      )}" tabindex="${isSelected ? "0" : "-1"}" data-channel-tab data-channel-id="${escapeHtml(draft.id)}">
        <span class="block text-xs font-semibold uppercase tracking-[0.12em] ${isSelected ? "text-white/70" : "text-app-text-soft"}">${escapeHtml(
          draft.accent,
        )}</span>
        <span class="mt-2 block text-base tracking-[-0.02em]">${escapeHtml(constraint.name)}</span>
      </button>`;
    })
    .join("");

  const panelsMarkup = draftEntries
    .map(({ draft, constraint }, index) => {
      const isSelected = index === 0;
      return `<section class="grid gap-5 rounded-xl border border-app-line bg-white p-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]" role="tabpanel" id="demo-panel-${escapeHtml(
        draft.id,
      )}" aria-labelledby="demo-tab-${escapeHtml(draft.id)}" ${isSelected ? "" : "hidden"} data-channel-column data-channel-id="${escapeHtml(
        draft.id,
      )}" data-channel-limit="${constraint.limit}">
        <form class="contents" method="post" action="/demo/queue" enctype="multipart/form-data">
          <input type="hidden" name="channel" value="${escapeHtml(draft.id)}">
          <div class="min-w-0">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">${escapeHtml(draft.accent)}</p>
                <h3 class="mt-2 text-xl font-semibold tracking-[-0.03em]">${escapeHtml(constraint.name)}</h3>
                <p class="mt-1 max-w-2xl text-sm leading-6 text-app-text-soft">${escapeHtml(draft.subtitle)}</p>
              </div>
              <span class="rounded-full bg-app-accent px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white" data-channel-status>Ready</span>
            </div>
            <label class="mt-5 grid gap-2 text-sm font-medium">
              <span>${escapeHtml(constraint.name)} demo post</span>
              <textarea class="min-h-80 rounded-xl border border-app-line bg-app-canvas/40 px-4 py-4 text-sm leading-6 text-app-text outline-none transition placeholder:text-app-text-soft/70 focus:border-app-accent focus:ring-2 focus:ring-app-accent/10" name="body" data-channel-input data-channel-limit="${constraint.limit}" aria-label="${escapeHtml(
                constraint.name,
              )} post copy">${escapeHtml(draft.content)}</textarea>
            </label>
          </div>
          <div class="grid gap-3 self-start">
            <div class="rounded-xl border border-app-line bg-app-canvas/60 px-4 py-3">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">Constraint</p>
                  <p class="mt-2 text-sm font-medium text-app-text">${escapeHtml(constraint.limitLabel)}</p>
                </div>
                <span class="text-sm font-medium text-app-text" data-channel-count>0 / ${escapeHtml(String(constraint.limit))}</span>
              </div>
            </div>
            <div class="rounded-xl border border-app-line bg-app-canvas/60 px-4 py-3">
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">Demo safety</p>
              <p class="mt-2 text-sm leading-6 text-app-text-soft">Scheduling here only updates local demo data. It does not call any external publishing service.</p>
            </div>
            ${renderAttachmentComposer({ channelName: constraint.name, serverMode: true })}
            <label class="grid gap-2 text-sm font-medium">
              <span>Queue slot</span>
              <select class="rounded-xl border border-app-line bg-white px-4 py-3 text-sm text-app-text outline-none transition focus:border-app-accent focus:ring-2 focus:ring-app-accent/10" name="slot" data-channel-slot aria-label="${escapeHtml(
                constraint.name,
              )} queue slot">
                <option>${escapeHtml(draft.slot)}</option>
                <option>Tomorrow, 09:00</option>
                <option>Tomorrow, 13:00</option>
              </select>
            </label>
            <div class="flex flex-wrap gap-3 pt-2">
              <button class="rounded-xl bg-app-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-app-accent-strong" type="submit" data-queue-button data-queue-mode="server">Schedule demo post</button>
            </div>
          </div>
        </form>
      </section>`;
    })
    .join("");

  const queueMarkup = queuedPosts
    .map(
      (post) => `<article class="rounded-xl border border-app-line bg-white p-5" data-queued-post-card>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded-full bg-app-canvas px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-app-accent-strong">${escapeHtml(
                channelLabel(post.channel),
              )}</span>
              <span class="text-xs font-medium uppercase tracking-[0.12em] text-app-text-soft">${escapeHtml(post.project)}</span>
            </div>
            <p class="mt-3 max-w-2xl text-sm leading-6 text-app-text">${escapeHtml(post.body)}</p>
            ${renderPostImageAttachments(post.attachments)}
          </div>
          <div class="sm:text-right">
            <p class="text-sm font-medium text-app-text">${escapeHtml(post.time)}</p>
            <p class="mt-1 text-sm text-app-text-soft">${escapeHtml(post.status)}</p>
          </div>
        </div>
      </article>`,
    )
    .join("");

  const historyFiltersMarkup = [
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

  const historyMarkup = sentHistory
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
    <title>Demo Mode | Social Media Scheduler</title>
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
              <h1 class="mt-3 text-4xl leading-none font-semibold tracking-[-0.04em] sm:text-5xl">Demo Mode</h1>
              <p class="mt-4 max-w-2xl text-base leading-7 text-app-text-soft sm:text-lg">Development-only sandbox with seeded data for walkthroughs, experiments, and safe scheduling practice.</p>
              ${renderWorkspaceNav({ activePath: "/demo", demoAvailable: true })}
            </div>
            ${renderSessionPanel(user)}
          </div>
        </section>
        <div class="grid gap-4 px-5 py-5 sm:px-8 sm:py-8">
          <section class="rounded-xl border border-app-line bg-amber-50 p-6">
            <h2 class="text-lg font-semibold tracking-[-0.02em] text-amber-950">Development-only sandbox</h2>
            <p class="mt-3 text-sm leading-6 text-amber-900">Demo mode is available only in local development when <code>DEMO_MODE=true</code> is set. Scheduling here updates local demo data only and does not hit any external publishing service.</p>
          </section>
          <section class="rounded-xl border border-app-line bg-white p-6">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="text-lg font-semibold tracking-[-0.02em]">Demo drafts</h2>
                <p class="mt-1 text-sm leading-6 text-app-text-soft">Preloaded example drafts for local exploration.</p>
              </div>
              <span class="rounded-full bg-app-canvas px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">Sandbox data</span>
            </div>
            <div class="mt-5 grid gap-4">
              <div class="grid gap-2 sm:grid-cols-3" role="tablist" aria-label="Demo draft channels">
                ${tabsMarkup}
              </div>
              ${panelsMarkup}
            </div>
          </section>
          <section class="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <section class="grid gap-4">
              <section class="rounded-xl border border-app-line bg-white p-6">
                <h2 class="text-lg font-semibold tracking-[-0.02em]">Demo queue</h2>
                <div class="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  <div class="rounded-xl border border-app-line bg-app-canvas/60 px-4 py-3">
                    <p class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">Queued</p>
                    <p class="mt-2 text-2xl font-semibold text-app-text" data-metric-queued>${escapeHtml(String(queuedPosts.length))}</p>
                  </div>
                  <div class="rounded-xl border border-app-line bg-app-canvas/60 px-4 py-3">
                    <p class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">Publishing today</p>
                    <p class="mt-2 text-2xl font-semibold text-app-text" data-metric-today>${escapeHtml(String(Math.min(queuedPosts.length, 2)))}</p>
                  </div>
                  <div class="rounded-xl border border-app-line bg-app-canvas/60 px-4 py-3">
                    <p class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">Channels</p>
                    <p class="mt-2 text-2xl font-semibold text-app-text">3</p>
                  </div>
                </div>
              </section>
            </section>
            <section class="rounded-xl border border-app-line bg-white p-6">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <h2 class="text-lg font-semibold tracking-[-0.02em]">Queued demo posts</h2>
                  <p class="mt-1 text-sm leading-6 text-app-text-soft">Seeded queue plus any demo posts scheduled locally from this page.</p>
                </div>
                <span class="text-sm font-medium text-app-text-soft">Local only</span>
              </div>
              <div class="mt-5 grid gap-3" data-queued-posts>${queueMarkup}</div>
            </section>
          </section>
          <section class="rounded-xl border border-app-line bg-white p-6">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 class="text-lg font-semibold tracking-[-0.02em]">Demo sent history</h2>
                <p class="mt-1 max-w-2xl text-sm leading-6 text-app-text-soft">Example history for local review flows and UI testing.</p>
              </div>
              <p class="text-sm font-medium text-app-text-soft"><span data-history-count>${escapeHtml(String(sentHistory.length))}</span> posts shown</p>
            </div>
            <div class="mt-5 flex flex-wrap gap-2" aria-label="Sent history filters">
              ${historyFiltersMarkup}
            </div>
            <div class="mt-5 grid gap-3" data-sent-history-list>${historyMarkup}</div>
            <p class="mt-4 hidden rounded-xl border border-dashed border-app-line bg-app-canvas/50 px-4 py-3 text-sm text-app-text-soft" data-history-empty>No demo sent posts match this channel yet.</p>
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
