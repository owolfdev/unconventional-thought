"use client";

import { useEffect, useRef } from "react";
import {
  galleryResultPreviewKind,
  youtubeEmbedUrl,
} from "@/lib/gallery-preview";
import type { GallerySource } from "@/lib/command/types";
import type { SearchResult } from "@/lib/types";

interface Props {
  result: SearchResult;
  /** 1-based index shown in UI */
  displayIndex: number;
  total: number;
  source: GallerySource;
  onClose: () => void;
  onNavigate: (delta: -1 | 1) => void;
  onAdd?: () => void;
}

export function GalleryPreviewModal({
  result,
  displayIndex,
  total,
  source,
  onClose,
  onNavigate,
  onAdd,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const kind = galleryResultPreviewKind(result, source);
  const embed = kind === "youtube" ? youtubeEmbedUrl(result.url) : null;

  useEffect(() => {
    dialogRef.current?.focus();
  }, [result.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onNavigate(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onNavigate(1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        onAdd?.();
      } else if (e.key === " ") {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNavigate, onAdd]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      role="dialog"
      aria-modal
      aria-label={`Preview ${displayIndex} of ${total}`}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative flex max-h-[92vh] w-full max-w-5xl flex-col outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute -top-9 right-0 font-mono text-xs text-zinc-400 hover:text-white"
          onClick={onClose}
        >
          Close (Esc) · ← → browse · Enter add
        </button>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-zinc-950">
          {kind === "youtube" && embed ? (
            <iframe
              key={embed}
              src={embed}
              title={result.title}
              className="aspect-video h-auto max-h-[72vh] w-full max-w-4xl rounded-lg bg-black"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : kind === "video" ? (
            <video
              key={result.url}
              src={result.url}
              controls
              autoPlay
              playsInline
              className="max-h-[72vh] max-w-full rounded-lg bg-black"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={result.url}
              src={result.url}
              alt={result.title}
              className="max-h-[72vh] w-auto max-w-full rounded-lg object-contain"
            />
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3 font-mono text-xs">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-zinc-100">
              [{displayIndex}] {result.title}
            </p>
            {result.license && (
              <p className="mt-0.5 text-zinc-500">{result.license}</p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {result.source_page && (
              <a
                href={result.source_page}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded border border-zinc-600 px-2.5 py-1 text-zinc-300 hover:bg-zinc-800"
              >
                Source ↗
              </a>
            )}
            {onAdd && (
              <button
                type="button"
                className="rounded bg-amber-700 px-2.5 py-1 text-zinc-950 hover:bg-amber-600"
                onClick={onAdd}
              >
                Add to cue (Enter)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
