import type { DemoDraft, DemoQueuedPost } from "../demo";
import type { SentPostHistoryEntry } from "../history";
import { renderQueuedPostsSection, renderStatGrid } from "./cards";
import { renderPanel, renderPill, renderSectionHeader } from "./components";
import { renderDemoDraftPanels, renderDraftTabs, resolveDraftEntries } from "./draft-editor";
import { HOME_PAGE_SCRIPT } from "./home-ui";
import { formatChannelLabel, renderHistoryCards, renderHistoryFilters } from "./history-components";
import { renderWorkspacePage, type SessionUser } from "./layout";
import { escapeHtml, renderPostImageAttachments } from "./shared";

interface DemoPageOptions {
  drafts: DemoDraft[];
  queuedPosts: DemoQueuedPost[];
  sentHistory: SentPostHistoryEntry[];
  user: SessionUser;
}

export function renderDemoPage({ drafts, queuedPosts, sentHistory, user }: DemoPageOptions): string {
  const draftEntries = resolveDraftEntries(drafts);

  const queueMarkup = queuedPosts
    .map(
      (post) => `<article class="rounded-xl border border-app-line bg-white p-5" data-queued-post-card>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded-full bg-app-canvas px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-app-accent-strong">${escapeHtml(
                formatChannelLabel(post.channel),
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
  return renderWorkspacePage({
    activePath: "/demo",
    content: `<div class="grid gap-4 px-5 py-5 sm:px-8 sm:py-8">
      <section class="rounded-xl border border-app-line bg-amber-50 p-6">
        <h2 class="text-lg font-semibold tracking-[-0.02em] text-amber-950">Development-only sandbox</h2>
        <p class="mt-3 text-sm leading-6 text-amber-900">Demo mode is available only in local development when <code>DEMO_MODE=true</code> is set. Scheduling here updates local demo data only and does not hit any external publishing service.</p>
      </section>
      ${renderPanel(`
        ${renderSectionHeader({
          description: "Preloaded example drafts for local exploration.",
          title: "Demo drafts",
          trailing: renderPill("Sandbox data"),
        })}
        <div class="mt-5 grid gap-4">
          <div class="grid gap-2 sm:grid-cols-3" role="tablist" aria-label="Demo draft channels">
            ${renderDraftTabs(draftEntries, "demo")}
          </div>
          ${renderDemoDraftPanels(draftEntries)}
        </div>
      `)}
      <section class="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <section class="grid gap-4">
          ${renderPanel(`
            <h2 class="text-lg font-semibold tracking-[-0.02em]">Demo queue</h2>
            ${renderStatGrid([
              { label: "Queued", value: String(queuedPosts.length), valueAttributes: "data-metric-queued" },
              { label: "Publishing today", value: String(Math.min(queuedPosts.length, 2)), valueAttributes: "data-metric-today" },
              { label: "Channels", value: "3" },
            ])}
          `)}
        </section>
        ${renderQueuedPostsSection({
          badge: "Local only",
          description: "Seeded queue plus any demo posts scheduled locally from this page.",
          postsMarkup: queueMarkup,
          title: "Queued demo posts",
        })}
      </section>
      ${renderPanel(`
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 class="text-lg font-semibold tracking-[-0.02em]">Demo sent history</h2>
            <p class="mt-1 max-w-2xl text-sm leading-6 text-app-text-soft">Example history for local review flows and UI testing.</p>
          </div>
          <p class="text-sm font-medium text-app-text-soft"><span data-history-count>${escapeHtml(String(sentHistory.length))}</span> posts shown</p>
        </div>
        <div class="mt-5 flex flex-wrap gap-2" aria-label="Sent history filters">
          ${renderHistoryFilters(sentHistory)}
        </div>
        <div class="mt-5 grid gap-3" data-sent-history-list>${renderHistoryCards(sentHistory)}</div>
        <p class="mt-4 hidden rounded-xl border border-dashed border-app-line bg-app-canvas/50 px-4 py-3 text-sm text-app-text-soft" data-history-empty>No demo sent posts match this channel yet.</p>
      `)}
    </div>`,
    demoAvailable: true,
    description: "Development-only sandbox with seeded data for walkthroughs, experiments, and safe scheduling practice.",
    title: "Demo Mode",
    user,
  });
}

export { HOME_PAGE_SCRIPT };
