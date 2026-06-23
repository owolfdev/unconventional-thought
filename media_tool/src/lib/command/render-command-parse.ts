import { isCueRef } from "@/lib/cue-id";
import type { RenderListFilter } from "@/lib/render-library-shared";
import { parseRenderRange } from "./render-parse";

export type RenderCommand =
  | { action: "start"; from: string; to: string; quality: "preview" | "full" }
  | { action: "startAll"; quality: "preview" | "full" }
  | { action: "list"; filter: RenderListFilter }
  | { action: "load"; ref: string }
  | {
      action: "delete";
      filter: RenderListFilter;
      target: "all" | string;
    };

export function parseRenderCommand(parts: string[]): RenderCommand | string {
  if (parts.length === 0) {
    return "Usage: @render <cue>  |  @render all  |  @render final <cue|from to|all>  |  list  |  load  |  delete";
  }

  const head = parts[0].toLowerCase();

  if (head === "all" && parts.length === 1) {
    return { action: "startAll", quality: "preview" };
  }

  if (head === "final") {
    if (parts.length === 2 && parts[1]?.toLowerCase() === "all") {
      return { action: "startAll", quality: "full" };
    }
    const range = parseRenderRange(parts.slice(1));
    if (typeof range === "string") {
      return "Usage: @render final <cue>  or  @render final <from> <to>  or  @render final all";
    }
    return {
      action: "start",
      from: range.from,
      to: range.to,
      quality: "full",
    };
  }

  if (head === "list") {
    const filter = (parts[1]?.toLowerCase() ?? "all") as RenderListFilter;
    if (filter !== "all" && filter !== "preview" && filter !== "final") {
      return "Usage: @render list [all|preview|final]";
    }
    if (parts.length > 2) {
      return "Usage: @render list [all|preview|final]";
    }
    return { action: "list", filter: parts[1] ? filter : "all" };
  }

  if (head === "load") {
    if (parts.length < 2) {
      return "Usage: @render load <# or title>";
    }
    return { action: "load", ref: parts.slice(1).join(" ") };
  }

  if (head === "delete") {
    return parseRenderDelete(parts.slice(1));
  }

  const range = parseRenderRange(parts);
  if (typeof range === "string") return range;
  return { action: "start", from: range.from, to: range.to, quality: "preview" };
}

function parseRenderDelete(
  parts: string[],
): RenderCommand | string {
  if (parts.length === 0) {
    return "Usage: @render delete <#|title|all>  or  delete preview all";
  }

  if (parts.length === 1) {
    const only = parts[0]!.toLowerCase();
    if (only === "all") {
      return { action: "delete", filter: "all", target: "all" };
    }
    return { action: "delete", filter: "all", target: parts[0]! };
  }

  if (parts.length === 2) {
    const quality = parts[0]!.toLowerCase();
    const target = parts[1]!.toLowerCase();
    if (
      (quality === "preview" || quality === "final") &&
      target === "all"
    ) {
      return {
        action: "delete",
        filter: quality as "preview" | "final",
        target: "all",
      };
    }
  }

  return "Usage: @render delete <#|title|all>  or  delete preview all";
}

/** True when tokens look like a cue render, not a subcommand. */
export function looksLikeCueRender(parts: string[]): boolean {
  if (parts.length === 0) return false;
  const head = parts[0].toLowerCase();
  if (
    head === "list" ||
    head === "load" ||
    head === "delete" ||
    head === "all" ||
    head === "final"
  ) {
    return false;
  }
  return isCueRef(parts[0]) || /^\d+$/.test(parts[0]);
}
