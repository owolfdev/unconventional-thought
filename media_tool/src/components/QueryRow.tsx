"use client";

import { useState } from "react";
import type { QueryAcquisition, SearchResult } from "@/lib/types";
import { SEARCH_ENGINES, getEngine } from "@/lib/search-engines";
import { ResultGallery } from "./ResultGallery";

interface Props {
  queryIndex: number;
  queryAcq: QueryAcquisition;
  manifestPath: string;
  itemId: string;
  onChange: (updated: QueryAcquisition) => void;
  onAcquiredUpdated?: () => void | Promise<void>;
}

export function QueryRow({
  queryIndex,
  queryAcq,
  manifestPath,
  itemId,
  onChange,
  onAcquiredUpdated,
}: Props) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchUrl, setSearchUrl] = useState<string | null>(null);
  const [apiNote, setApiNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [gallerySource, setGallerySource] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadMsg, setDownloadMsg] = useState<string | null>(null);

  const engine = getEngine(queryAcq.engine_id);
  const [manualUrl, setManualUrl] = useState("");
  const [manualTitle, setManualTitle] = useState("");

  const selectedIds = new Set(
    queryAcq.selections.map((s) => {
      if (s.result_id.startsWith("library:")) {
        return `library-${s.result_id.slice("library:".length)}`;
      }
      return s.result_id;
    }),
  );

  const downloadUrl = async (url: string, meta?: SearchResult) => {
    setDownloadMsg(null);
    setDownloadingId(url);
    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manifestPath,
          itemId,
          url,
          title: meta?.title,
          license: meta?.license,
          searchQuery: queryAcq.query,
          sourceEngine: queryAcq.engine_id,
          queryIndex,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Download failed");
      const dedup =
        data.deduplicated === true ? " (already in library)" : "";
      const stagingNote = data.selected === true ? " · selected for cue" : "";
      setDownloadMsg(`Saved ${data.filename} → library${dedup}${stagingNote}`);
      await onAcquiredUpdated?.();
    } catch (e) {
      setDownloadMsg(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloadingId(null);
    }
  };

  const runSearch = async () => {
    setLoading(true);
    setSearchError(null);
    setApiNote(null);
    try {
      const isLibraryEngine = queryAcq.engine_id === "library";

      if (isLibraryEngine) {
        const libRes = await fetch(
          `/api/library/search?q=${encodeURIComponent(queryAcq.query)}&limit=20`,
        );
        const libData = await libRes.json();
        if (!libRes.ok) throw new Error(libData.error ?? "Library search failed");
        const libraryResults: SearchResult[] = libData.results ?? [];
        setResults(libraryResults);
        setSearchUrl(null);
        setGallerySource("Repo library");
        if (libraryResults.length === 0) {
          const total = libData.asset_count ?? 0;
          setApiNote(
            total === 0
              ? "Library is empty. Download from Commons/Openverse to add assets, or run Phase 2 migration for episode 001."
              : `No matches (${total} asset${total === 1 ? "" : "s"} in library). Try different keywords.`,
          );
        }
        setSearched(true);
        return;
      }

      const [libRes, extRes] = await Promise.all([
        fetch(
          `/api/library/search?q=${encodeURIComponent(queryAcq.query)}&limit=20`,
        ),
        fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            engineId: queryAcq.engine_id,
            query: queryAcq.query,
            engineUrl: queryAcq.engine_url,
          }),
        }),
      ]);
      const libData = await libRes.json();
      const data = await extRes.json();
      if (!extRes.ok) throw new Error(data.error ?? "Search failed");

      const libraryResults: SearchResult[] = libData.results ?? [];
      const externalResults: SearchResult[] = data.results ?? [];
      const merged = [...libraryResults, ...externalResults];

      setResults(merged);
      setSearchUrl(data.searchUrl);
      if (libraryResults.length > 0 && externalResults.length > 0) {
        setGallerySource(
          `Library (${libraryResults.length}) · ${data.gallerySource ?? engine.label}`,
        );
      } else if (libraryResults.length > 0) {
        setGallerySource(`Library (${libraryResults.length})`);
      } else {
        setGallerySource(data.gallerySource ?? engine.label);
      }
      const notes: string[] = [];
      if (libraryResults.length > 0) {
        notes.push(`${libraryResults.length} from repo library`);
      } else if ((libData.asset_count ?? 0) === 0) {
        notes.push("Repo library empty — new downloads go to _library/");
      }
      if (data.apiNote) notes.push(data.apiNote);
      setApiNote(notes.length > 0 ? notes.join(" · ") : null);
      setSearched(true);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = async (result: SearchResult) => {
    const isLibrary = result.id.startsWith("library-");
    const resultId = isLibrary
      ? `library:${result.id.slice("library-".length)}`
      : result.id;
    const exists = selectedIds.has(result.id);

    if (isLibrary) {
      setDownloadMsg(null);
      try {
        const res = await fetch("/api/library/stage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            manifestPath,
            itemId,
            libraryId: result.id.slice("library-".length),
            queryIndex,
            searchQuery: queryAcq.query,
            selected: !exists,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Stage failed");
        setDownloadMsg(
          !exists
            ? "Selected for this cue — see preview above."
            : "Removed from cue.",
        );
        await onAcquiredUpdated?.();
      } catch (e) {
        setDownloadMsg(e instanceof Error ? e.message : "Stage failed");
      }
      return;
    }

    const selections = exists
      ? queryAcq.selections.filter((s) => s.result_id !== resultId)
      : [
          ...queryAcq.selections,
          {
            result_id: resultId,
            url: result.url,
            thumbnail_url: result.thumbnail_url,
            title: result.title,
            source_page: result.source_page,
            license: result.license,
            engine_id: queryAcq.engine_id,
            query: queryAcq.query,
            selected_at: new Date().toISOString(),
          },
        ];
    onChange({ ...queryAcq, selections });
  };

  const addManual = () => {
    const url = manualUrl.trim();
    if (!url) return;
    onChange({
      ...queryAcq,
      selections: [
        ...queryAcq.selections,
        {
          result_id: `manual-${Date.now()}`,
          url,
          thumbnail_url: url,
          title: manualTitle.trim() || url,
          source_page: url,
          license: "manual — verify rights",
          engine_id: queryAcq.engine_id,
          query: queryAcq.query,
          selected_at: new Date().toISOString(),
        },
      ],
    });
    setManualUrl("");
    setManualTitle("");
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
      <p className="mb-2 font-mono text-xs text-zinc-500">
        Query {queryIndex + 1}
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm">
          <span className="text-zinc-500">Search text</span>
          <input
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            value={queryAcq.query}
            onChange={(e) => onChange({ ...queryAcq, query: e.target.value })}
          />
        </label>
        <label className="w-full text-sm sm:w-44">
          <span className="text-zinc-500">Engine</span>
          <select
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2"
            value={queryAcq.engine_id}
            onChange={(e) => {
              const eng = SEARCH_ENGINES.find((x) => x.id === e.target.value);
              onChange({
                ...queryAcq,
                engine_id: e.target.value,
                engine_url: eng?.urlTemplate ?? queryAcq.engine_url,
              });
            }}
          >
            {SEARCH_ENGINES.map((eng) => (
              <option key={eng.id} value={eng.id}>
                {eng.label}
                {eng.supportsGallery ? " ✓ gallery" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      {engine.galleryHint && (
        <p className="mt-1 text-xs text-zinc-500">{engine.galleryHint}</p>
      )}

      <label className="mt-2 block text-sm">
        <span className="text-zinc-500">Engine URL template</span>
        <input
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs"
          value={queryAcq.engine_url}
          onChange={(e) =>
            onChange({ ...queryAcq, engine_url: e.target.value })
          }
          placeholder="https://...?q={query}"
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={runSearch}
          disabled={loading}
          className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
        >
          {loading ? "Searching…" : "Search"}
        </button>
        {searchUrl && queryAcq.engine_id !== "library" && (
          <a
            href={searchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm hover:bg-zinc-800"
          >
            Open in browser ↗
          </a>
        )}
      </div>

      {downloadMsg && (
        <p className="mt-2 text-xs text-emerald-400/90">{downloadMsg}</p>
      )}
      {apiNote && (
        <p className="mt-2 text-xs text-amber-200/80">{apiNote}</p>
      )}
      {searchError && (
        <p className="mt-2 text-xs text-red-400">{searchError}</p>
      )}

      {results.length > 0 && (
        <ResultGallery
          results={results}
          selectedIds={selectedIds}
          onToggle={toggleSelection}
          engineLabel={gallerySource ?? engine.label}
          onDownload={(r) => downloadUrl(r.url, r)}
          downloadingId={downloadingId}
        />
      )}

      {searched && results.length === 0 && !loading && (
        <p className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 text-sm text-zinc-500">
          {queryAcq.engine_id === "library"
            ? "No library matches. Download from Commons/Openverse to add assets to _library/, then search again."
            : "No images in gallery. Try Commons or Openverse, or use Open in browser + Add URL."}
        </p>
      )}

      <div className="mt-4 border-t border-zinc-800 pt-4">
        <p className="text-xs font-medium text-zinc-500">Add URL manually</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            className="min-w-[200px] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="https://…"
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
          />
          <input
            className="min-w-[120px] rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="Title (optional)"
            value={manualTitle}
            onChange={(e) => setManualTitle(e.target.value)}
          />
          <button
            type="button"
            onClick={addManual}
            className="rounded-lg border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-800"
          >
            Add
          </button>
          <button
            type="button"
            disabled={!manualUrl.trim() || downloadingId !== null}
            onClick={() => downloadUrl(manualUrl.trim())}
            className="rounded-lg bg-emerald-800 px-3 py-2 text-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            Download to library
          </button>
        </div>
      </div>

      {queryAcq.selections.length > 0 && (
        <div className="mt-4 rounded-lg bg-amber-950/30 p-3">
          <p className="text-xs font-medium text-amber-400">
            Selected ({queryAcq.selections.length})
          </p>
          <ul className="mt-2 space-y-2 text-xs">
            {queryAcq.selections.map((s) => (
              <li
                key={s.result_id}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-amber-300/90 hover:underline"
                >
                  {s.title}
                </a>
                <button
                  type="button"
                  disabled={downloadingId === s.url}
                  onClick={() => downloadUrl(s.url)}
                  className="shrink-0 rounded border border-emerald-800 px-2 py-0.5 text-emerald-400 hover:bg-emerald-950 disabled:opacity-50"
                >
                  {downloadingId === s.url ? "…" : "↓ library"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
