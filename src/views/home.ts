import { renderQueuedPostsSection, renderStatGrid } from "./cards";
import { renderLinkButton, renderPanel, renderPill, renderSectionHeader } from "./components";
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
        ${renderPanel(`
          ${renderSectionHeader({
            className: "items-start",
            description: "This default post-login view stays focused on what is already queued.",
            title: "Queue status",
            trailing: renderPill("Default view"),
          })}
          ${renderStatGrid([
            { label: "Queued", value: "0", valueAttributes: "data-metric-queued" },
            { label: "Publishing today", value: "0", valueAttributes: "data-metric-today" },
            { label: "Connected channels", value: "3" },
          ])}
        `)}
        ${renderPanel(`
          <h2 class="text-lg font-semibold tracking-[-0.02em]">Compose next post</h2>
          <p class="mt-3 text-sm leading-6 text-app-text-soft">Draft channel-specific copy in a dedicated composer instead of mixing authoring controls into the queue overview.</p>
          ${renderLinkButton({ className: "mt-4", href: "/compose", label: "Open composer", variant: "primary" })}
        `)}
        ${renderPanel(`
          <h2 class="text-lg font-semibold tracking-[-0.02em]">Operations</h2>
          <p class="mt-3 text-sm leading-6 text-app-text-soft">${escapeHtml(backupStatus)}</p>
          <p class="mt-4 text-sm leading-6 text-app-text-soft">Signed in as <span class="font-medium text-app-text">${escapeHtml(user.name)}</span> with <span class="font-medium text-app-text">${escapeHtml(user.role)}</span> access.</p>
          <p class="mt-4 text-sm text-app-text-soft">Health probe: ${renderLinkButton({ href: "/api/health", label: "/api/health", variant: "inline" })}</p>
        `)}
        ${renderPanel(`
          <h2 class="text-lg font-semibold tracking-[-0.02em]">Sent history</h2>
          <p class="mt-3 text-sm leading-6 text-app-text-soft">Review previously sent posts in the separate history view.</p>
          ${renderLinkButton({ className: "mt-4", href: "/history", label: "View sent history" })}
        `)}
        ${
          demoAvailable
            ? renderPanel(`
          <h2 class="text-lg font-semibold tracking-[-0.02em]">Demo mode</h2>
          <p class="mt-3 text-sm leading-6 text-app-text-soft">Local-only sandbox with seeded data for development walkthroughs and safe scheduling experiments.</p>
          ${renderLinkButton({ className: "mt-4", href: "/demo", label: "Open demo mode" })}
        `)
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
