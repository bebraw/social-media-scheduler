import { renderQueuedPostsSection, renderStatGrid } from "./cards";
import { renderLinkButton, renderPanel, renderPill, renderSectionHeader } from "./components";
import { getDefaultComposerDrafts, renderComposeDraftPanels, renderDraftTabs, resolveDraftEntries } from "./draft-editor";
import { HOME_PAGE_SCRIPT } from "./home-ui";
import { renderWorkspacePage, type SessionUser } from "./layout";

interface ComposePageOptions {
  demoAvailable: boolean;
  user: SessionUser;
}

export function renderComposePage({ demoAvailable, user }: ComposePageOptions): string {
  const draftEntries = resolveDraftEntries(getDefaultComposerDrafts());

  return renderWorkspacePage({
    activePath: "/compose",
    content: `<div class="grid gap-4 px-5 py-5 sm:px-8 sm:py-8">
      ${renderPanel(`
        ${renderSectionHeader({
          description: "Keep the active writing surface focused on one channel at a time while you shape the next post.",
          title: "Channel drafts",
          trailing: renderPill("Dedicated composer"),
        })}
        <div class="mt-5 grid gap-4">
          <div class="grid gap-2 sm:grid-cols-3" role="tablist" aria-label="Draft channels">
            ${renderDraftTabs(draftEntries, "draft")}
          </div>
          ${renderComposeDraftPanels(draftEntries)}
        </div>
      `)}
      <section class="grid gap-4 lg:grid-cols-[0.82fr_1.18fr]">
        <section class="grid gap-4">
          ${renderPanel(`
            <h2 class="text-lg font-semibold tracking-[-0.02em]">Queue preview</h2>
            ${renderStatGrid([
              { label: "Queued", value: "0", valueAttributes: "data-metric-queued" },
              { label: "Publishing today", value: "0", valueAttributes: "data-metric-today" },
              {
                content: `<p class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">Queue view</p>${renderLinkButton({ className: "mt-2", href: "/", label: "Return to queue", variant: "inline" })}`,
              },
            ])}
          `)}
          ${renderPanel(`
            <h2 class="text-lg font-semibold tracking-[-0.02em]">Composer flow</h2>
            <p class="mt-3 text-sm leading-6 text-app-text-soft">Draft here first, preview the local queue entry, then return to the Queue page to review the broader publishing surface.</p>
          `)}
        </section>
        ${renderQueuedPostsSection({
          badge: "Draft session",
          description: "Posts queued locally from this compose session.",
          emptyText: "No posts are queued yet.",
          title: "Queued posts",
        })}
      </section>
    </div>`,
    demoAvailable,
    description:
      "Use the dedicated composer for channel-specific drafting, attachments, and local queue prep without crowding the queue view.",
    title: "Compose",
    user,
  });
}

export { HOME_PAGE_SCRIPT };
