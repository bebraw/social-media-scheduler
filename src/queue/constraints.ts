export type QueueChannel = "linkedin" | "x" | "bluesky";

export interface ChannelConstraint {
  id: QueueChannel;
  name: string;
  limit: number;
  limitLabel: string;
  notes: string;
}

const URL_PATTERN = /https?:\/\/\S+/giu;

export const CHANNEL_CONSTRAINTS: ChannelConstraint[] = [
  {
    id: "linkedin",
    name: "LinkedIn",
    limit: 3000,
    limitLabel: "3000 characters",
    notes: "Good for fuller project context, a clear takeaway, and a direct follow-up.",
  },
  {
    id: "x",
    name: "X",
    limit: 280,
    limitLabel: "280 weighted characters",
    notes: "URLs count as 23 characters and denser Unicode content can consume the budget faster.",
  },
  {
    id: "bluesky",
    name: "Bluesky",
    limit: 300,
    limitLabel: "300 grapheme clusters",
    notes: "Short and direct still works best, but there is slightly more room than X.",
  },
];

export function countLinkedInCharacters(value: string): number {
  return Array.from(value).length;
}

export function countBlueskyGraphemes(value: string): number {
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(value)).length;
  }

  return Array.from(value).length;
}

export function countXCharacters(value: string): number {
  let total = 0;
  let lastIndex = 0;

  for (const match of value.matchAll(URL_PATTERN)) {
    const matchedText = match[0];
    const matchIndex = match.index ?? 0;

    total += countWeightedCharacters(value.slice(lastIndex, matchIndex));
    total += matchedText.length > 0 ? 23 : 0;
    lastIndex = matchIndex + matchedText.length;
  }

  total += countWeightedCharacters(value.slice(lastIndex));
  return total;
}

export function countChannelCharacters(channel: QueueChannel, value: string): number {
  switch (channel) {
    case "linkedin":
      return countLinkedInCharacters(value);
    case "x":
      return countXCharacters(value);
    case "bluesky":
      return countBlueskyGraphemes(value);
  }
}

export function getChannelConstraint(channel: QueueChannel): ChannelConstraint {
  const found = CHANNEL_CONSTRAINTS.find((constraint) => constraint.id === channel);

  if (!found) {
    throw new Error(`Unknown queue channel: ${channel}`);
  }

  return found;
}

export function describeUsage(
  channel: QueueChannel,
  value: string,
): {
  count: number;
  limit: number;
  state: "ready" | "warning" | "over";
  label: string;
} {
  const constraint = getChannelConstraint(channel);
  const count = countChannelCharacters(channel, value);
  const ratio = constraint.limit === 0 ? 0 : count / constraint.limit;
  const state = count > constraint.limit ? "over" : ratio >= 0.85 ? "warning" : "ready";

  return {
    count,
    limit: constraint.limit,
    state,
    label: `${count} / ${constraint.limit}`,
  };
}

function countWeightedCharacters(value: string): number {
  let total = 0;

  for (const character of Array.from(value)) {
    if (isWhitespace(character)) {
      total += 1;
      continue;
    }

    total += isHeavyCharacter(character) ? 2 : 1;
  }

  return total;
}

function isWhitespace(value: string): boolean {
  return value.trim().length === 0;
}

function isHeavyCharacter(character: string): boolean {
  return /\p{Extended_Pictographic}/u.test(character) || isWideCodePoint(character.codePointAt(0) ?? 0);
}

function isWideCodePoint(codePoint: number): boolean {
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
