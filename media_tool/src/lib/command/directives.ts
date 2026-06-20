import { formatCueLabel, normalizeCueId } from "@/lib/cue-id";
import { parseGallerySize } from "./gallery-size";
import type { ParsedDirective } from "./types";

export { normalizeCueId, formatCueLabel };

const CUE_REF = String.raw`(m?\d+)`;

const HELP_TEXT = `Directives (@ prefix):
  @help @help effects @help mode  @info @layers @effects @status
  @effect add|remove <id>
  @mode  @mode <historical|stock|artifact|text_graphic|effect_only>
  @cue 22  @22  @next  @prev  @next incomplete
  @episode 002  @episodes
  @search library|google|gif|video <query>
  @add <n>  @preview <n>
  @gallery [tiny|small|medium|large]
  @save  @clear  @complete
  @inpoint [sec|m:ss|playhead|clear]
  @render <cue>  @render <from> <to>
  @play  @play loop  @play loop 5
  @cue split: … @end
  @cue merge 8 9  @use 8  @confirm  @cancel

Cue refs: 22, 022, m22, or m022 (same cue).
⌃/⌘ ]  next cue · ⌃/⌘ [  prev cue
Natural language (no @) — agent coming in phase 4.
Enter = submit · Shift+Enter = newline · Tab = focus prompt
Legacy UI: ?legacy=1`;

export function helpText(): string {
  return HELP_TEXT;
}

/** Parse a single submitted prompt (may be multiline for split blocks). */
export function parseDirectiveInput(raw: string): ParsedDirective {
  const text = raw.trim();
  if (!text) return { kind: "unknown", raw: "" };

  if (!text.startsWith("@")) {
    return { kind: "unknown", raw: text };
  }

  // Multiline split block
  if (text.toLowerCase().startsWith("@cue split:")) {
    const body = text.slice("@cue split:".length);
    const endIdx = body.search(/\n@end\s*$/i);
    if (endIdx < 0) {
      return {
        kind: "unknown",
        raw: "Split block must end with @end on its own line.",
      };
    }
    const inner = body.slice(0, endIdx);
    const lines = inner
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      return {
        kind: "unknown",
        raw: "Split needs at least 2 non-empty lines between @cue split: and @end.",
      };
    }
    return { kind: "split", lines };
  }

  const line = text.split("\n")[0]?.trim() ?? text;
  const lower = line.toLowerCase();

  if (/^@help\s+effects?\s*$/i.test(line)) {
    return { kind: "helpTopic", topic: "effects" };
  }
  if (/^@help\s+modes?\s*$/i.test(line)) {
    return { kind: "helpTopic", topic: "modes" };
  }
  if (lower === "@help") return { kind: "help" };
  if (lower === "@info") return { kind: "info" };
  if (lower === "@layers") return { kind: "layers" };
  if (lower === "@effects") return { kind: "effects" };
  if (lower === "@status") return { kind: "status" };
  if (lower === "@save") return { kind: "save" };
  if (lower === "@clear") return { kind: "clear" };
  if (lower === "@complete") return { kind: "complete" };
  if (lower === "@confirm") return { kind: "confirm" };
  if (lower === "@cancel") return { kind: "cancel" };
  if (lower === "@next") return { kind: "navigate", target: "next" };
  if (lower === "@prev") return { kind: "navigate", target: "prev" };
  if (lower === "@next incomplete") {
    return { kind: "navigate", target: "next_incomplete" };
  }
  if (lower === "@episodes") return { kind: "episodes" };

  let m = line.match(/^@inpoint(?:\s+(\S+))?\s*$/i);
  if (m) return { kind: "inpoint", arg: m[1] };

  m = line.match(new RegExp(`^@(?:cue\\s+)?${CUE_REF}\\s*$`, "i"));
  if (m) {
    return {
      kind: "navigate",
      target: "cue",
      cueId: normalizeCueId(m[1]),
    };
  }

  m = line.match(/^@episode\s+(\S+)\s*$/i);
  if (m) return { kind: "episode", ref: m[1] };

  m = line.match(/^@effect\s+(add|remove)\s+(\S+)\s*$/i);
  if (m) {
    return {
      kind: "effect",
      action: m[1].toLowerCase() as "add" | "remove",
      id: m[2],
    };
  }

  m = line.match(/^@mode(?:\s+(\S+))?\s*$/i);
  if (m) {
    const arg = m[1]?.trim();
    return arg ? { kind: "mode", set: arg } : { kind: "mode" };
  }

  m = line.match(/^@render\s+(\S+)(?:\s+(\S+))?\s*$/i);
  if (m) {
    const args = [m[1], m[2]].filter(Boolean) as string[];
    return { kind: "render", args };
  }

  m = line.match(/^@play\s+loop(?:\s+(\d+))?\s*$/i);
  if (m) {
    if (m[1]) {
      const count = Number.parseInt(m[1], 10);
      if (count < 1) {
        return { kind: "unknown", raw: "Loop count must be at least 1." };
      }
      return { kind: "play", loopCount: count };
    }
    return { kind: "play", loopCount: null };
  }

  if (lower === "@play") return { kind: "play" };

  m = line.match(/^@search\s+(library|google|gif|video)\s+(.+)$/i);
  if (m) {
    return {
      kind: "search",
      engine: m[1].toLowerCase() as ParsedDirective extends {
        kind: "search";
      }
        ? ParsedDirective["engine"]
        : never,
      query: m[2].trim(),
    };
  }

  m = line.match(/^@add\s+(\d+)\s*$/i);
  if (m) return { kind: "add", index: Number.parseInt(m[1], 10) };

  m = line.match(/^@preview\s+(\d+)\s*$/i);
  if (m) return { kind: "preview", index: Number.parseInt(m[1], 10) };

  m = line.match(/^@gallery(?:\s+(?:size\s+)?(\S+))?\s*$/i);
  if (m) {
    const arg = m[1]?.trim();
    if (!arg || arg.toLowerCase() === "size") {
      return { kind: "gallery" };
    }
    const size = parseGallerySize(arg);
    if (!size) {
      return {
        kind: "unknown",
        raw: `Unknown gallery size: ${arg} (tiny, small, medium, large)`,
      };
    }
    return { kind: "gallery", size };
  }

  m = line.match(new RegExp(`^@cue\\s+merge\\s+${CUE_REF}\\s+${CUE_REF}\\s*$`, "i"));
  if (m) {
    return {
      kind: "merge",
      firstId: normalizeCueId(m[1]),
      secondId: normalizeCueId(m[2]),
    };
  }

  m = line.match(new RegExp(`^@use\\s+${CUE_REF}\\s*$`, "i"));
  if (m) return { kind: "use", cueId: normalizeCueId(m[1]) };

  return { kind: "unknown", raw: line };
}
