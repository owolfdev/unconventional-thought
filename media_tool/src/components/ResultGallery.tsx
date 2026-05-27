"use client";

import { useCallback, useEffect, useState } from "react";
import type { SearchResult } from "@/lib/types";

interface Props {
  results: SearchResult[];
  selectedIds: Set<string>;
  onToggle: (result: SearchResult) => void;
  engineLabel: string;
  onDownload?: (result: SearchResult) => Promise<void>;
  downloadingId?: string | null;
}

export function ResultGallery({
  results,
  selectedIds,
  onToggle,
  engineLabel,
  onDownload,
  downloadingId = null,
}: Props) {
  const [preview, setPreview] = useState<SearchResult | null>(null);

  const closePreview = useCallback(() => setPreview(null), []);

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePreview();
      const idx = results.findIndex((r) => r.id === preview.id);
      if (e.key === "ArrowRight" && idx < results.length - 1) {
        setPreview(results[idx + 1]);
      }
      if (e.key === "ArrowLeft" && idx > 0) {
        setPreview(results[idx - 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview, results, closePreview]);

  if (results.length === 0) return null;

  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-zinc-300">
          Gallery · {results.length} result{results.length === 1 ? "" : "s"}
        </p>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
          {engineLabel}
        </span>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {results.map((r) => {
          const checked = selectedIds.has(r.id);
          return (
            <li
              key={r.id}
              className={`group overflow-hidden rounded-xl border bg-zinc-950 transition ${
                checked
                  ? "border-amber-500 ring-2 ring-amber-500/40"
                  : "border-zinc-700 hover:border-zinc-500"
              }`}
            >
              <div className="relative aspect-[4/3]">
                {r.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.thumbnail_url}
                    alt={r.title}
                    className="h-full w-full cursor-zoom-in object-cover"
                    loading="lazy"
                    onClick={() => setPreview(r)}
                  />
                ) : (
                  <button
                    type="button"
                    className="flex h-full w-full items-center justify-center text-xs text-zinc-600"
                    onClick={() => setPreview(r)}
                  >
                    No preview
                  </button>
                )}
                <label className="absolute left-2 top-2 flex cursor-pointer items-center gap-1.5 rounded-md bg-black/70 px-2 py-1 text-xs text-white backdrop-blur">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-amber-500"
                    checked={checked}
                    onChange={(e) => {
                      e.stopPropagation();
                      onToggle(r);
                    }}
                  />
                  Select
                </label>
                {checked && (
                  <span className="absolute right-2 top-2 rounded bg-amber-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                    Saved
                  </span>
                )}
              </div>
              <div className="space-y-1 p-2">
                <p className="line-clamp-2 text-xs font-medium leading-snug text-zinc-200">
                  {r.title}
                </p>
                {r.license && (
                  <p className="line-clamp-1 text-[10px] text-zinc-500">
                    {r.license}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-[10px] text-amber-400/90 hover:underline"
                    onClick={() => setPreview(r)}
                  >
                    Preview
                  </button>
                  {onDownload && (
                    <button
                      type="button"
                      disabled={downloadingId === r.id}
                      className="text-[10px] text-emerald-400/90 hover:underline disabled:opacity-50"
                      onClick={() => onDownload(r)}
                    >
                      {downloadingId === r.id ? "Downloading…" : "↓ acquired/"}
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal
          onClick={closePreview}
        >
          <div
            className="relative max-h-[90vh] max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute -top-10 right-0 text-sm text-zinc-400 hover:text-white"
              onClick={closePreview}
            >
              Close (Esc) · ← → to browse
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.url}
              alt={preview.title}
              className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <div>
                <p className="font-medium text-zinc-100">{preview.title}</p>
                {preview.license && (
                  <p className="text-zinc-400">{preview.license}</p>
                )}
              </div>
              <div className="flex gap-2">
                <a
                  href={preview.source_page}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-zinc-600 px-3 py-1.5 hover:bg-zinc-800"
                >
                  Source page ↗
                </a>
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 font-medium ${
                    selectedIds.has(preview.id)
                      ? "bg-zinc-700 text-zinc-300"
                      : "bg-amber-700 hover:bg-amber-600"
                  }`}
                  onClick={() => onToggle(preview)}
                >
                  {selectedIds.has(preview.id)
                    ? "Deselect"
                    : "Select for acquisition"}
                </button>
                {onDownload && (
                  <button
                    type="button"
                    disabled={downloadingId === preview.id}
                    className="rounded-lg bg-emerald-800 px-3 py-1.5 font-medium hover:bg-emerald-700 disabled:opacity-50"
                    onClick={() => onDownload(preview)}
                  >
                    {downloadingId === preview.id
                      ? "Downloading…"
                      : "Download to acquired/"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
