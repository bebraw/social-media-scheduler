import type { QueuedPost } from "../publishing";
import type { ChannelPostingSchedule } from "../schedule";
import { getQueuedPostNextOccurrence } from "../publishing";
import { renderButton, renderPill } from "./components";
import { formatChannelLabel } from "./history-components";
import { escapeHtml } from "./shared";

export function renderQueuedPosts(
  posts: QueuedPost[],
  schedules: ChannelPostingSchedule[],
  options: { canEdit: boolean; now?: Date },
): string {
  const now = options.now || new Date();

  return posts
    .map((post) => {
      const nextOccurrence = getQueuedPostNextOccurrence(post, schedules, now);

      return `<article class="rounded-xl border border-app-line bg-white p-5" data-queued-post-card>
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              ${renderPill(formatChannelLabel(post.channel), { tone: "quiet-accent" })}
              ${renderPill(post.connectionLabel)}
              <span class="text-xs font-medium uppercase tracking-[0.12em] text-app-text-soft">Queued</span>
            </div>
            <p class="mt-3 max-w-2xl text-sm leading-6 text-app-text">${escapeHtml(post.body)}</p>
            <div class="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-app-text-soft">
              <span>Queued: ${escapeHtml(formatTimestamp(post.createdAt))}</span>
              ${
                nextOccurrence
                  ? `<span>Next eligible slot: ${escapeHtml(formatTimestamp(nextOccurrence.toISOString()))}</span>`
                  : `<span>No schedule available</span>`
              }
              ${post.lastError ? `<span class="text-rose-700">Last error: ${escapeHtml(post.lastError)}</span>` : ""}
            </div>
          </div>
          ${
            options.canEdit
              ? `<form method="post" action="/queue/delete">
            <input type="hidden" name="queuedPostId" value="${escapeHtml(post.id)}">
            ${renderButton({ className: "bg-white hover:bg-app-canvas", label: "Remove from queue", type: "submit" })}
          </form>`
              : ""
          }
        </div>
      </article>`;
    })
    .join("");
}

function formatTimestamp(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(timestamp));
}
