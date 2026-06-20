import { normalizeCueId } from "@/lib/cue-id";

export interface ParsedRenderRange {
  from: string;
  to: string;
}

/** @render 8  or  @render 1 2  → canonical m### ids */
export function parseRenderRange(args: string[]): ParsedRenderRange | string {
  if (args.length === 0) {
    return "Usage: @render <cue>  or  @render <from> <to>";
  }
  if (args.length === 1) {
    const id = normalizeCueId(args[0]);
    return { from: id, to: id };
  }
  if (args.length === 2) {
    return {
      from: normalizeCueId(args[0]),
      to: normalizeCueId(args[1]),
    };
  }
  return "Usage: @render <cue>  or  @render <from> <to>";
}

export function renderRangeLabel(from: string, to: string): string {
  return from === to ? formatCue(from) : `${formatCue(from)}–${formatCue(to)}`;
}

function formatCue(id: string): string {
  const m = id.match(/^m(\d+)$/i);
  return m ? String(Number.parseInt(m[1], 10)) : id;
}
