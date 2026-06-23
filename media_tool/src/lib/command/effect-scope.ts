import { formatCueLabel, isCueRef, normalizeCueId } from "@/lib/cue-id";
import type { MediaToolItem } from "@/lib/types";

export type EffectScope =
  | { type: "current" }
  | { type: "all" }
  | { type: "even" }
  | { type: "odd" }
  | { type: "cue"; cueId: string }
  | { type: "range"; fromId: string; toId: string };

export function parseEffectScope(rest: string):
  | { scope: EffectScope; effectRaw: string }
  | { error: string } {
  const parts = rest.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { error: "Usage: @effect add|remove [<scope>] <effect_id>" };
  }
  if (parts.length === 1) {
    return { scope: { type: "current" }, effectRaw: parts[0] };
  }

  const keyword = parts[0].toLowerCase();
  if (keyword === "all" || keyword === "even" || keyword === "odd") {
    if (parts.length !== 2) {
      return {
        error: `Usage: @effect add|remove ${keyword} <effect_id>`,
      };
    }
    return { scope: { type: keyword }, effectRaw: parts[1] };
  }

  if (parts.length === 2 && isCueRef(parts[0])) {
    return {
      scope: { type: "cue", cueId: normalizeCueId(parts[0]) },
      effectRaw: parts[1],
    };
  }

  if (parts.length === 3 && isCueRef(parts[0]) && isCueRef(parts[1])) {
    return {
      scope: {
        type: "range",
        fromId: normalizeCueId(parts[0]),
        toId: normalizeCueId(parts[1]),
      },
      effectRaw: parts[2],
    };
  }

  return {
    error:
      "Usage: @effect add|remove <id>  |  all|even|odd <id>  |  <from> <to> <id>",
  };
}

function cueNumericId(id: string): number {
  const m = normalizeCueId(id).match(/^m(\d+)$/i);
  return m ? Number.parseInt(m[1], 10) : -1;
}

/** Items matching a bulk scope (not `current`). */
export function itemsForEffectScope(
  items: MediaToolItem[],
  scope: EffectScope,
): MediaToolItem[] {
  switch (scope.type) {
    case "current":
      return [];
    case "all":
      return [...items];
    case "even":
      return items.filter((it) => it.cue % 2 === 0);
    case "odd":
      return items.filter((it) => it.cue % 2 === 1);
    case "cue": {
      const id = normalizeCueId(scope.cueId).toLowerCase();
      return items.filter((it) => it.id.toLowerCase() === id);
    }
    case "range": {
      const fromN = cueNumericId(scope.fromId);
      const toN = cueNumericId(scope.toId);
      if (fromN < 0 || toN < 0) return [];
      const lo = Math.min(fromN, toN);
      const hi = Math.max(fromN, toN);
      return items.filter((it) => {
        const n = cueNumericId(it.id);
        return n >= lo && n <= hi;
      });
    }
  }
}

export function describeEffectScope(scope: EffectScope): string {
  switch (scope.type) {
    case "current":
      return "current cue";
    case "all":
      return "all cues";
    case "even":
      return "even cues";
    case "odd":
      return "odd cues";
    case "cue":
      return `cue ${formatCueLabel(scope.cueId)}`;
    case "range":
      return `cues ${formatCueLabel(scope.fromId)}–${formatCueLabel(scope.toId)}`;
  }
}
