import { formatCueLabel, normalizeCueId } from "@/lib/cue-id";
import { formatHelpIndex, formatUnknownHelpTopic, resolveHelpTopic } from "./help-topics";
import { parseEffectScope } from "./effect-scope";
import { parseGallerySize } from "./gallery-size";
import { parseRenderCommand } from "./render-command-parse";
import type { ParsedDirective } from "./types";

export { normalizeCueId, formatCueLabel };

const CUE_REF = String.raw`(m?\d+)`;

export function helpText(): string {
  return formatHelpIndex();
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

  if (/^@help\s+(\S+)\s*$/i.test(line)) {
    const topicRaw = line.match(/^@help\s+(\S+)\s*$/i)?.[1] ?? "";
    const topic = resolveHelpTopic(topicRaw);
    if (!topic) {
      return { kind: "unknown", raw: formatUnknownHelpTopic(topicRaw) };
    }
    return { kind: "helpTopic", topic };
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

  m = line.match(/^@effect\s+(add|remove)\s+(.+)$/i);
  if (m) {
    const parsed = parseEffectScope(m[2]);
    if ("error" in parsed) {
      return { kind: "unknown", raw: parsed.error };
    }
    return {
      kind: "effect",
      action: m[1].toLowerCase() as "add" | "remove",
      id: parsed.effectRaw,
      scope: parsed.scope,
    };
  }

  m = line.match(/^@mode(?:\s+(\S+))?\s*$/i);
  if (m) {
    const arg = m[1]?.trim();
    return arg ? { kind: "mode", set: arg } : { kind: "mode" };
  }

  m = line.match(/^@generate\s+(sticker|image)\s+(.+)$/i);
  if (m) {
    return {
      kind: "generate",
      variant: m[1].toLowerCase() as "sticker" | "image",
      prompt: m[2].trim(),
    };
  }

  m = line.match(/^@text\s+(add|animate|size|clear)(?:\s+(.+))?\s*$/i);
  if (m) {
    const action = m[1].toLowerCase() as "add" | "animate" | "size" | "clear";
    const value = m[2]?.trim();
    if (action !== "clear" && !value) {
      return {
        kind: "unknown",
        raw: `Usage: @text ${action} <value>`,
      };
    }
    return { kind: "text", action, value };
  }

  m = line.match(/^@(sticker|overlay)\s+(add|clear|place)(?:\s+(.+))?\s*$/i);
  if (m) {
    const action = m[2].toLowerCase() as "add" | "clear" | "place";
    const value = m[3]?.trim();
    if ((action === "add" || action === "place") && !value) {
      return {
        kind: "unknown",
        raw:
          action === "add"
            ? "Usage: @overlay add <gallery-index>"
            : "Usage: @overlay place <position>",
      };
    }
    return { kind: "sticker", action, value };
  }

  m = line.match(/^@render\s+(.+)$/i);
  if (m) {
    const parts = m[1].trim().split(/\s+/).filter(Boolean);
    const parsed = parseRenderCommand(parts);
    if (typeof parsed === "string") {
      return { kind: "unknown", raw: parsed };
    }
    return { kind: "render", command: parsed };
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

  m = line.match(/^@search\s+(library|google|bing|gif|video)\s+(.+)$/i);
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
