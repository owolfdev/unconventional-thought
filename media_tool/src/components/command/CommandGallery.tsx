"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GALLERY_SIZE_CONFIG,
  type GallerySize,
} from "@/lib/command/gallery-size";
import type { GalleryState } from "@/lib/command/types";

interface Props {
  gallery: GalleryState | null;
  size: GallerySize;
  busy?: boolean;
  className?: string;
  /** 1-based index, same as @add N */
  onAdd?: (index: number) => void | Promise<void>;
}

export function CommandGallery({
  gallery,
  size,
  busy,
  className = "",
  onAdd,
}: Props) {
  const config = GALLERY_SIZE_CONFIG[size];
  const listRef = useRef<HTMLUListElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const resultCount = gallery?.results.length ?? 0;

  useEffect(() => {
    setSelectedIndex(0);
  }, [gallery?.source, gallery?.query, resultCount]);

  useEffect(() => {
    if (resultCount === 0) return;
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selectedIndex, resultCount]);

  const moveSelection = useCallback(
    (delta: number) => {
      if (resultCount === 0) return;
      setSelectedIndex((i) =>
        Math.max(0, Math.min(resultCount - 1, i + delta)),
      );
    },
    [resultCount],
  );

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (busy || resultCount === 0) return;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      moveSelection(1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      moveSelection(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      setSelectedIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setSelectedIndex(resultCount - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      void onAdd?.(selectedIndex + 1);
    }
  };

  const listClass =
    config.layout === "grid"
      ? config.gridClass
      : "flex gap-1.5 overflow-x-auto pb-1 outline-none";

  const hasResults = !busy && gallery && gallery.results.length > 0;

  return (
    <section
      className={`shrink-0 border-t border-zinc-700/80 bg-zinc-900 px-4 py-2 ${config.sectionMaxHeight} ${className}`}
      data-testid="command-gallery"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">
          gallery · {config.label}
          {hasResults ? " · Tab · ← → · Enter" : ""}
        </p>
        {gallery && (
          <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
            {gallery.sourceLabel}
          </span>
        )}
      </div>

      {busy && <p className="font-mono text-xs text-zinc-500">Searching…</p>}

      {!busy && !gallery && (
        <p className="font-mono text-xs text-zinc-400">
          @search library bon scott · @gallery medium
        </p>
      )}

      {!busy && gallery && gallery.results.length === 0 && (
        <p className="font-mono text-xs text-zinc-500">
          No results for &ldquo;{gallery.query}&rdquo;.
        </p>
      )}

      {hasResults && (
        <ul
          ref={listRef}
          role="listbox"
          tabIndex={0}
          aria-label="Search results gallery"
          aria-activedescendant={
            gallery.results[selectedIndex]
              ? `gallery-item-${selectedIndex}`
              : undefined
          }
          className={`${listClass} rounded outline-none focus-visible:ring-1 focus-visible:ring-amber-600/50`}
          onKeyDown={onListKeyDown}
        >
          {gallery.results.map((r, i) => {
            const selected = i === selectedIndex;
            return (
              <li
                key={r.id}
                id={`gallery-item-${i}`}
                role="option"
                aria-selected={selected}
                className={`${config.thumbWidth} shrink-0 overflow-hidden rounded bg-zinc-950 transition-shadow ${
                  selected
                    ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-zinc-900"
                    : "border border-zinc-700"
                }`}
                title={`${i + 1}. ${r.title}`}
              >
                <div className={`relative ${config.thumbHeight} bg-zinc-900`}>
                  {r.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.thumbnail_url}
                      alt={r.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      draggable={false}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[9px] text-zinc-600">
                      —
                    </div>
                  )}
                  <span
                    className={`absolute left-0.5 top-0.5 rounded px-1 py-px font-mono text-[9px] leading-none ${
                      selected
                        ? "bg-amber-500 text-zinc-950"
                        : "bg-black/80 text-amber-200"
                    }`}
                  >
                    {i + 1}
                  </span>
                </div>
                {config.showTitle && (
                  <p className="truncate px-1.5 py-1 font-mono text-[9px] text-zinc-400">
                    {r.title}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
