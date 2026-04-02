import { renderPanel, renderSectionHeader } from "./components";
import { escapeHtml } from "./shared";

interface StatCard {
  content?: string;
  label?: string;
  value?: string;
  valueAttributes?: string;
}

interface QueuedPostsSectionOptions {
  badge: string;
  description: string;
  emptyText?: string;
  postsMarkup?: string;
  title: string;
}

export function renderStatGrid(cards: StatCard[]): string {
  return `<div class="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
    ${cards.map((card) => renderStatCard(card)).join("")}
  </div>`;
}

export function renderQueuedPostsSection({ badge, description, emptyText, postsMarkup = "", title }: QueuedPostsSectionOptions): string {
  const hasPosts = postsMarkup.trim().length > 0;

  return renderPanel(`
    ${renderSectionHeader({
      className: "items-start",
      description,
      title,
      trailing: `<span class="text-sm font-medium text-app-text-soft">${escapeHtml(badge)}</span>`,
    })}
    <div class="mt-5 grid gap-3" data-queued-posts>${postsMarkup}</div>
    ${
      emptyText
        ? `<p class="mt-5${hasPosts ? " hidden" : ""} rounded-xl border border-dashed border-app-line bg-app-canvas/50 px-4 py-3 text-sm text-app-text-soft" data-queued-empty>${escapeHtml(
            emptyText,
          )}</p>`
        : ""
    }
  `);
}

function renderStatCard(card: StatCard): string {
  if (card.content) {
    return `<div class="rounded-xl border border-app-line bg-app-canvas/60 px-4 py-3">${card.content}</div>`;
  }

  return `<div class="rounded-xl border border-app-line bg-app-canvas/60 px-4 py-3">
    <p class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">${escapeHtml(card.label || "")}</p>
    <p class="mt-2 text-2xl font-semibold text-app-text"${card.valueAttributes ? ` ${card.valueAttributes}` : ""}>${escapeHtml(card.value || "")}</p>
  </div>`;
}
