import type { ChannelConnection } from "../channels";
import { CHANNEL_CONSTRAINTS, describeUsage, type ChannelConstraint, type QueueChannel } from "../queue/constraints";
import { renderButton } from "./components";
import { escapeHtml, renderAttachmentComposer } from "./shared";

export interface ComposerDraft {
  accountHandle: string;
  accent: string;
  channel: QueueChannel;
  content: string;
  id: string;
  label: string;
  placeholder: string;
  slot: string;
  subtitle: string;
}

interface DraftEntry {
  constraint: ChannelConstraint;
  draft: {
    accountHandle: string;
    accent: string;
    content: string;
    channel: QueueChannel;
    id: string;
    label: string;
    placeholder?: string;
    slot: string;
    subtitle: string;
  };
  usage: ReturnType<typeof describeUsage>;
}

export function buildComposerDrafts(connections: ChannelConnection[]): ComposerDraft[] {
  return connections.map((connection) => {
    const constraint = CHANNEL_CONSTRAINTS.find((item) => item.id === connection.channel)!;

    return {
      accountHandle: connection.accountHandle,
      accent: constraint.name,
      channel: connection.channel,
      content: "",
      id: connection.id,
      label: connection.label,
      placeholder: `Write the next ${constraint.name} post for ${connection.label}.`,
      slot: "Next available slot",
      subtitle: connection.accountHandle,
    };
  });
}

export function resolveDraftEntries(drafts: ComposerDraft[]): DraftEntry[] {
  return drafts.flatMap((draft) => {
    const channel = draft.channel;
    const constraint = CHANNEL_CONSTRAINTS.find((item) => item.id === channel);
    if (!constraint) {
      return [];
    }

    return [
      {
        draft: {
          accountHandle: draft.accountHandle,
          accent: draft.accent,
          channel,
          content: draft.content,
          id: draft.id,
          label: draft.label,
          placeholder: draft.placeholder,
          slot: draft.slot,
          subtitle: draft.subtitle,
        },
        constraint,
        usage: describeUsage(channel, draft.content),
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
        <span class="mt-2 block text-base tracking-[-0.02em]">${escapeHtml(draft.label)}</span>
        ${
          draft.accountHandle
            ? `<span class="mt-1 block text-xs font-medium ${isSelected ? "text-white/70" : "text-app-text-soft"}">${escapeHtml(draft.accountHandle)}</span>`
            : ""
        }
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
        editorLabel: `${draft.label} post copy`,
        panelIdPrefix: "draft",
        selected: isSelected,
        sideContent: `${renderConstraintCard(constraint.limitLabel, usage.label)}
          <div class="rounded-xl border border-app-line bg-app-canvas/60 px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">Channel note</p>
            <p class="mt-2 text-sm leading-6 text-app-text-soft">${escapeHtml(constraint.notes)}</p>
          </div>
          ${renderAttachmentComposer({ channelName: draft.label, serverMode: false })}
          ${renderSlotSelector(draft.label, draft.slot)}
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
  } data-channel-column data-channel-id="${escapeHtml(draft.id)}" data-channel-kind="${escapeHtml(draft.channel)}" data-channel-label="${escapeHtml(
    draft.label,
  )}" data-channel-account-handle="${escapeHtml(draft.accountHandle)}" data-channel-limit="${constraint.limit}">
        ${beforeEditor}
        <div class="min-w-0">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">${escapeHtml(draft.accent)}</p>
              <h3 class="mt-2 text-xl font-semibold tracking-[-0.03em]">${escapeHtml(draft.label)}</h3>
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
