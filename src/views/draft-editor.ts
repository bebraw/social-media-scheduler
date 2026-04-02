import { CHANNEL_CONSTRAINTS, describeUsage, type ChannelConstraint, type QueueChannel } from "../queue/constraints";
import type { DemoDraft } from "../demo";
import { renderButton } from "./components";
import { escapeHtml, renderAttachmentComposer } from "./shared";

export interface ComposerDraft {
  accent: string;
  content: string;
  id: QueueChannel;
  placeholder: string;
  slot: string;
  subtitle: string;
}

interface DraftEntry {
  constraint: ChannelConstraint;
  draft: {
    accent: string;
    content: string;
    id: QueueChannel;
    placeholder?: string;
    slot: string;
    subtitle: string;
  };
  usage: ReturnType<typeof describeUsage>;
}

export function getDefaultComposerDrafts(): ComposerDraft[] {
  return [
    {
      id: "linkedin",
      subtitle: "Longer project update",
      accent: "Professional update",
      content: "",
      placeholder: "Write the next LinkedIn update for this project.",
      slot: "Next available slot",
    },
    {
      id: "x",
      subtitle: "Short post with tighter budget",
      accent: "Tight summary",
      content: "",
      placeholder: "Write the next X post.",
      slot: "Next available slot",
    },
    {
      id: "bluesky",
      subtitle: "Short post with room for voice",
      accent: "Concise status post",
      content: "",
      placeholder: "Write the next Bluesky post.",
      slot: "Next available slot",
    },
  ];
}

export function resolveDraftEntries(drafts: Array<ComposerDraft | DemoDraft>): DraftEntry[] {
  return drafts.flatMap((draft) => {
    const constraint = CHANNEL_CONSTRAINTS.find((item) => item.id === draft.id);
    if (!constraint) {
      return [];
    }

    return [
      {
        draft,
        constraint,
        usage: describeUsage(draft.id, draft.content),
      },
    ];
  });
}

export function renderDraftTabs(entries: DraftEntry[], idPrefix: string): string {
  return entries
    .map(({ draft, constraint }, index) => {
      const isSelected = index === 0;

      return `<button class="${buildTabClass(isSelected)}" type="button" role="tab" id="${escapeHtml(idPrefix)}-tab-${escapeHtml(
        draft.id,
      )}" aria-selected="${isSelected ? "true" : "false"}" aria-controls="${escapeHtml(idPrefix)}-panel-${escapeHtml(
        draft.id,
      )}" tabindex="${isSelected ? "0" : "-1"}" data-channel-tab data-channel-id="${escapeHtml(draft.id)}">
        <span class="${buildTabAccentClass(isSelected)}">${escapeHtml(draft.accent)}</span>
        <span class="mt-2 block text-base tracking-[-0.02em]">${escapeHtml(constraint.name)}</span>
      </button>`;
    })
    .join("");
}

export function renderComposeDraftPanels(entries: DraftEntry[]): string {
  return entries
    .map(({ constraint, draft, usage }, index) => {
      const isSelected = index === 0;

      return renderDraftPanel({
        constraint,
        draft,
        editorLabel: `${constraint.name} post copy`,
        panelIdPrefix: "draft",
        selected: isSelected,
        sideContent: `${renderConstraintCard(constraint.limitLabel, usage.label)}
          <div class="rounded-xl border border-app-line bg-app-canvas/60 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">Channel note</p>
            <p class="mt-2 text-sm leading-6 text-app-text-soft">${escapeHtml(constraint.notes)}</p>
          </div>
          ${renderAttachmentComposer({ channelName: constraint.name, serverMode: false })}
          ${renderSlotSelector(constraint.name, draft.slot)}
          <div class="flex flex-wrap gap-3 pt-2">
            ${renderButton({ attributes: 'data-queue-button data-queue-mode="client"', label: "Queue post", variant: "primary" })}
            ${renderButton({ className: "bg-white hover:bg-app-canvas", label: "Save draft" })}
          </div>`,
        statusClass: buildUsageStateClass(usage.state),
        statusLabel: usage.state === "over" ? "Over limit" : usage.state === "warning" ? "Close to limit" : "Ready",
        textareaContent: draft.content,
        textareaPlaceholder: draft.placeholder,
      });
    })
    .join("");
}

export function renderDemoDraftPanels(entries: DraftEntry[]): string {
  return entries
    .map(({ constraint, draft }, index) => {
      const isSelected = index === 0;

      return renderDraftPanel({
        beforeEditor: `<form class="contents" method="post" action="/demo/queue" enctype="multipart/form-data">
          <input type="hidden" name="channel" value="${escapeHtml(draft.id)}">`,
        constraint,
        draft,
        editorAriaLabel: `${constraint.name} post copy`,
        editorLabel: `${constraint.name} demo post`,
        inputName: "body",
        panelIdPrefix: "demo",
        selected: isSelected,
        sideContent: `${renderConstraintCard(constraint.limitLabel, `0 / ${escapeHtml(String(constraint.limit))}`)}
          <div class="rounded-xl border border-app-line bg-app-canvas/60 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">Demo safety</p>
            <p class="mt-2 text-sm leading-6 text-app-text-soft">Scheduling here only updates local demo data. It does not call any external publishing service.</p>
          </div>
          ${renderAttachmentComposer({ channelName: constraint.name, serverMode: true })}
          ${renderSlotSelector(constraint.name, draft.slot, "slot")}
          <div class="flex flex-wrap gap-3 pt-2">
            ${renderButton({ attributes: 'data-queue-button data-queue-mode="server"', label: "Schedule demo post", type: "submit", variant: "primary" })}
          </div>`,
        statusClass: "rounded-full bg-app-accent px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white",
        statusLabel: "Ready",
        textareaAttributes: `data-channel-limit="${constraint.limit}"`,
        textareaContent: draft.content,
      });
    })
    .join("");
}

function buildTabClass(isSelected: boolean): string {
  return `${isSelected ? "bg-app-accent text-white shadow-sm" : "bg-white text-app-text hover:bg-app-canvas"} rounded-xl px-4 py-3 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/20`;
}

function buildTabAccentClass(isSelected: boolean): string {
  return `block text-xs font-semibold uppercase tracking-[0.12em] ${isSelected ? "text-white/70" : "text-app-text-soft"}`;
}

function buildUsageStateClass(state: "ready" | "warning" | "over"): string {
  if (state === "over") {
    return "rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-amber-900";
  }
  if (state === "warning") {
    return "rounded-full bg-app-canvas px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-app-text";
  }
  return "rounded-full bg-app-accent px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white";
}

function renderConstraintCard(limitLabel: string, usageLabel: string): string {
  return `<div class="rounded-xl border border-app-line bg-app-canvas/60 px-4 py-3">
    <div class="flex items-center justify-between gap-3">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">Constraint</p>
        <p class="mt-2 text-sm font-medium text-app-text">${escapeHtml(limitLabel)}</p>
      </div>
      <span class="text-sm font-medium text-app-text" data-channel-count>${usageLabel}</span>
    </div>
  </div>`;
}

function renderDraftPanel(options: {
  beforeEditor?: string;
  constraint: ChannelConstraint;
  draft: DraftEntry["draft"];
  editorAriaLabel?: string;
  editorLabel: string;
  inputName?: string;
  panelIdPrefix: string;
  selected: boolean;
  sideContent: string;
  statusClass: string;
  statusLabel: string;
  textareaAttributes?: string;
  textareaContent: string;
  textareaPlaceholder?: string;
}): string {
  const {
    beforeEditor = "",
    constraint,
    draft,
    editorAriaLabel = options.editorLabel,
    editorLabel,
    inputName,
    panelIdPrefix,
    selected,
    sideContent,
    statusClass,
    statusLabel,
    textareaAttributes,
    textareaContent,
    textareaPlaceholder,
  } = options;

  return `<section class="grid gap-5 rounded-xl border border-app-line bg-white p-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]" role="tabpanel" id="${escapeHtml(
    panelIdPrefix,
  )}-panel-${escapeHtml(draft.id)}" aria-labelledby="${escapeHtml(panelIdPrefix)}-tab-${escapeHtml(draft.id)}" ${
    selected ? "" : "hidden"
  } data-channel-column data-channel-id="${escapeHtml(draft.id)}" data-channel-limit="${constraint.limit}">
        ${beforeEditor}
        <div class="min-w-0">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">${escapeHtml(draft.accent)}</p>
              <h3 class="mt-2 text-xl font-semibold tracking-[-0.03em]">${escapeHtml(constraint.name)}</h3>
              <p class="mt-1 max-w-2xl text-sm leading-6 text-app-text-soft">${escapeHtml(draft.subtitle)}</p>
            </div>
            <span class="${statusClass}" data-channel-status>${escapeHtml(statusLabel)}</span>
          </div>
          <label class="mt-5 grid gap-2 text-sm font-medium">
            <span>${escapeHtml(editorLabel)}</span>
            <textarea class="min-h-80 rounded-xl border border-app-line bg-app-canvas/40 px-4 py-4 text-sm leading-6 text-app-text outline-none transition placeholder:text-app-text-soft/70 focus:border-app-accent focus:ring-2 focus:ring-app-accent/10" ${
              inputName ? `name="${inputName}"` : ""
            } data-channel-input aria-label="${escapeHtml(editorAriaLabel)}"${
              textareaPlaceholder ? ` placeholder="${escapeHtml(textareaPlaceholder)}"` : ""
            }${textareaAttributes ? ` ${textareaAttributes}` : ""}>${escapeHtml(textareaContent)}</textarea>
          </label>
        </div>
        <div class="grid gap-3 self-start">
          ${sideContent}
        </div>
        ${beforeEditor ? "</form>" : ""}
      </section>`;
}

function renderSlotSelector(channelName: string, slot: string, fieldName?: string): string {
  return `<label class="grid gap-2 text-sm font-medium">
    <span>Queue slot</span>
    <select class="rounded-xl border border-app-line bg-white px-4 py-3 text-sm text-app-text outline-none transition focus:border-app-accent focus:ring-2 focus:ring-app-accent/10" ${
      fieldName ? `name="${fieldName}"` : ""
    } data-channel-slot aria-label="${escapeHtml(channelName)} queue slot">
      <option>${escapeHtml(slot)}</option>
      <option>Tomorrow, 09:00</option>
      <option>Tomorrow, 13:00</option>
    </select>
  </label>`;
}
