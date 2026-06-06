"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { flattenStagedSelections } from "@/lib/selection-media";
import { libraryHrefForCue } from "@/lib/library-cue-link";
import type { ItemAcquisition } from "@/lib/types";
import type { LibraryIndexEntry } from "@/lib/media-library";

interface Props {
  manifestPath: string;
  episodeId: string;
  itemId: string;
  acquisition: ItemAcquisition;
  defaultQuery?: string;
  onStaged: () => Promise<void>;
}

export function CueLibraryPicker({
  manifestPath,
  episodeId,
  itemId,
  acquisition,
  defaultQuery = "",
  onStaged,
}: Props) {
  const [forCue, setForCue] = useState<LibraryIndexEntry[]>([]);
  const [recent, setRecent] = useState<LibraryIndexEntry[]>([]);
  const [searchResults, setSearchResults] = useState<
    Array<{
      id: string;
      title: string;
      url: string;
      thumbnail_url: string;
    }>
  >([]);
  const [query, setQuery] = useState(defaultQuery);
  const [loadingForCue, setLoadingForCue] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [searching, setSearching] = useState(false);
  const [stagingId, setStagingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const libraryHref = libraryHrefForCue(manifestPath, itemId);

  const selectedLibraryId = useMemo(() => {
    const staged = flattenStagedSelections(acquisition);
    const plate = staged.find(
      ({ selection }) =>
        selection.result_id.startsWith("library:") &&
        !selection.engine_id.includes("sticker") &&
        !selection.engine_id.includes("giphy") &&
        !selection.engine_id.includes("title"),
    );
    if (!plate) return null;
    return plate.selection.result_id.slice("library:".length);
  }, [acquisition]);

  const loadForCue = useCallback(async () => {
    setLoadingForCue(true);
    try {
      const params = new URLSearchParams({
        episodeId,
        cueId: itemId,
        limit: "12",
      });
      const res = await fetch(`/api/library/for-cue?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Load failed");
      setForCue(data.assets ?? []);
    } catch {
      setForCue([]);
    } finally {
      setLoadingForCue(false);
    }
  }, [episodeId, itemId]);

  const loadRecent = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const res = await fetch("/api/library/assets?limit=12&kinds=archive");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Load failed");
      setRecent(data.assets ?? []);
    } catch {
      setRecent([]);
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  useEffect(() => {
    void loadForCue();
    void loadRecent();
  }, [loadForCue, loadRecent]);

  useEffect(() => {
    setQuery(defaultQuery);
  }, [defaultQuery, itemId]);

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/library/search?q=${encodeURIComponent(q)}&limit=16`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setSearchResults(data.results ?? []);
      if ((data.results ?? []).length === 0) {
        setMessage("No library matches — try different keywords.");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Search failed");
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const selectAsset = async (libraryId: string) => {
    setStagingId(libraryId);
    setMessage(null);
    try {
      const res = await fetch("/api/library/stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manifestPath,
          itemId,
          libraryId,
          queryIndex: 0,
          searchQuery: query.trim() || defaultQuery,
          selected: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Select failed");
      setMessage("Selected — see preview above.");
      await onStaged();
      await loadForCue();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Select failed");
    } finally {
      setStagingId(null);
    }
  };

  const renderCard = (
    asset: {
      title: string;
      thumbnail_url: string;
      url?: string;
      filename?: string;
    },
    libraryId: string,
  ) => {
    const isSelected = selectedLibraryId === libraryId;
    const thumb = asset.thumbnail_url || asset.url || "";
    const title = asset.title || asset.filename || libraryId;
    return (
      <li
        key={libraryId}
        className={`overflow-hidden rounded-lg border bg-black/40 ${
          isSelected
            ? "border-amber-500 ring-2 ring-amber-500/40"
            : "border-zinc-700"
        }`}
      >
        <div className="relative aspect-[4/3]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
            alt={title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          {isSelected && (
            <span className="absolute left-1.5 top-1.5 rounded bg-amber-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
              Selected
            </span>
          )}
        </div>
        <div className="space-y-2 p-2">
          <p className="line-clamp-2 text-[11px] font-medium text-zinc-200">
            {title}
          </p>
          <button
            type="button"
            disabled={stagingId === libraryId || isSelected}
            onClick={() => void selectAsset(libraryId)}
            className={`w-full rounded px-2 py-1.5 text-[11px] font-semibold disabled:opacity-50 ${
              isSelected
                ? "border border-amber-700/50 bg-amber-950/40 text-amber-300"
                : "bg-amber-700 text-white hover:bg-amber-600"
            }`}
          >
            {stagingId === libraryId
              ? "…"
              : isSelected
                ? "Selected ✓"
                : "Select for this cue"}
          </button>
        </div>
      </li>
    );
  };

  const showRecent =
    recent.length > 0 &&
    searchResults.length === 0 &&
    forCue.length === 0 &&
    !loadingForCue;

  return (
    <section className="mb-6 rounded-xl border-2 border-amber-700/50 bg-amber-950/15 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-200">
          Select cue image from library
        </h2>
        <a
          href={libraryHref}
          className="rounded-lg bg-amber-800 px-3 py-1 text-xs font-medium text-amber-50 hover:bg-amber-700"
        >
          Browse full library →
        </a>
      </div>
      <p className="mt-1 text-xs text-zinc-400">
        Click <strong className="text-amber-300">Select for this cue</strong>{" "}
        on any thumbnail. That image becomes the cue preview above.
      </p>

      {forCue.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-zinc-400">
            Downloaded for this cue
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {forCue.map((asset) =>
              renderCard(
                {
                  title: asset.filename,
                  thumbnail_url: asset.thumbnail_url,
                  filename: asset.filename,
                },
                asset.id,
              ),
            )}
          </ul>
        </div>
      )}

      {showRecent && (
        <div className="mt-4">
          <p className="text-xs font-medium text-zinc-400">Recent in library</p>
          <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {recent.map((asset) =>
              renderCard(
                {
                  title: asset.filename,
                  thumbnail_url: asset.thumbnail_url,
                  filename: asset.filename,
                },
                asset.id,
              ),
            )}
          </ul>
        </div>
      )}

      {(loadingForCue || loadingRecent) &&
        forCue.length === 0 &&
        recent.length === 0 && (
          <p className="mt-3 text-xs text-zinc-600">Loading library…</p>
        )}

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          className="min-w-[200px] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          placeholder="Search library by filename or tags…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void runSearch();
          }}
        />
        <button
          type="button"
          disabled={searching || !query.trim()}
          onClick={() => void runSearch()}
          className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </div>

      {searchResults.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {searchResults.map((r) => {
            const libraryId = r.id.startsWith("library-")
              ? r.id.slice("library-".length)
              : r.id;
            return renderCard(r, libraryId);
          })}
        </ul>
      )}

      {message && (
        <p className="mt-3 text-xs text-emerald-400/90">{message}</p>
      )}
    </section>
  );
}
