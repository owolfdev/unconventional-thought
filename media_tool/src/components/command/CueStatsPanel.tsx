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
  const people =
    item.people.length > 0
      ? item.people.map((p) => p.name).join(", ")
      : null;

  return (
    <section className="shrink-0 border-b border-zinc-800 px-4 py-4 lg:border-b lg:border-zinc-800">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-mono text-sm text-amber-200/90">
          {formatCueLabel(item.id)}
        </h2>
        <span className="font-mono text-xs text-zinc-500">
          {itemIndex + 1}/{total}
          {dirty ? " · unsaved" : ""}
        </span>
      </div>

      <blockquote className="text-base leading-relaxed text-zinc-100 lg:text-lg">
        &ldquo;{item.spoken}&rdquo;
      </blockquote>

      <dl className="mt-4 grid gap-x-4 gap-y-2 font-mono text-xs text-zinc-500 sm:grid-cols-2">
        <div>
          <dt className="text-zinc-600">time</dt>
          <dd className="text-zinc-400">
            {item.t_start.toFixed(2)}s – {item.t_end.toFixed(2)}s ·{" "}
            {item.duration_sec}s
          </dd>
        </div>
        <div>
          <dt className="text-zinc-600">status</dt>
          <dd className="text-zinc-400">{acq.status}</dd>
        </div>
        <div>
          <dt className="text-zinc-600">visual</dt>
          <dd className="text-zinc-400">
            {VISUAL_MODE_LABELS[normalizeVisualMode(acq.resolved_visual_mode)]}
          </dd>
        </div>
        {people && (
          <div className="sm:col-span-2">
            <dt className="text-zinc-600">people</dt>
            <dd className="text-zinc-400">{people}</dd>
          </div>
        )}
        <div className="sm:col-span-2">
          <dt className="text-zinc-600">editorial</dt>
          <dd className="text-zinc-400 leading-snug">{item.editorial_intent}</dd>
        </div>
      </dl>
    </section>
  );
}
