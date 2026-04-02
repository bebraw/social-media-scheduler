import { CHANNEL_CONSTRAINTS, describeUsage, type QueueChannel } from "../queue/constraints";
import { escapeHtml, renderAttachmentComposer, renderSessionPanel, renderWorkspaceNav } from "./shared";
import { HOME_PAGE_SCRIPT } from "./home-ui";

const appTitle = "Social Media Scheduler";
const appDescription = "A private workspace for planning and reviewing social posts across personal projects.";

interface HomePageOptions {
  backupConfigured: boolean;
  demoAvailable: boolean;
  user: {
    name: string;
    role: string;
  };
}

export function renderHomePage({ backupConfigured, demoAvailable, user }: HomePageOptions): string {
  const backupStatus = backupConfigured
    ? "R2 backup binding detected. Scheduled backups can write manifests and exports."
    : "R2 backup binding is not configured yet. Auth works locally without it, but scheduled backups will skip.";
  const channelDrafts = [
    {
      id: "linkedin" as QueueChannel,
      subtitle: "Longer project update",
      accent: "Professional update",
      content: "",
      placeholder: "Write the next LinkedIn update for this project.",
      slot: "Next available slot",
    },
    {
      id: "x" as QueueChannel,
      subtitle: "Short post with tighter budget",
      accent: "Tight summary",
      content: "",
      placeholder: "Write the next X post.",
      slot: "Next available slot",
    },
    {
      id: "bluesky" as QueueChannel,
      subtitle: "Short post with room for voice",
      accent: "Concise status post",
      content: "",
      placeholder: "Write the next Bluesky post.",
      slot: "Next available slot",
    },
  ];
  const channelDraftEntries = channelDrafts.flatMap((draft) => {
    const constraint = CHANNEL_CONSTRAINTS.find((item) => item.id === draft.id);
    if (!constraint) {
      return [];
    }

    return [
      {
        draft,
        constraint,
        usage: describeUsage(draft.id, draft.content),
      },
    ];
  });
  const channelTabsMarkup = channelDraftEntries
    .map(({ draft, constraint }, index) => {
      const isSelected = index === 0;

      return `<button class="${isSelected ? "bg-app-accent text-white shadow-sm" : "bg-white text-app-text hover:bg-app-canvas"} rounded-xl px-4 py-3 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/20" type="button" role="tab" id="draft-tab-${escapeHtml(
        draft.id,
      )}" aria-selected="${isSelected ? "true" : "false"}" aria-controls="draft-panel-${escapeHtml(
        draft.id,
      )}" tabindex="${isSelected ? "0" : "-1"}" data-channel-tab data-channel-id="${escapeHtml(draft.id)}">
        <span class="block text-xs font-semibold uppercase tracking-[0.12em] ${isSelected ? "text-white/70" : "text-app-text-soft"}">${escapeHtml(
          draft.accent,
        )}</span>
        <span class="mt-2 block text-base tracking-[-0.02em]">${escapeHtml(constraint.name)}</span>
      </button>`;
    })
    .join("");
  const channelDraftsMarkup = channelDraftEntries
    .map(({ draft, constraint, usage }, index) => {
      const isSelected = index === 0;
      const stateClass =
        usage.state === "over"
          ? "bg-amber-50 text-amber-900"
          : usage.state === "warning"
            ? "bg-app-canvas text-app-text"
            : "bg-app-accent text-white";

      return `<section class="grid gap-5 rounded-xl border border-app-line bg-white p-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]" role="tabpanel" id="draft-panel-${escapeHtml(
        draft.id,
      )}" aria-labelledby="draft-tab-${escapeHtml(draft.id)}" ${isSelected ? "" : "hidden"} data-channel-column data-channel-id="${escapeHtml(
        draft.id,
      )}" data-channel-limit="${constraint.limit}">
        <div class="min-w-0">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">${escapeHtml(draft.accent)}</p>
              <h3 class="mt-2 text-xl font-semibold tracking-[-0.03em]">${escapeHtml(constraint.name)}</h3>
              <p class="mt-1 max-w-2xl text-sm leading-6 text-app-text-soft">${escapeHtml(draft.subtitle)}</p>
            </div>
            <span class="rounded-full ${stateClass} px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]" data-channel-status>${escapeHtml(
              usage.state === "over" ? "Over limit" : usage.state === "warning" ? "Close to limit" : "Ready",
            )}</span>
          </div>
          <label class="mt-5 grid gap-2 text-sm font-medium">
            <span>${escapeHtml(constraint.name)} post copy</span>
            <textarea class="min-h-80 rounded-xl border border-app-line bg-app-canvas/40 px-4 py-4 text-sm leading-6 text-app-text outline-none transition placeholder:text-app-text-soft/70 focus:border-app-accent focus:ring-2 focus:ring-app-accent/10" data-channel-input aria-label="${escapeHtml(
              constraint.name,
            )} post copy" placeholder="${escapeHtml(draft.placeholder)}">${escapeHtml(draft.content)}</textarea>
          </label>
        </div>
        <div class="grid gap-3 self-start">
          <div class="rounded-xl border border-app-line bg-app-canvas/60 px-4 py-3">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">Constraint</p>
                <p class="mt-2 text-sm font-medium text-app-text">${escapeHtml(constraint.limitLabel)}</p>
              </div>
              <span class="text-sm font-medium text-app-text" data-channel-count>${escapeHtml(usage.label)}</span>
            </div>
          </div>
          <div class="rounded-xl border border-app-line bg-app-canvas/60 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">Channel note</p>
            <p class="mt-2 text-sm leading-6 text-app-text-soft">${escapeHtml(constraint.notes)}</p>
          </div>
          ${renderAttachmentComposer({ channelName: constraint.name, serverMode: false })}
          <label class="grid gap-2 text-sm font-medium">
            <span>Queue slot</span>
            <select class="rounded-xl border border-app-line bg-white px-4 py-3 text-sm text-app-text outline-none transition focus:border-app-accent focus:ring-2 focus:ring-app-accent/10" data-channel-slot aria-label="${escapeHtml(constraint.name)} queue slot">
              <option>${escapeHtml(draft.slot)}</option>
              <option>Tomorrow, 09:00</option>
              <option>Tomorrow, 13:00</option>
            </select>
          </label>
          <div class="flex flex-wrap gap-3 pt-2">
            <button class="rounded-xl bg-app-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-app-accent-strong" type="button" data-queue-button data-queue-mode="client">Queue post</button>
            <button class="rounded-xl border border-app-line bg-white px-4 py-3 text-sm font-semibold text-app-text transition hover:bg-app-canvas" type="button">Save draft</button>
          </div>
        </div>
      </section>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(appTitle)}</title>
    <link rel="stylesheet" href="/styles.css">
    <script type="module" src="/home.js"></script>
  </head>
  <body class="min-h-screen bg-app-canvas text-app-text antialiased">
    <main class="mx-auto w-[min(64rem,calc(100vw-2rem))] py-10 sm:py-14">
      <article class="overflow-hidden rounded-2xl border border-app-line bg-app-surface shadow-panel">
        <section class="border-b border-app-line px-5 py-8 sm:px-8 sm:py-10">
          <div class="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div class="max-w-3xl">
              <h1 class="max-w-[11ch] text-4xl leading-none font-semibold tracking-[-0.04em] sm:text-6xl">${escapeHtml(appTitle)}</h1>
              <p class="mt-4 max-w-2xl text-base leading-7 text-app-text-soft sm:text-lg">${escapeHtml(appDescription)}</p>
              ${renderWorkspaceNav({ activePath: "/", demoAvailable })}
            </div>
            ${renderSessionPanel(user)}
          </div>
        </section>
        <div class="grid gap-4 px-5 py-5 sm:px-8 sm:py-8">
          <section class="rounded-xl border border-app-line bg-white p-6">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="text-lg font-semibold tracking-[-0.02em]">Channel drafts</h2>
                <p class="mt-1 text-sm leading-6 text-app-text-soft">Draft channel-specific posts and keep the active writing surface focused on one channel at a time.</p>
              </div>
              <span class="rounded-full bg-app-canvas px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">Live workspace</span>
            </div>
            <div class="mt-5 grid gap-4">
              <div class="grid gap-2 sm:grid-cols-3" role="tablist" aria-label="Draft channels">
                ${channelTabsMarkup}
              </div>
              ${channelDraftsMarkup}
            </div>
          </section>
          <section class="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <section class="grid gap-4">
              <section class="rounded-xl border border-app-line bg-white p-6">
                <h2 class="text-lg font-semibold tracking-[-0.02em]">Queue overview</h2>
                <div class="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  <div class="rounded-xl border border-app-line bg-app-canvas/60 px-4 py-3">
                    <p class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">Queued</p>
                    <p class="mt-2 text-2xl font-semibold text-app-text" data-metric-queued>0</p>
                  </div>
                  <div class="rounded-xl border border-app-line bg-app-canvas/60 px-4 py-3">
                    <p class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">Publishing today</p>
                    <p class="mt-2 text-2xl font-semibold text-app-text" data-metric-today>0</p>
                  </div>
                  <div class="rounded-xl border border-app-line bg-app-canvas/60 px-4 py-3">
                    <p class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">Connected channels</p>
                    <p class="mt-2 text-2xl font-semibold text-app-text">3</p>
                  </div>
                </div>
              </section>
              <section class="rounded-xl border border-app-line bg-white p-6">
                <h2 class="text-lg font-semibold tracking-[-0.02em]">Operations</h2>
                <p class="mt-3 text-sm leading-6 text-app-text-soft">${escapeHtml(backupStatus)}</p>
                <p class="mt-4 text-sm leading-6 text-app-text-soft">Signed in as <span class="font-medium text-app-text">${escapeHtml(user.name)}</span> with <span class="font-medium text-app-text">${escapeHtml(user.role)}</span> access.</p>
                <p class="mt-4 text-sm text-app-text-soft">Health probe: <a class="font-semibold text-app-accent-strong underline decoration-app-accent/25 underline-offset-4" href="/api/health">/api/health</a></p>
              </section>
              <section class="rounded-xl border border-app-line bg-white p-6">
                <h2 class="text-lg font-semibold tracking-[-0.02em]">Sent history</h2>
                <p class="mt-3 text-sm leading-6 text-app-text-soft">Review previously sent posts on a dedicated page.</p>
                <a class="mt-4 inline-flex rounded-xl border border-app-line bg-app-canvas px-4 py-3 text-sm font-semibold text-app-text transition hover:bg-white" href="/history">View sent history</a>
              </section>
              ${
                demoAvailable
                  ? `<section class="rounded-xl border border-app-line bg-white p-6">
                <h2 class="text-lg font-semibold tracking-[-0.02em]">Demo mode</h2>
                <p class="mt-3 text-sm leading-6 text-app-text-soft">Local-only sandbox with seeded data for development walkthroughs and safe scheduling experiments.</p>
                <a class="mt-4 inline-flex rounded-xl border border-app-line bg-app-canvas px-4 py-3 text-sm font-semibold text-app-text transition hover:bg-white" href="/demo">Open demo mode</a>
              </section>`
                  : ""
              }
            </section>
            <section class="rounded-xl border border-app-line bg-white p-6">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <h2 class="text-lg font-semibold tracking-[-0.02em]">Queued posts</h2>
                  <p class="mt-1 text-sm leading-6 text-app-text-soft">Posts lined up across the current queue.</p>
                </div>
                <span class="text-sm font-medium text-app-text-soft">Next 48 hours</span>
              </div>
              <div class="mt-5 grid gap-3" data-queued-posts></div>
              <p class="mt-5 rounded-xl border border-dashed border-app-line bg-app-canvas/50 px-4 py-3 text-sm text-app-text-soft" data-queued-empty>No posts are queued yet.</p>
            </section>
          </section>
        </div>
      </article>
    </main>
  </body>
</html>`;
}

export { HOME_PAGE_SCRIPT };
