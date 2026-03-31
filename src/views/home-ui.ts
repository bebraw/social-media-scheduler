export const HOME_PAGE_SCRIPT = `const channelColumns = Array.from(document.querySelectorAll("[data-channel-column]"));
const queueList = document.querySelector("[data-queued-posts]");
const queuedCount = document.querySelector("[data-metric-queued]");
const todayCount = document.querySelector("[data-metric-today]");

for (const column of channelColumns) {
  const textarea = column.querySelector("[data-channel-input]");
  const statusBadge = column.querySelector("[data-channel-status]");
  const counter = column.querySelector("[data-channel-count]");
  const queueButton = column.querySelector("[data-queue-button]");
  const slotField = column.querySelector("[data-channel-slot]");

  if (!(textarea instanceof HTMLTextAreaElement) || !(statusBadge instanceof HTMLElement) || !(counter instanceof HTMLElement)) {
    continue;
  }

  const channel = column.getAttribute("data-channel-id") || "";
  const limit = Number(column.getAttribute("data-channel-limit") || "0");

  const renderUsage = () => {
    const usage = describeUsage(channel, textarea.value, limit);
    counter.textContent = usage.label;
    statusBadge.textContent = usage.stateLabel;
    statusBadge.dataset.state = usage.state;
    statusBadge.className = buildStatusClass(usage.state);
    queueButton?.toggleAttribute("disabled", usage.state === "over");
  };

  textarea.addEventListener("input", renderUsage);
  renderUsage();

  queueButton?.addEventListener("click", () => {
    if (!(queueList instanceof HTMLElement)) {
      return;
    }

    const usage = describeUsage(channel, textarea.value, limit);
    if (usage.state === "over") {
      renderUsage();
      return;
    }

    const content = textarea.value.trim();
    if (!content) {
      textarea.focus();
      return;
    }

    const card = document.createElement("article");
    card.className = "rounded-xl border border-app-line bg-white p-5";
    card.innerHTML = \`
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="rounded-full bg-app-canvas px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-app-accent-strong">\${escapeHtml(channelLabel(channel))}</span>
            <span class="text-xs font-medium uppercase tracking-[0.12em] text-app-text-soft">Queued from draft</span>
          </div>
          <p class="mt-3 max-w-2xl text-sm leading-6 text-app-text">\${escapeHtml(content)}</p>
        </div>
        <div class="sm:text-right">
          <p class="text-sm font-medium text-app-text">\${escapeHtml((slotField instanceof HTMLSelectElement ? slotField.value : "Next available slot"))}</p>
          <p class="mt-1 text-sm text-app-text-soft">Ready</p>
        </div>
      </div>
    \`;
    queueList.prepend(card);

    textarea.value = "";
    renderUsage();
    updateMetrics();
  });
}

updateMetrics();

function describeUsage(channel, value, limit) {
  const count = countChannel(channel, value);
  const ratio = limit === 0 ? 0 : count / limit;
  const state = count > limit ? "over" : ratio >= 0.85 ? "warning" : "ready";
  const stateLabel = state === "over" ? "Over limit" : state === "warning" ? "Close to limit" : "Ready";

  return {
    count,
    label: \`\${count} / \${limit}\`,
    state,
    stateLabel,
  };
}

function countChannel(channel, value) {
  if (channel === "linkedin") {
    return Array.from(value).length;
  }

  if (channel === "bluesky") {
    if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
      const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
      return Array.from(segmenter.segment(value)).length;
    }
    return Array.from(value).length;
  }

  return countXCharacters(value);
}

function countXCharacters(value) {
  const urlPattern = /https?:\\/\\/\\S+/giu;
  let total = 0;
  let lastIndex = 0;

  for (const match of value.matchAll(urlPattern)) {
    const text = match[0];
    const index = match.index || 0;
    total += countWeightedCharacters(value.slice(lastIndex, index));
    total += text.length > 0 ? 23 : 0;
    lastIndex = index + text.length;
  }

  total += countWeightedCharacters(value.slice(lastIndex));
  return total;
}

function countWeightedCharacters(value) {
  let total = 0;

  for (const character of Array.from(value)) {
    if (character.trim().length === 0) {
      total += 1;
      continue;
    }

    total += /\\p{Extended_Pictographic}/u.test(character) || isWideCodePoint(character.codePointAt(0) || 0) ? 2 : 1;
  }

  return total;
}

function isWideCodePoint(codePoint) {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe6f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6)
  );
}

function channelLabel(channel) {
  if (channel === "linkedin") return "LinkedIn";
  if (channel === "x") return "X";
  return "Bluesky";
}

function buildStatusClass(state) {
  const base = "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]";
  if (state === "over") return base + " bg-amber-50 text-amber-900";
  if (state === "warning") return base + " bg-app-canvas text-app-text";
  return base + " bg-app-accent text-white";
}

function updateMetrics() {
  if (!(queueList instanceof HTMLElement)) {
    return;
  }

  const totalCards = queueList.querySelectorAll("article").length;
  if (queuedCount instanceof HTMLElement) {
    queuedCount.textContent = String(totalCards);
  }
  if (todayCount instanceof HTMLElement) {
    todayCount.textContent = String(Math.min(totalCards, 2));
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
`;
