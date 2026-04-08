import type { ChannelConnection } from "../channels";
import type { QueuedPost } from "../publishing";
import type { ChannelPostingSchedule } from "../schedule";
import { renderQueuedPostsSection, renderStatGrid } from "./cards";
import { renderLinkButton, renderPanel, renderSectionHeader } from "./components";
import { buildComposerDrafts, renderComposeDraftPanels, renderDraftTabs, resolveDraftEntries } from "./draft-editor";
import { HOME_PAGE_SCRIPT } from "./home-ui";
import { renderWorkspacePage, type SessionUser } from "./layout";
import { renderQueuedPosts } from "./queued-posts";
import { escapeHtml } from "./shared";

interface ComposePageOptions {
  connections: ChannelConnection[];
  postingSchedules?: ChannelPostingSchedule[];
  queueError?: string;
  queueSaved?: boolean;
  queuedPosts?: QueuedPost[];
  publishingTodayCount?: number;
  user: SessionUser;
}

export function renderComposePage({
  connections,
  postingSchedules = [],
  publishingTodayCount = 0,
  queueError,
  queueSaved,
  queuedPosts = [],
  user,
}: ComposePageOptions): string {
  const draftEntries = resolveDraftEntries(buildComposerDrafts(connections));

  return renderWorkspacePage({
    activePath: "/compose",
    content: `<div class="grid gap-4 px-5 py-5 sm:px-8 sm:py-8">
      ${renderPanel(`
        ${renderSectionHeader({
          description:
            connections.length > 0
              ? "Draft one configured account at a time."
              : "Add channel connections in Settings before composing provider-specific drafts.",
          title: "Channel drafts",
        })}
        ${
          draftEntries.length > 0
            ? `<div class="mt-5 grid gap-4">
          ${
            queueSaved
              ? '<p class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Post queued for the next eligible publishing slot.</p>'
              : ""
          }
          ${queueError ? `<p class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">${escapeHtml(queueError)}</p>` : ""}
          <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" role="tablist" aria-label="Draft channels">
            ${renderDraftTabs(draftEntries, "draft")}
          </div>
          ${renderComposeDraftPanels(draftEntries)}
        </div>`
            : `<div class="mt-5 rounded-xl border border-dashed border-app-line bg-app-canvas/50 px-5 py-5">
          <p class="text-sm leading-6 text-app-text-soft">No channel connections are configured yet. Add at least one account in Settings before drafting posts here.</p>
          <div class="mt-4">${renderLinkButton({ href: "/settings", label: "Open settings", variant: "primary" })}</div>
        </div>`
        }
      `)}
      <section class="grid gap-4 lg:grid-cols-[0.82fr_1.18fr]">
        <section class="grid gap-4">
          ${renderPanel(`
            <h2 class="text-lg font-semibold tracking-[-0.02em]">Queue preview</h2>
            ${renderStatGrid([
              { label: "Queued", value: String(queuedPosts.length), valueAttributes: "data-metric-queued" },
              { label: "Publishing today", value: String(publishingTodayCount), valueAttributes: "data-metric-today" },
              {
                content: `<p class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">Queue view</p>${renderLinkButton({ className: "mt-2", href: "/", label: "Return to queue", variant: "inline" })}`,
              },
            ])}
          `)}
        </section>
        ${renderQueuedPostsSection({
          description: "Queued posts now persist on the server and publish from the saved channel schedule.",
          emptyText: "No posts are queued yet.",
          postsMarkup: renderQueuedPosts(queuedPosts, postingSchedules, { canEdit: user.role !== "readonly" }),
          title: "Queued posts",
        })}
      </section>
    </div>`,
    description: "Draft posts and queue them for the next eligible publishing slot.",
    title: "Compose",
    user,
  });
}

export { HOME_PAGE_SCRIPT };
