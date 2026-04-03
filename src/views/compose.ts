import type { ChannelConnection } from "../channels";
import { renderQueuedPostsSection, renderStatGrid } from "./cards";
import { renderLinkButton, renderPanel, renderSectionHeader } from "./components";
import { buildComposerDrafts, renderComposeDraftPanels, renderDraftTabs, resolveDraftEntries } from "./draft-editor";
import { HOME_PAGE_SCRIPT } from "./home-ui";
import { renderWorkspacePage, type SessionUser } from "./layout";

interface ComposePageOptions {
  connections: ChannelConnection[];
  demoAvailable: boolean;
  user: SessionUser;
}

export function renderComposePage({ connections, demoAvailable, user }: ComposePageOptions): string {
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
              { label: "Queued", value: "0", valueAttributes: "data-metric-queued" },
              { label: "Publishing today", value: "0", valueAttributes: "data-metric-today" },
              {
                content: `<p class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">Queue view</p>${renderLinkButton({ className: "mt-2", href: "/", label: "Return to queue", variant: "inline" })}`,
              },
            ])}
          `)}
        </section>
        ${renderQueuedPostsSection({
          description: "Posts queued locally from this compose session.",
          emptyText: "No posts are queued yet.",
          title: "Queued posts",
        })}
      </section>
    </div>`,
    demoAvailable,
    description: "Draft posts, attach media, and preview the local queue.",
    title: "Compose",
    user,
  });
}

export { HOME_PAGE_SCRIPT };
