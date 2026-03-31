import { CHANNEL_CONSTRAINTS, describeUsage, type QueueChannel } from "../queue/constraints";
import { escapeHtml } from "./shared";
import { HOME_PAGE_SCRIPT } from "./home-ui";

const appTitle = "Social Media Scheduler";
const appDescription = "A private workspace for planning and reviewing social posts across personal projects.";

interface HomePageOptions {
  backupConfigured: boolean;
  user: {
    name: string;
    role: string;
  };
}

export function renderHomePage({ backupConfigured, user }: HomePageOptions): string {
  const backupStatus = backupConfigured
    ? "R2 backup binding detected. Scheduled backups can write manifests and exports."
    : "R2 backup binding is not configured yet. Auth works locally without it, but scheduled backups will skip.";
  const channelDrafts = [
    {
      id: "linkedin" as QueueChannel,
      subtitle: "Longer project update",
      accent: "Professional update",
      content:
        "Shipping a quieter but more useful improvement this week: the scheduler now has private auth, backup groundwork, and a clearer queue surface for planning content across personal projects. Next I am splitting publishing logic by channel so each post can respect the norms of the platform instead of forcing one message everywhere.",
      slot: "Tomorrow, 09:00",
    },
    {
      id: "x" as QueueChannel,
      subtitle: "Short post with tighter budget",
      accent: "Tight summary",
      content:
        "Built the first queue UI for the social scheduler today. Auth and backups are in, and now I’m shaping separate post flows for LinkedIn, X, and Bluesky so each channel gets content that actually fits.",
      slot: "Today, 16:30",
    },
    {
      id: "bluesky" as QueueChannel,
      subtitle: "Short post with room for voice",
      accent: "Concise status post",
      content:
        "Sketching the channel-specific queue now: LinkedIn gets the fuller project note, X gets the compressed headline, and Bluesky gets the in-between version with a bit more personality. Real adapters come next.",
      slot: "Thu, 11:15",
    },
  ];
  const channelDraftsMarkup = channelDrafts
    .map((draft) => {
      const constraint = CHANNEL_CONSTRAINTS.find((item) => item.id === draft.id);
      if (!constraint) {
        return "";
      }

      const usage = describeUsage(draft.id, draft.content);
      const stateClass =
        usage.state === "over"
          ? "bg-amber-50 text-amber-900"
          : usage.state === "warning"
            ? "bg-app-canvas text-app-text"
            : "bg-app-accent text-white";

      return `<section class="flex flex-col rounded-xl border border-app-line bg-white p-6" data-channel-column data-channel-id="${escapeHtml(draft.id)}" data-channel-limit="${constraint.limit}">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">${escapeHtml(draft.accent)}</p>
            <h2 class="mt-2 text-lg font-semibold tracking-[-0.02em]">${escapeHtml(constraint.name)}</h2>
            <p class="mt-1 text-sm leading-6 text-app-text-soft">${escapeHtml(draft.subtitle)}</p>
          </div>
          <span class="rounded-full ${stateClass} px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]" data-channel-status>${escapeHtml(
            usage.state === "over" ? "Over limit" : usage.state === "warning" ? "Close to limit" : "Ready",
          )}</span>
        </div>
        <label class="mt-5 grid gap-2 text-sm font-medium">
          <span>${escapeHtml(constraint.name)} post copy</span>
          <textarea class="min-h-52 rounded-xl border border-app-line bg-app-canvas/40 px-4 py-3 text-sm leading-6 text-app-text outline-none transition placeholder:text-app-text-soft/70 focus:border-app-accent focus:ring-2 focus:ring-app-accent/10" data-channel-input aria-label="${escapeHtml(constraint.name)} post copy">${escapeHtml(
            draft.content,
          )}</textarea>
        </label>
        <div class="mt-4 grid gap-3">
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
          <label class="grid gap-2 text-sm font-medium">
            <span>Queue slot</span>
            <select class="rounded-xl border border-app-line bg-white px-4 py-3 text-sm text-app-text outline-none transition focus:border-app-accent focus:ring-2 focus:ring-app-accent/10" data-channel-slot aria-label="${escapeHtml(constraint.name)} queue slot">
              <option>${escapeHtml(draft.slot)}</option>
              <option>Next available slot</option>
              <option>Tomorrow, 13:00</option>
            </select>
          </label>
        </div>
        <div class="mt-5 flex flex-wrap gap-3">
          <button class="rounded-xl bg-app-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-app-accent-strong" type="button" data-queue-button>Queue post</button>
          <button class="rounded-xl border border-app-line bg-white px-4 py-3 text-sm font-semibold text-app-text transition hover:bg-app-canvas" type="button">Save draft</button>
        </div>
      </section>`;
    })
    .join("");
  const queuedPosts = [
    {
      channel: "X",
      project: "Scheduler Update",
      time: "Today, 16:30",
      body: "Built the first channel-specific queue flow so short updates can stay tight without squeezing the longer formats.",
      status: "Ready",
    },
    {
      channel: "LinkedIn",
      project: "Open Source Note",
      time: "Tomorrow, 09:00",
      body: "Writing up what changed in the worker auth setup and why the backup flow stays intentionally lightweight.",
      status: "Needs image",
    },
    {
      channel: "Bluesky",
      project: "Scheduler Teaser",
      time: "Thu, 11:15",
      body: "Sketching the first queue UI for the social scheduler before wiring in real adapters.",
      status: "Ready",
    },
    {
      channel: "LinkedIn",
      project: "Process Note",
      time: "Fri, 14:00",
      body: "A clearer write-up about why the scheduler treats each channel as its own draft instead of mirroring one post everywhere.",
      status: "Review",
    },
  ];
  const queuedPostsMarkup = queuedPosts
    .map(
      (post) => `<article class="rounded-xl border border-app-line bg-white p-5">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded-full bg-app-canvas px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-app-accent-strong">${escapeHtml(post.channel)}</span>
              <span class="text-xs font-medium uppercase tracking-[0.12em] text-app-text-soft">${escapeHtml(post.project)}</span>
            </div>
            <p class="mt-3 max-w-2xl text-sm leading-6 text-app-text">${escapeHtml(post.body)}</p>
          </div>
          <div class="sm:text-right">
            <p class="text-sm font-medium text-app-text">${escapeHtml(post.time)}</p>
            <p class="mt-1 text-sm text-app-text-soft">${escapeHtml(post.status)}</p>
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
            </div>
            <div class="rounded-xl border border-app-line/80 bg-app-canvas/70 px-4 py-4 md:min-w-64">
              <p class="text-xs font-semibold uppercase tracking-[0.16em] text-app-text-soft">Session</p>
              <p class="mt-2 text-sm font-medium text-app-text">${escapeHtml(user.name)}</p>
              <p class="text-sm text-app-text-soft">${escapeHtml(user.role)}</p>
              <form class="mt-4" method="post" action="/logout">
                <button class="w-full rounded-xl border border-app-line bg-white px-4 py-2.5 text-sm font-semibold text-app-text transition hover:bg-app-canvas" type="submit">Sign out</button>
              </form>
            </div>
          </div>
        </section>
        <div class="grid gap-4 px-5 py-5 sm:px-8 sm:py-8">
          <section class="rounded-xl border border-app-line bg-white p-6">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="text-lg font-semibold tracking-[-0.02em]">Channel drafts</h2>
                <p class="mt-1 text-sm leading-6 text-app-text-soft">Separate columns for LinkedIn, X, and Bluesky with lightweight queue behavior and channel-specific limits.</p>
              </div>
              <span class="rounded-full bg-app-canvas px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">Mockup + interaction</span>
            </div>
            <div class="mt-5 grid gap-4 xl:grid-cols-3">${channelDraftsMarkup}</div>
          </section>
          <section class="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <section class="grid gap-4">
            <section class="rounded-xl border border-app-line bg-white p-6">
              <h2 class="text-lg font-semibold tracking-[-0.02em]">Queue overview</h2>
              <div class="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                <div class="rounded-xl border border-app-line bg-app-canvas/60 px-4 py-3">
                  <p class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">Queued</p>
                  <p class="mt-2 text-2xl font-semibold text-app-text" data-metric-queued>4</p>
                </div>
                <div class="rounded-xl border border-app-line bg-app-canvas/60 px-4 py-3">
                  <p class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">Publishing today</p>
                  <p class="mt-2 text-2xl font-semibold text-app-text" data-metric-today>2</p>
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
          </section>
          <section class="rounded-xl border border-app-line bg-white p-6">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="text-lg font-semibold tracking-[-0.02em]">Queued posts</h2>
                <p class="mt-1 text-sm leading-6 text-app-text-soft">A simple preview of what is waiting to be published next across the broader queue.</p>
              </div>
              <span class="text-sm font-medium text-app-text-soft">Next 48 hours</span>
            </div>
            <div class="mt-5 grid gap-3" data-queued-posts>${queuedPostsMarkup}</div>
          </section>
          </section>
        </div>
      </article>
    </main>
  </body>
</html>`;
}

export { HOME_PAGE_SCRIPT };
