import { escapeHtml } from "./html";

type ButtonVariant = "primary" | "secondary";
type PillTone = "muted" | "accent" | "quiet-accent";

interface ButtonOptions {
  attributes?: string;
  className?: string;
  label: string;
  type?: "button" | "submit" | "reset";
  variant?: ButtonVariant;
}

interface LinkButtonOptions {
  attributes?: string;
  className?: string;
  href: string;
  label: string;
  variant?: ButtonVariant | "inline";
}

interface PanelOptions {
  className?: string;
  tag?: "article" | "div" | "section";
}

interface PillOptions {
  className?: string;
  tone?: PillTone;
}

interface SectionHeaderOptions {
  className?: string;
  description: string;
  title: string;
  trailing?: string;
}

export function renderButton({ attributes = "", className = "", label, type = "button", variant = "secondary" }: ButtonOptions): string {
  return `<button class="${buildButtonClass(variant, className)}" type="${type}"${attributes ? ` ${attributes}` : ""}>${escapeHtml(label)}</button>`;
}

export function renderLinkButton({ attributes = "", className = "", href, label, variant = "secondary" }: LinkButtonOptions): string {
  if (variant === "inline") {
    return `<a class="${buildInlineLinkClass(className)}" href="${escapeHtml(href)}"${attributes ? ` ${attributes}` : ""}>${escapeHtml(label)}</a>`;
  }

  return `<a class="${buildButtonClass(variant, className)}" href="${escapeHtml(href)}"${attributes ? ` ${attributes}` : ""}>${escapeHtml(label)}</a>`;
}

export function renderPanel(content: string, { className = "", tag = "section" }: PanelOptions = {}): string {
  return `<${tag} class="rounded-xl border border-app-line bg-white p-6${className ? ` ${className}` : ""}">${content}</${tag}>`;
}

export function renderPill(label: string, { className = "", tone = "muted" }: PillOptions = {}): string {
  return `<span class="${buildPillClass(tone, className)}">${escapeHtml(label)}</span>`;
}

export function renderSectionHeader({ className = "", description, title, trailing }: SectionHeaderOptions): string {
  return `<div class="flex justify-between gap-3${className ? ` ${className}` : ""}">
    <div>
      <h2 class="text-lg font-semibold tracking-[-0.02em]">${escapeHtml(title)}</h2>
      <p class="mt-1 text-sm leading-6 text-app-text-soft">${escapeHtml(description)}</p>
    </div>
    ${trailing || ""}
  </div>`;
}

function buildButtonClass(variant: ButtonVariant, className: string): string {
  const base = "inline-flex rounded-xl px-4 py-3 text-sm font-semibold transition";
  const variantClass =
    variant === "primary"
      ? "bg-app-accent text-white hover:bg-app-accent-strong"
      : "border border-app-line bg-app-canvas text-app-text hover:bg-white";

  return `${base} ${variantClass}${className ? ` ${className}` : ""}`;
}

function buildInlineLinkClass(className: string): string {
  const base = "font-semibold text-app-accent-strong underline decoration-app-accent/25 underline-offset-4";
  return `${base}${className ? ` ${className}` : ""}`;
}

function buildPillClass(tone: PillTone, className: string): string {
  const base = "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]";
  const toneClass =
    tone === "accent"
      ? "bg-app-accent text-white"
      : tone === "quiet-accent"
        ? "bg-app-canvas text-app-accent-strong"
        : "bg-app-canvas text-app-text-soft";

  return `${base} ${toneClass}${className ? ` ${className}` : ""}`;
}
