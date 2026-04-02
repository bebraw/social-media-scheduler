import { escapeHtml, renderSessionPanel, renderWorkspaceNav } from "./shared";
import { HOME_PAGE_SCRIPT } from "./home-ui";

interface QueuePageOptions {
  backupConfigured: boolean;
  demoAvailable: boolean;
  user: {
    name: string;
    role: string;
  };
}

export function renderQueuePage({ backupConfigured, demoAvailable, user }: QueuePageOptions): string {
  const backupStatus = backupConfigured
    ? "R2 backup binding detected. Scheduled backups can write manifests and exports."
    : "R2 backup binding is not configured yet. Auth works locally without it, but scheduled backups will skip.";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Queue | Social Media Scheduler</title>
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
              <h1 class="mt-3 text-4xl leading-none font-semibold tracking-[-0.04em] sm:text-5xl">Queue</h1>
              <p class="mt-4 max-w-2xl text-base leading-7 text-app-text-soft sm:text-lg">Review what is lined up to publish next, then jump into the dedicated composer when you need to draft a new post.</p>
              ${renderWorkspaceNav({ activePath: "/", demoAvailable })}
            </div>
            ${renderSessionPanel(user)}
          </div>
        </section>
        <div class="grid gap-4 px-5 py-5 sm:px-8 sm:py-8 lg:grid-cols-[0.82fr_1.18fr]">
          <section class="grid gap-4">
            <section class="rounded-xl border border-app-line bg-white p-6">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h2 class="text-lg font-semibold tracking-[-0.02em]">Queue status</h2>
                  <p class="mt-1 text-sm leading-6 text-app-text-soft">This default post-login view stays focused on what is already queued.</p>
                </div>
                <span class="rounded-full bg-app-canvas px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">Default view</span>
              </div>
              <div class="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
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
              <h2 class="text-lg font-semibold tracking-[-0.02em]">Compose next post</h2>
              <p class="mt-3 text-sm leading-6 text-app-text-soft">Draft channel-specific copy in a dedicated composer instead of mixing authoring controls into the queue overview.</p>
              <a class="mt-4 inline-flex rounded-xl bg-app-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-app-accent-strong" href="/compose">Open composer</a>
            </section>
            <section class="rounded-xl border border-app-line bg-white p-6">
              <h2 class="text-lg font-semibold tracking-[-0.02em]">Operations</h2>
              <p class="mt-3 text-sm leading-6 text-app-text-soft">${escapeHtml(backupStatus)}</p>
              <p class="mt-4 text-sm leading-6 text-app-text-soft">Signed in as <span class="font-medium text-app-text">${escapeHtml(user.name)}</span> with <span class="font-medium text-app-text">${escapeHtml(user.role)}</span> access.</p>
              <p class="mt-4 text-sm text-app-text-soft">Health probe: <a class="font-semibold text-app-accent-strong underline decoration-app-accent/25 underline-offset-4" href="/api/health">/api/health</a></p>
            </section>
            <section class="rounded-xl border border-app-line bg-white p-6">
              <h2 class="text-lg font-semibold tracking-[-0.02em]">Sent history</h2>
              <p class="mt-3 text-sm leading-6 text-app-text-soft">Review previously sent posts in the separate history view.</p>
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
        </div>
      </article>
    </main>
  </body>
</html>`;
}

export { HOME_PAGE_SCRIPT };
