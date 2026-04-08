import type { ChannelConnection, ChannelConnectionDraft } from "../channels";
import { getDefaultChannelConnectionDraft } from "../channels";
import { getChannelConstraint } from "../queue/constraints";
import { renderButton, renderPanel, renderPill, renderSectionHeader } from "./components";
import { renderWorkspacePage, type SessionUser } from "./layout";
import { escapeHtml } from "./shared";

interface SettingsPageOptions {
  canEdit: boolean;
  connections: ChannelConnection[];
  draft?: Partial<ChannelConnectionDraft>;
  error?: string;
  saved?: boolean;
  user: SessionUser;
}

export function renderSettingsPage({ canEdit, connections, draft, error, saved, user }: SettingsPageOptions): string {
  const formDraft = {
    ...getDefaultChannelConnectionDraft(),
    ...draft,
  };

  return renderWorkspacePage({
    activePath: "/settings",
    content: `<div class="grid gap-4 px-5 py-5 sm:px-8 sm:py-8 lg:grid-cols-[1.08fr_0.92fr]">
      ${renderPanel(`
        ${renderSectionHeader({
          description:
            "Add one connection per account or profile. Repeating the same provider is expected when you publish through multiple X, LinkedIn, or Bluesky accounts.",
          title: "Channel setup",
          trailing: renderPill(`${connections.length} saved`, { tone: connections.length > 0 ? "quiet-accent" : "muted" }),
        })}
        ${
          saved
            ? '<p class="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Channel connection saved.</p>'
            : ""
        }
        ${error ? `<p class="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">${escapeHtml(error)}</p>` : ""}
        ${
          connections.length > 0
            ? `<div class="mt-5 grid gap-3">${connections.map((connection) => renderConnectionCard(connection)).join("")}</div>`
            : '<p class="mt-5 rounded-xl border border-dashed border-app-line bg-app-canvas/50 px-4 py-4 text-sm leading-6 text-app-text-soft">No channel connections are saved yet. Add only the accounts you actually need so the workspace stays intentional.</p>'
        }
      `)}
      ${renderPanel(`
        ${renderSectionHeader({
          description:
            "Tokens are encrypted before they are written to D1. For Bluesky, enter a handle and app password; for X, use a user-context access token; for LinkedIn, use a member access token tied to the profile you want to save.",
          title: canEdit ? "Add connection" : "Connection access",
        })}
        ${
          canEdit
            ? renderConnectionForm(formDraft)
            : '<p class="mt-4 rounded-xl border border-app-line bg-app-canvas/50 px-4 py-4 text-sm leading-6 text-app-text-soft">Readonly users can inspect saved channel connections, but only editors can add or rotate credentials.</p>'
        }
      `)}
    </div>`,
    description: "Manage per-account channel connections and keep publishing credentials encrypted at rest.",
    title: "Settings",
    user,
  });
}

function renderConnectionCard(connection: ChannelConnection): string {
  const channel = getChannelConstraint(connection.channel);

  return `<article class="rounded-xl border border-app-line bg-app-canvas/40 p-4" data-channel-connection="${escapeHtml(connection.id)}">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div class="flex flex-wrap items-center gap-2">
          ${renderPill(channel.name, { tone: "quiet-accent" })}
          ${renderPill(connection.hasRefreshToken ? "Refresh token saved" : "Access token only")}
        </div>
        <h2 class="mt-3 text-lg font-semibold tracking-[-0.02em] text-app-text">${escapeHtml(connection.label)}</h2>
        <p class="mt-1 text-sm leading-6 text-app-text-soft">${escapeHtml(connection.accountHandle)}</p>
      </div>
      <div class="rounded-xl border border-app-line bg-white px-3 py-3 text-sm text-app-text-soft sm:min-w-52">
        <p><span class="font-medium text-app-text">Created:</span> ${escapeHtml(formatTimestamp(connection.createdAt))}</p>
        <p class="mt-1"><span class="font-medium text-app-text">Updated:</span> ${escapeHtml(formatTimestamp(connection.updatedAt))}</p>
      </div>
    </div>
  </article>`;
}

function renderConnectionForm(draft: ChannelConnectionDraft): string {
  return `<form class="mt-5 grid gap-4" method="post" action="/settings/channels">
    <label class="grid gap-2 text-sm font-medium">
      <span>Channel</span>
      <select class="rounded-xl border border-app-line bg-white px-4 py-3 text-sm text-app-text focus:border-app-accent focus:outline-none focus:ring-2 focus:ring-app-accent/10" name="channel">
        ${renderChannelOption("linkedin", "LinkedIn", draft.channel)}
        ${renderChannelOption("x", "X", draft.channel)}
        ${renderChannelOption("bluesky", "Bluesky", draft.channel)}
      </select>
    </label>
    <label class="grid gap-2 text-sm font-medium">
      <span>Connection label</span>
      <input class="rounded-xl border border-app-line bg-white px-4 py-3 text-sm text-app-text focus:border-app-accent focus:outline-none focus:ring-2 focus:ring-app-accent/10" name="label" type="text" value="${escapeHtml(draft.label)}" maxlength="80" placeholder="Personal X">
    </label>
    <label class="grid gap-2 text-sm font-medium">
      <span>Handle or profile label</span>
      <input class="rounded-xl border border-app-line bg-white px-4 py-3 text-sm text-app-text focus:border-app-accent focus:outline-none focus:ring-2 focus:ring-app-accent/10" name="accountHandle" type="text" value="${escapeHtml(draft.accountHandle)}" maxlength="120" placeholder="@your-handle">
    </label>
    <label class="grid gap-2 text-sm font-medium">
      <span>Access token</span>
      <input class="rounded-xl border border-app-line bg-white px-4 py-3 text-sm text-app-text focus:border-app-accent focus:outline-none focus:ring-2 focus:ring-app-accent/10" name="accessToken" type="password" value="${escapeHtml(draft.accessToken)}" autocomplete="off">
    </label>
    <label class="grid gap-2 text-sm font-medium">
      <span>Refresh token</span>
      <input class="rounded-xl border border-app-line bg-white px-4 py-3 text-sm text-app-text focus:border-app-accent focus:outline-none focus:ring-2 focus:ring-app-accent/10" name="refreshToken" type="password" value="${escapeHtml(draft.refreshToken)}" autocomplete="off">
      <span class="text-xs leading-5 text-app-text-soft">Optional. Save it when the provider issues renewable credentials. Leave it blank for Bluesky app-password sign-in.</span>
    </label>
    <div class="flex flex-col gap-3 border-t border-app-line pt-4">
      <p class="text-sm leading-6 text-app-text-soft">Each saved credential is encrypted in the app_secrets store; the settings page only keeps non-sensitive account metadata readable. Bluesky app passwords are exchanged for session tokens and are not stored directly, X connections normalize the saved handle from the validated token, and LinkedIn connections save a normalized member identifier from the validated profile.</p>
      ${renderButton({ label: "Save channel connection", type: "submit", variant: "primary" })}
    </div>
  </form>`;
}

function renderChannelOption(value: string, label: string, selectedValue: string): string {
  return `<option value="${value}"${selectedValue === value ? " selected" : ""}>${label}</option>`;
}

function formatTimestamp(value: string): string {
  return value.replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}
