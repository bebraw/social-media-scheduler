import type { SentPostHistoryEntry } from "../history";
import { renderStatGrid } from "./cards";
import { HOME_PAGE_SCRIPT } from "./home-ui";
import { renderHistoryCards, renderHistoryFilters } from "./history-components";
import { renderWorkspacePage, type SessionUser } from "./layout";

const pageTitle = "Sent History";
const pageDescription = "Inspect previously sent posts per channel in a dedicated workspace.";

interface HistoryPageOptions {
  demoAvailable: boolean;
  sentHistory: SentPostHistoryEntry[];
  user: SessionUser;
}

export function renderHistoryPage({ demoAvailable, sentHistory, user }: HistoryPageOptions): string {
  return renderWorkspacePage({
    activePath: "/history",
    content: `<div class="grid gap-4 px-5 py-5 sm:px-8 sm:py-8 lg:grid-cols-[0.8fr_1.2fr]">
      <section class="grid gap-4">
        <section class="rounded-xl border border-app-line bg-white p-6">
          <h2 class="text-lg font-semibold tracking-[-0.02em]">Filters</h2>
          <p class="mt-3 text-sm leading-6 text-app-text-soft">Filter by channel to inspect recent tone, cadence, and output patterns without leaving the scheduler.</p>
        </section>
        <section class="rounded-xl border border-app-line bg-white p-6">
          <h2 class="text-lg font-semibold tracking-[-0.02em]">Coverage</h2>
          ${renderStatGrid([
            { label: "Tracked posts", value: String(sentHistory.length), valueAttributes: "data-history-count" },
            { label: "Channels", value: "3" },
            {
              content:
                '<p class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">Queue</p><a class="mt-2 inline-flex text-sm font-semibold text-app-accent-strong underline decoration-app-accent/25 underline-offset-4" href="/">Return to queue</a>',
            },
          ])}
        </section>
      </section>
      <section class="rounded-xl border border-app-line bg-white p-6">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 class="text-lg font-semibold tracking-[-0.02em]">Channel history</h2>
            <p class="mt-1 max-w-2xl text-sm leading-6 text-app-text-soft">Review sent posts by channel to compare tone, cadence, and recent output.</p>
          </div>
          <p class="text-sm font-medium text-app-text-soft">Inspect by channel</p>
        </div>
        <div class="mt-5 flex flex-wrap gap-2" aria-label="Sent history filters">
          ${renderHistoryFilters(sentHistory)}
        </div>
        <div class="mt-5 grid gap-3" data-sent-history-list>${renderHistoryCards(sentHistory)}</div>
        <p class="mt-4${sentHistory.length === 0 ? "" : " hidden"} rounded-xl border border-dashed border-app-line bg-app-canvas/50 px-4 py-3 text-sm text-app-text-soft" data-history-empty>No sent posts are available yet.</p>
      </section>
    </div>`,
    demoAvailable,
    description: pageDescription,
    title: pageTitle,
    user,
  });
}

export { HOME_PAGE_SCRIPT };
