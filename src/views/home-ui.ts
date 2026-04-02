export const HOME_PAGE_SCRIPT = `const channelTabs = Array.from(document.querySelectorAll("[data-channel-tab]"));
const channelColumns = Array.from(document.querySelectorAll("[data-channel-column]"));
const queueList = document.querySelector("[data-queued-posts]");
const queuedCount = document.querySelector("[data-metric-queued]");
const todayCount = document.querySelector("[data-metric-today]");
const historyFilters = Array.from(document.querySelectorAll("[data-history-filter]"));
const historyCards = Array.from(document.querySelectorAll("[data-history-card]"));
const historyCount = document.querySelector("[data-history-count]");
const historyEmpty = document.querySelector("[data-history-empty]");

if (channelTabs.length > 0 && channelColumns.length > 0) {
  const activateChannel = (channelId, options = {}) => {
    const shouldFocus = options.focus === true;

    for (const tab of channelTabs) {
      if (!(tab instanceof HTMLButtonElement)) {
        continue;
      }

      const isActive = tab.getAttribute("data-channel-id") === channelId;
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
      tab.tabIndex = isActive ? 0 : -1;
      tab.className = buildTabClass(isActive);

      const accent = tab.querySelector("span");
      if (accent instanceof HTMLElement) {
        accent.className = buildTabAccentClass(isActive);
      }

      if (isActive && shouldFocus) {
        tab.focus();
      }
    }

    for (const column of channelColumns) {
      if (!(column instanceof HTMLElement)) {
        continue;
      }

      column.hidden = column.getAttribute("data-channel-id") !== channelId;
    }
  };

  for (const [index, tab] of channelTabs.entries()) {
    if (!(tab instanceof HTMLButtonElement)) {
      continue;
    }

    tab.addEventListener("click", () => {
      const channelId = tab.getAttribute("data-channel-id");
      if (channelId) {
        activateChannel(channelId);
      }
    });

    tab.addEventListener("keydown", (event) => {
      const lastIndex = channelTabs.length - 1;
      let nextIndex = index;

      if (event.key === "ArrowRight") {
        nextIndex = index === lastIndex ? 0 : index + 1;
      } else if (event.key === "ArrowLeft") {
        nextIndex = index === 0 ? lastIndex : index - 1;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = lastIndex;
      } else {
        return;
      }

      event.preventDefault();
      const nextTab = channelTabs[nextIndex];
      if (!(nextTab instanceof HTMLButtonElement)) {
        return;
      }

      const channelId = nextTab.getAttribute("data-channel-id");
      if (channelId) {
        activateChannel(channelId, { focus: true });
      }
    });
  }

  const selectedTab = channelTabs.find(
    (tab) => tab instanceof HTMLElement && tab.getAttribute("aria-selected") === "true",
  );
  const initialChannelId = selectedTab?.getAttribute("data-channel-id") || channelTabs[0]?.getAttribute("data-channel-id");
  if (initialChannelId) {
    activateChannel(initialChannelId);
  }
}

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
setupHistoryFilters();

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

function buildTabClass(isActive) {
  const base =
    "rounded-xl px-4 py-3 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/20";
  return isActive ? base + " bg-app-accent text-white shadow-sm" : base + " bg-white text-app-text hover:bg-app-canvas";
}

function buildTabAccentClass(isActive) {
  return "block text-xs font-semibold uppercase tracking-[0.12em] " + (isActive ? "text-white/70" : "text-app-text-soft");
}

function buildHistoryFilterClass(isActive) {
  const base =
    "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/20";
  return isActive
    ? base + " border-app-accent bg-app-accent/10 text-app-accent-strong"
    : base + " border-app-line bg-app-canvas/50 text-app-text hover:bg-app-canvas";
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

function setupHistoryFilters() {
  if (historyFilters.length === 0 || historyCards.length === 0) {
    return;
  }

  const applyHistoryFilter = (filterValue) => {
    let visibleCount = 0;

    for (const filter of historyFilters) {
      if (!(filter instanceof HTMLButtonElement)) {
        continue;
      }

      const isActive = filter.getAttribute("data-history-filter") === filterValue;
      filter.setAttribute("aria-pressed", isActive ? "true" : "false");
      filter.className = buildHistoryFilterClass(isActive);
    }

    for (const card of historyCards) {
      if (!(card instanceof HTMLElement)) {
        continue;
      }

      const matches = filterValue === "all" || card.getAttribute("data-history-channel") === filterValue;
      card.hidden = !matches;
      if (matches) {
        visibleCount += 1;
      }
    }

    if (historyCount instanceof HTMLElement) {
      historyCount.textContent = String(visibleCount);
    }
    if (historyEmpty instanceof HTMLElement) {
      historyEmpty.hidden = visibleCount !== 0;
    }
  };

  for (const filter of historyFilters) {
    if (!(filter instanceof HTMLButtonElement)) {
      continue;
    }

    filter.addEventListener("click", () => {
      applyHistoryFilter(filter.getAttribute("data-history-filter") || "all");
    });
  }

  const initialFilter =
    historyFilters.find((filter) => filter instanceof HTMLButtonElement && filter.getAttribute("aria-pressed") === "true")?.getAttribute(
      "data-history-filter",
    ) || "all";
  applyHistoryFilter(initialFilter);
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
