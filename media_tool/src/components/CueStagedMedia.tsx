"use client";

import {
  flattenStagedSelections,
  formatVideoTime,
  mediaKindFromUrl,
  resolveSelectionPreviewUrl,
} from "@/lib/selection-media";
import type { ItemAcquisition, SelectedMedia } from "@/lib/types";

interface Props {
  acquisition: ItemAcquisition;
  project: string;
  itemId: string;
  legacyAcquiredFiles?: string[];
  onRemove: (queryIndex: number, selection: SelectedMedia) => void;
}

export function CueStagedMedia({
  acquisition,
  project,
  itemId,
  legacyAcquiredFiles = [],
  onRemove,
}: Props) {
  const staged = flattenStagedSelections(acquisition);

  return (
    <div className="mb-6 rounded-xl border border-zinc-700/90 bg-zinc-950/80 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          Selected for this cue
        </p>
        <p className="text-[10px] text-zinc-600">
          Library references · shown in preview above
        </p>
      </div>

      {staged.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">
          No image selected yet — use{" "}
          <strong className="text-amber-400/90">Select cue image from library</strong>{" "}
          below, or search &amp; download above.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {staged.map(({ selection, queryIndex }) => {
            const src = resolveSelectionPreviewUrl(selection, project, itemId);
            const kind = mediaKindFromUrl(src);
            const isLibrary = selection.result_id.startsWith("library:");
            return (
              <li
                key={selection.result_id}
                className="overflow-hidden rounded-lg border border-zinc-700 bg-black/40"
              >
                <div className="relative aspect-[4/3]">
                  {kind === "video" ? (
                    <video
                      src={src}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt={selection.title}
                      className="h-full w-full object-cover"
                    />
                  )}
                  <span
                    className={`absolute left-1.5 top-1.5 rounded px-1 py-0.5 text-[9px] font-medium uppercase ${
                      isLibrary
                        ? "bg-emerald-950/90 text-emerald-300"
                        : "bg-zinc-800/90 text-zinc-400"
                    }`}
                  >
                    {isLibrary ? "library" : "legacy"}
                  </span>
                </div>
                <div className="space-y-1 p-2">
                  <p className="line-clamp-2 text-[11px] font-medium text-zinc-200">
                    {selection.title}
                  </p>
                  {kind === "video" && selection.start_from_sec != null && (
                    <p className="font-mono text-[10px] text-amber-400/80">
                      in @ {formatVideoTime(selection.start_from_sec)}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemove(queryIndex, selection)}
                    className="text-[10px] text-red-400/90 hover:underline"
                  >
                    Remove from cue
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {legacyAcquiredFiles.length > 0 && (
        <p className="mt-3 text-[10px] text-zinc-600">
          Legacy files still in{" "}
          <code className="text-zinc-500">acquired/</code> ({legacyAcquiredFiles.length}) — ep001
          copies; new work uses library refs above.
        </p>
      )}
    </div>
  );
}
