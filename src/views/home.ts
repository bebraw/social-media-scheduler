import type { ChannelConnection } from "../channels";
import { listConfiguredProviders } from "../channels";
import { getChannelConstraint } from "../queue/constraints";
import type { ChannelPostingSchedule } from "../schedule";
import { renderQueuedPostsSection, renderStatGrid } from "./cards";
import { renderLinkButton, renderPanel, renderPill, renderSectionHeader } from "./components";
import { HOME_PAGE_SCRIPT } from "./home-ui";
import { renderWorkspacePage, type SessionUser } from "./layout";
import { renderPostingSchedulePanel } from "./posting-schedule";

interface QueuePageOptions {
  configuredConnections: number;
  connections: ChannelConnection[];
  demoAvailable: boolean;
  postingSchedules: ChannelPostingSchedule[];
  scheduleError?: string;
  scheduleSaved?: boolean;
  user: SessionUser;
}

export function renderQueuePage({
  configuredConnections,
  connections,
  demoAvailable,
  postingSchedules,
  scheduleError,
  scheduleSaved,
  user,
}: QueuePageOptions): string {
  const visibleSchedules = postingSchedules.filter((schedule) => listConfiguredProviders(connections).includes(schedule.channel));

  return renderWorkspacePage({
    activePath: "/",
    content: `<div class="grid gap-4 px-5 py-5 sm:px-8 sm:py-8 lg:grid-cols-[0.82fr_1.18fr]">
      <section class="grid gap-4">
        ${renderPanel(`
          ${renderSectionHeader({
            className: "items-start",
            description: "Review what is already queued.",
            title: "Queue status",
          })}
          ${renderStatGrid([
            { label: "Queued", value: "0", valueAttributes: "data-metric-queued" },
            { label: "Publishing today", value: "0", valueAttributes: "data-metric-today" },
            { label: "Configured connections", value: String(configuredConnections) },
          ])}
        `)}
        ${renderPanel(`
          ${renderSectionHeader({
            className: "items-start",
            description:
              connections.length > 0
                ? "These connected accounts drive the authenticated queue, compose, and history surfaces."
                : "Add channel connections in Settings before using the authenticated queue and composer surfaces.",
            title: "Configured channels",
            trailing: renderLinkButton({
              href: "/settings",
              label: connections.length > 0 ? "Manage settings" : "Set up channels",
              variant: "inline",
            }),
          })}
          ${
            connections.length > 0
              ? `<div class="mt-5 grid gap-3">${connections.map((connection) => renderConnectionSummary(connection)).join("")}</div>`
              : '<p class="mt-5 rounded-xl border border-dashed border-app-line bg-app-canvas/50 px-4 py-4 text-sm leading-6 text-app-text-soft">No channel connections are configured yet. Use Settings to add the accounts you actually want to publish through.</p>'
          }
        `)}
        ${renderPostingSchedulePanel({
          canEdit: user.role !== "readonly",
          error: scheduleError,
          saved: scheduleSaved,
          schedules: visibleSchedules,
        })}
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
        description: "Posts lined up across the current queue.",
        emptyText: "No posts are queued yet.",
        title: "Queued posts",
      })}
    </div>`,
    demoAvailable,
    description: "See what is queued and adjust channel schedules.",
    title: "Queue",
    user,
  });
}

export { HOME_PAGE_SCRIPT };

function renderConnectionSummary(connection: ChannelConnection): string {
  const constraint = getChannelConstraint(connection.channel);

  return `<article class="rounded-xl border border-app-line bg-app-canvas/40 px-4 py-4">
    <div class="flex flex-wrap items-center gap-2">
      ${renderPill(constraint.name, { tone: "quiet-accent" })}
      <span class="text-xs font-medium uppercase tracking-[0.12em] text-app-text-soft">${connection.accountHandle}</span>
    </div>
    <h3 class="mt-3 text-base font-semibold tracking-[-0.02em] text-app-text">${connection.label}</h3>
  </article>`;
}
