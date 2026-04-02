import type { SentPostHistoryEntry } from "../history";
import { renderPanel } from "./components";
import { HOME_PAGE_SCRIPT } from "./home-ui";
import { renderHistoryCards, renderHistoryFilters } from "./history-components";
import { renderWorkspacePage, type SessionUser } from "./layout";

const pageTitle = "History";
const pageDescription = "Review previously sent posts by channel.";

interface HistoryPageOptions {
  demoAvailable: boolean;
  sentHistory: SentPostHistoryEntry[];
  user: SessionUser;
}

export function renderHistoryPage({ demoAvailable, sentHistory, user }: HistoryPageOptions): string {
  return renderWorkspacePage({
    activePath: "/history",
    content: `<div class="grid gap-4 px-5 py-5 sm:px-8 sm:py-8">
      ${renderPanel(`
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 class="text-lg font-semibold tracking-[-0.02em]">Channel history</h2>
            <p class="mt-1 max-w-2xl text-sm leading-6 text-app-text-soft">Filter sent posts by channel.</p>
          </div>
          <p class="text-sm font-medium text-app-text-soft"><span data-history-count>${sentHistory.length}</span> posts shown</p>
        </div>
        <div class="mt-5 flex flex-wrap gap-2" aria-label="History filters">
          ${renderHistoryFilters(sentHistory)}
        </div>
        <div class="mt-5 grid gap-3" data-sent-history-list>${renderHistoryCards(sentHistory)}</div>
        <p class="mt-4${sentHistory.length === 0 ? "" : " hidden"} rounded-xl border border-dashed border-app-line bg-app-canvas/50 px-4 py-3 text-sm text-app-text-soft" data-history-empty>No sent posts are available yet.</p>
      `)}
    </div>`,
    demoAvailable,
    description: pageDescription,
    title: pageTitle,
    user,
  });
}

export { HOME_PAGE_SCRIPT };
