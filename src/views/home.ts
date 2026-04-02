import type { ChannelPostingSchedule } from "../schedule";
import { renderQueuedPostsSection, renderStatGrid } from "./cards";
import { renderLinkButton, renderPanel, renderSectionHeader } from "./components";
import { HOME_PAGE_SCRIPT } from "./home-ui";
import { renderWorkspacePage, type SessionUser } from "./layout";
import { renderPostingSchedulePanel } from "./posting-schedule";

interface QueuePageOptions {
  demoAvailable: boolean;
  postingSchedules: ChannelPostingSchedule[];
  scheduleError?: string;
  scheduleSaved?: boolean;
  user: SessionUser;
}

export function renderQueuePage({ demoAvailable, postingSchedules, scheduleError, scheduleSaved, user }: QueuePageOptions): string {
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
            { label: "Connected channels", value: "3" },
          ])}
        `)}
        ${renderPostingSchedulePanel({
          canEdit: user.role !== "readonly",
          error: scheduleError,
          saved: scheduleSaved,
          schedules: postingSchedules,
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
