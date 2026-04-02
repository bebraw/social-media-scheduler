import { renderQueuedPostsSection, renderStatGrid } from "./cards";
import { HOME_PAGE_SCRIPT } from "./home-ui";
import { renderWorkspacePage, type SessionUser } from "./layout";
import { escapeHtml } from "./shared";

interface QueuePageOptions {
  backupConfigured: boolean;
  demoAvailable: boolean;
  user: SessionUser;
}

export function renderQueuePage({ backupConfigured, demoAvailable, user }: QueuePageOptions): string {
  const backupStatus = backupConfigured
    ? "R2 backup binding detected. Scheduled backups can write manifests and exports."
    : "R2 backup binding is not configured yet. Auth works locally without it, but scheduled backups will skip.";

  return renderWorkspacePage({
    activePath: "/",
    content: `<div class="grid gap-4 px-5 py-5 sm:px-8 sm:py-8 lg:grid-cols-[0.82fr_1.18fr]">
      <section class="grid gap-4">
        <section class="rounded-xl border border-app-line bg-white p-6">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-lg font-semibold tracking-[-0.02em]">Queue status</h2>
              <p class="mt-1 text-sm leading-6 text-app-text-soft">This default post-login view stays focused on what is already queued.</p>
            </div>
            <span class="rounded-full bg-app-canvas px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">Default view</span>
          </div>
          ${renderStatGrid([
            { label: "Queued", value: "0", valueAttributes: "data-metric-queued" },
            { label: "Publishing today", value: "0", valueAttributes: "data-metric-today" },
            { label: "Connected channels", value: "3" },
          ])}
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
      ${renderQueuedPostsSection({
        badge: "Next 48 hours",
        description: "Posts lined up across the current queue.",
        emptyText: "No posts are queued yet.",
        title: "Queued posts",
      })}
    </div>`,
    demoAvailable,
    description: "Review what is lined up to publish next, then jump into the dedicated composer when you need to draft a new post.",
    title: "Queue",
    user,
  });
}

export { HOME_PAGE_SCRIPT };
