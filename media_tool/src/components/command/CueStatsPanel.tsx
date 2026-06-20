"use client";

import type { ItemAcquisition, MediaToolItem } from "@/lib/types";
import { formatCueLabel } from "@/lib/cue-id";
import { VISUAL_MODE_LABELS, normalizeVisualMode } from "@/lib/visual-modes";

interface Props {
  item: MediaToolItem;
  acq: ItemAcquisition;
  itemIndex: number;
  total: number;
  dirty: boolean;
}

export function CueStatsPanel({
  item,
  acq,
  itemIndex,
  total,
  dirty,
}: Props) {
  const visual =
    VISUAL_MODE_LABELS[normalizeVisualMode(acq.resolved_visual_mode)];

  return (
    <section className="shrink-0 border-b border-zinc-800 px-3 py-2">
      <div className="flex items-center justify-between gap-2 font-mono text-xs">
        <span className="text-amber-200/90">{formatCueLabel(item.id)}</span>
        <span className="text-zinc-500">
          {itemIndex + 1}/{total}
          {dirty ? " · unsaved" : ""}
        </span>
      </div>

      {item.spoken ? (
        <p className="mt-1 line-clamp-2 text-sm leading-snug text-zinc-300">
          {item.spoken}
        </p>
      ) : null}

      <p className="mt-1 font-mono text-[11px] leading-tight text-zinc-500">
        {item.t_start.toFixed(1)}–{item.t_end.toFixed(1)}s · {visual} ·{" "}
        {acq.status}
      </p>
    </section>
  );
}
