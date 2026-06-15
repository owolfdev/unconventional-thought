"use client";

import type { ReactNode } from "react";
import {
  flattenStagedSelections,
  formatVideoTime,
  mediaKindFromUrl,
  resolveSelectionPreviewUrl,
} from "@/lib/selection-media";
import {
  buildCuePreviewModel,
  isAnyOverlaySelection,
} from "@/lib/overlay-media";
import type { ItemAcquisition, SelectedMedia } from "@/lib/types";

interface Props {
  acquisition: ItemAcquisition;
  project: string;
  itemId: string;
  legacyAcquiredFiles?: string[];
  onRemove: (queryIndex: number, selection: SelectedMedia) => void;
  onReorderPlates?: (orderedResultIds: string[]) => void;
}

function moveId(
  ids: string[],
  resultId: string,
  direction: -1 | 1,
): string[] {
  const index = ids.indexOf(resultId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) return ids;
  const next = [...ids];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

function StagedCard({
  selection,
  project,
  itemId,
  queryIndex,
  badge,
  onRemove,
  reorderControls,
}: {
  selection: SelectedMedia;
  project: string;
  itemId: string;
  queryIndex: number;
  badge?: string;
  onRemove: (queryIndex: number, selection: SelectedMedia) => void;
  reorderControls?: ReactNode;
}) {
  const src = resolveSelectionPreviewUrl(selection, project, itemId);
  const kind = mediaKindFromUrl(src);
  const isLibrary = selection.result_id.startsWith("library:");

  return (
    <li className="overflow-hidden rounded-lg border border-zinc-700 bg-black/40">
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
        {badge && (
          <span className="absolute left-1.5 top-1.5 rounded bg-amber-700/90 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
            {badge}
          </span>
        )}
        <span
          className={`absolute right-1.5 top-1.5 rounded px-1 py-0.5 text-[9px] font-medium uppercase ${
            isLibrary
              ? "bg-emerald-950/90 text-emerald-300"
              : "bg-zinc-800/90 text-zinc-400"
          }`}
        >
          {isLibrary ? "library" : "legacy"}
        </span>
      </div>
      <div className="space-y-1.5 p-2">
        <p className="line-clamp-2 text-[11px] font-medium text-zinc-200">
          {selection.title}
        </p>
        {kind === "video" && selection.start_from_sec != null && (
          <p className="font-mono text-[10px] text-amber-400/80">
            in @ {formatVideoTime(selection.start_from_sec)}
          </p>
        )}
        {reorderControls}
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
}

export function CueStagedMedia({
  acquisition,
  project,
  itemId,
  legacyAcquiredFiles = [],
  onRemove,
  onReorderPlates,
}: Props) {
  const model = buildCuePreviewModel(acquisition);
  const plateIds = model.platePlaylist.map((s) => s.result_id);
  const staged = flattenStagedSelections(acquisition);
  const overlays = staged.filter(({ selection }) =>
    isAnyOverlaySelection(selection),
  );
  const plateQueryIndex = new Map<string, number>();
  for (const { selection, queryIndex } of staged) {
    if (!isAnyOverlaySelection(selection)) {
      plateQueryIndex.set(selection.result_id, queryIndex);
    }
  }

  const hasContent = staged.length > 0;

  return (
    <div className="mb-6 rounded-xl border border-zinc-700/90 bg-zinc-950/80 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          Selected for this cue
        </p>
        <p className="text-[10px] text-zinc-600">
          {plateIds.length > 1
            ? "Plate order = preview / render sequence"
            : "Library references · shown in preview above"}
        </p>
      </div>

      {!hasContent ? (
        <p className="mt-3 text-sm text-zinc-500">
          No image selected yet — use{" "}
          <strong className="text-amber-400/90">
            Select cue image from library
          </strong>{" "}
          below, or search &amp; download above.
        </p>
      ) : (
        <>
          {model.platePlaylist.length > 0 && (
            <div className="mt-3">
              {model.platePlaylist.length > 1 && (
                <p className="mb-2 text-[10px] text-zinc-500">
                  Use arrows to reorder plates.
                </p>
              )}
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {model.platePlaylist.map((selection, index) => (
                  <StagedCard
                    key={selection.result_id}
                    selection={selection}
                    project={project}
                    itemId={itemId}
                    queryIndex={plateQueryIndex.get(selection.result_id) ?? 0}
                    badge={model.platePlaylist.length > 1 ? `${index + 1}` : undefined}
                    onRemove={onRemove}
                    reorderControls={
                      model.platePlaylist.length > 1 && onReorderPlates ? (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() =>
                              onReorderPlates(
                                moveId(plateIds, selection.result_id, -1),
                              )
                            }
                            className="rounded border border-zinc-600 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
                            title="Move earlier in sequence"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={index === model.platePlaylist.length - 1}
                            onClick={() =>
                              onReorderPlates(
                                moveId(plateIds, selection.result_id, 1),
                              )
                            }
                            className="rounded border border-zinc-600 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
                            title="Move later in sequence"
                          >
                            ↓
                          </button>
                        </div>
                      ) : undefined
                    }
                  />
                ))}
              </ul>
            </div>
          )}

          {overlays.length > 0 && (
            <div className={model.platePlaylist.length > 0 ? "mt-4" : "mt-3"}>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-violet-400/80">
                Overlays
              </p>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {overlays.map(({ selection, queryIndex }) => (
                  <StagedCard
                    key={selection.result_id}
                    selection={selection}
                    project={project}
                    itemId={itemId}
                    queryIndex={queryIndex}
                    onRemove={onRemove}
                  />
                ))}
              </ul>
            </div>
          )}
        </>
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
