"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  LibraryAssetMeta,
  LibraryIndexEntry,
  LibraryKind,
  LibrarySearchField,
  LibrarySearchFields,
} from "@/lib/media-library/types";
import {
  DEFAULT_LIBRARY_SEARCH_FIELDS,
  LIBRARY_KINDS,
} from "@/lib/media-library/types";
import { searchFieldsToParam } from "@/lib/media-library/search-fields";
import { canCropLibraryAsset } from "@/lib/media-library/crop-shared";
import { LibraryImageCropper } from "./LibraryImageCropper";
import { OpenInFinderButton } from "./OpenInFinderButton";

const KIND_LABELS: Record<LibraryKind, string> = {
  archive: "Archive",
  overlay: "Overlay",
  effect: "Effect",
  generated: "Generated",
};

const PAGE_SIZE = 48;

const SEARCH_FIELD_LABELS: Record<LibrarySearchField, string> = {
  filename: "Filename",
  original_filename: "Original filename",
  tags: "Tags",
  notes: "Notes",
};

interface AssetsResponse {
  assets: LibraryIndexEntry[];
  total: number;
  asset_count: number;
  offset: number;
  limit: number;
  error?: string;
}

function kindBadgeClass(kind: LibraryKind): string {
  switch (kind) {
    case "archive":
      return "bg-emerald-950 text-emerald-300 border-emerald-800";
    case "overlay":
      return "bg-violet-950 text-violet-300 border-violet-800";
    case "effect":
      return "bg-sky-950 text-sky-300 border-sky-800";
    default:
      return "bg-zinc-800 text-zinc-300 border-zinc-700";
  }
}

export function LibraryBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cueManifestPath = searchParams.get("path")?.trim() ?? "";
  const cueItemId = searchParams.get("itemId")?.trim() ?? "";
  const returnTo = searchParams.get("returnTo")?.trim() ?? "";
  const cueContext = Boolean(cueManifestPath && cueItemId);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<LibraryKind | "all">("all");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [searchFields, setSearchFields] = useState<LibrarySearchFields>({
    ...DEFAULT_LIBRARY_SEARCH_FIELDS,
  });
  const [offset, setOffset] = useState(0);
  const [assets, setAssets] = useState<LibraryIndexEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [assetCount, setAssetCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<LibraryAssetMeta | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailMessage, setDetailMessage] = useState<string | null>(null);
  const [editTags, setEditTags] = useState("");
  const [editFilename, setEditFilename] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editArchived, setEditArchived] = useState(false);
  const [editKind, setEditKind] = useState<LibraryKind>("archive");

  const [importOpen, setImportOpen] = useState(false);
  const [importFiles, setImportFiles] = useState<FileList | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [importTags, setImportTags] = useState("");
  const [importNotes, setImportNotes] = useState("");
  const [importKind, setImportKind] = useState<LibraryKind>("archive");
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [stagingId, setStagingId] = useState<string | null>(null);
  const [stageMessage, setStageMessage] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [imageVersion, setImageVersion] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setOffset(0);
  }, [debouncedQuery, kindFilter, includeArchived, searchFields]);

  const kindsParam = useMemo(() => {
    if (kindFilter === "all") return "";
    return kindFilter;
  }, [kindFilter]);

  const fieldsParam = useMemo(
    () => searchFieldsToParam(searchFields),
    [searchFields],
  );

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
        includeArchived: String(includeArchived),
      });
      if (debouncedQuery) params.set("q", debouncedQuery);
      if (kindsParam) params.set("kinds", kindsParam);
      if (fieldsParam) params.set("fields", fieldsParam);

      const res = await fetch(`/api/library/assets?${params}`);
      const data = (await res.json()) as AssetsResponse;
      if (!res.ok) throw new Error(data.error ?? "Failed to load library");
      setAssets(data.assets);
      setTotal(data.total);
      setAssetCount(data.asset_count);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load library");
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, kindsParam, includeArchived, offset, fieldsParam]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const loadDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setDetailMessage(null);
    try {
      const res = await fetch(`/api/library/asset/${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load asset");
      const meta = data.meta as LibraryAssetMeta;
      setDetail(meta);
      setEditFilename(meta.filename);
      setEditTags(meta.tags.join(", "));
      setEditNotes(meta.manual_notes);
      setEditArchived(meta.archived);
      setEditKind(meta.kind);
    } catch (e) {
      setDetail(null);
      setDetailMessage(e instanceof Error ? e.message : "Failed to load asset");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const saveDetail = async () => {
    if (!selectedId) return;
    setDetailSaving(true);
    setDetailMessage(null);
    try {
      const tags = editTags
        .split(/[,;]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await fetch(
        `/api/library/asset/${encodeURIComponent(selectedId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: editFilename,
            tags,
            manual_notes: editNotes,
            archived: editArchived,
            kind: editKind,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setDetail(data.meta as LibraryAssetMeta);
      setEditFilename((data.meta as LibraryAssetMeta).filename);
      setDetailMessage("Saved");
      await loadAssets();
    } catch (e) {
      setDetailMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setDetailSaving(false);
    }
  };

  const clearImportFiles = useCallback(() => {
    setImportFiles(null);
    setImportMessage(null);
    if (importFileInputRef.current) {
      importFileInputRef.current.value = "";
    }
  }, []);

  const importFileCount = importFiles?.length ?? 0;

  const runImport = async () => {
    if (!importFiles || importFiles.length === 0) {
      setImportMessage("Choose one or more files");
      return;
    }
    setImportBusy(true);
    setImportMessage(null);
    try {
      const formData = new FormData();
      for (const file of Array.from(importFiles)) {
        formData.append("files", file);
      }
      formData.append("tags", importTags);
      formData.append("manual_notes", importNotes);
      formData.append("kind", importKind);

      const res = await fetch("/api/library/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");

      const dedup =
        data.deduplicated > 0 ? ` · ${data.deduplicated} deduplicated` : "";
      setImportMessage(`Imported ${data.imported} file(s)${dedup}`);
      clearImportFiles();
      await loadAssets();
    } catch (e) {
      setImportMessage(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImportBusy(false);
    }
  };

  const selectForCue = useCallback(
    async (libraryId: string) => {
      if (!cueContext) return;
      setStagingId(libraryId);
      setStageMessage(null);
      try {
        const res = await fetch("/api/library/stage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            manifestPath: cueManifestPath,
            itemId: cueItemId,
            libraryId,
            queryIndex: 0,
            selected: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Select failed");
        if (returnTo) {
          router.push(returnTo);
          return;
        }
        setStageMessage(`Selected for cue ${cueItemId}`);
      } catch (e) {
        setStageMessage(e instanceof Error ? e.message : "Select failed");
      } finally {
        setStagingId(null);
      }
    },
    [cueContext, cueManifestPath, cueItemId, returnTo, router],
  );

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const detailImageSrc = detail
    ? `/media/_library/assets/${detail.id}/${encodeURIComponent(detail.filename)}?v=${imageVersion}`
    : "";

  const handleCropApplied = (meta: LibraryAssetMeta) => {
    setDetail(meta);
    setEditFilename(meta.filename);
    setCropOpen(false);
    setImageVersion((v) => v + 1);
    setDetailMessage("Crop saved");
    void loadAssets();
  };

  return (
    <>
      {cropOpen && detail && canCropLibraryAsset(detail) && (
        <LibraryImageCropper
          assetId={detail.id}
          filename={detail.filename}
          src={detailImageSrc}
          onApplied={handleCropApplied}
          onCancel={() => setCropOpen(false)}
        />
      )}

    <div className="mx-auto max-w-6xl px-4 py-8">
      {cueContext && (
        <div className="mb-6 rounded-xl border border-amber-700/50 bg-amber-950/30 p-4">
          <p className="text-sm font-medium text-amber-200">
            Selecting cue image for{" "}
            <span className="font-mono text-amber-100">{cueItemId}</span>
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Click <strong className="font-medium text-amber-300">Select for this cue</strong>{" "}
            on any asset below. You&apos;ll return to the cue preview automatically.
          </p>
          {returnTo && (
            <Link
              href={returnTo}
              className="mt-3 inline-block text-xs text-zinc-400 hover:text-zinc-200"
            >
              ← Back to cue without selecting
            </Link>
          )}
          {stageMessage && (
            <p className="mt-2 text-xs text-emerald-300/90">{stageMessage}</p>
          )}
        </div>
      )}

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Media Library</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Repo-wide archive at{" "}
            <code className="text-amber-400/90">public/media/_library/</code>
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {assetCount} total asset{assetCount === 1 ? "" : "s"}
            {total !== assetCount && debouncedQuery
              ? ` · ${total} match${total === 1 ? "" : "es"}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={returnTo || "/"}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            {cueContext ? "← Back to cue" : "← Media Search"}
          </Link>
          <button
            type="button"
            onClick={() => setImportOpen((v) => !v)}
            className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium hover:bg-emerald-700"
          >
            {importOpen ? "Hide import" : "Bulk import"}
          </button>
        </div>
      </header>

      {importOpen && (
        <section className="mb-8 rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4">
          <h2 className="text-sm font-semibold text-emerald-200">Bulk import</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Upload photos or videos into the library. Same bytes dedupe automatically.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="block text-xs text-zinc-400">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>Files</span>
                {importFileCount > 0 ? (
                  <span className="text-zinc-500">
                    {importFileCount} selected
                  </span>
                ) : null}
              </div>
              <input
                ref={importFileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,.gif,.webp,.mp4,.mov,.webm"
                className="mt-1 block w-full text-sm text-zinc-300 file:mr-3 file:rounded file:border-0 file:bg-zinc-700 file:px-3 file:py-1.5 file:text-sm"
                onChange={(e) => {
                  setImportFiles(e.target.files);
                  setImportMessage(null);
                }}
              />
            </div>
            <label className="block text-xs text-zinc-400">
              Kind
              <select
                value={importKind}
                onChange={(e) => setImportKind(e.target.value as LibraryKind)}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              >
                {LIBRARY_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-zinc-400 sm:col-span-2">
              Tags (comma-separated)
              <input
                value={importTags}
                onChange={(e) => setImportTags(e.target.value)}
                placeholder="bon scott, ac/dc, 1979"
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs text-zinc-400 sm:col-span-2">
              Notes
              <textarea
                value={importNotes}
                onChange={(e) => setImportNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={importBusy}
              onClick={() => void runImport()}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium hover:bg-emerald-600 disabled:opacity-50"
            >
              {importBusy ? "Importing…" : "Import to library"}
            </button>
            <button
              type="button"
              disabled={importBusy || importFileCount === 0}
              onClick={clearImportFiles}
              className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
            >
              Clear files
            </button>
            {importMessage && (
              <p className="text-xs text-emerald-300/90">{importMessage}</p>
            )}
          </div>
        </section>
      )}

      <section className="mb-4 flex flex-wrap gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search library…"
          className="min-w-[240px] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />
        <select
          value={kindFilter}
          onChange={(e) =>
            setKindFilter(e.target.value as LibraryKind | "all")
          }
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        >
          <option value="all">All kinds</option>
          {LIBRARY_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
            className="accent-amber-500"
          />
          Show archived
        </label>
      </section>

      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-400">
        <span className="text-xs uppercase tracking-wide text-zinc-500">
          Search in
        </span>
        {(Object.keys(SEARCH_FIELD_LABELS) as LibrarySearchField[]).map(
          (field) => (
            <label key={field} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="accent-amber-500"
                checked={searchFields[field]}
                onChange={(e) =>
                  setSearchFields((prev) => ({
                    ...prev,
                    [field]: e.target.checked,
                  }))
                }
              />
              {SEARCH_FIELD_LABELS[field]}
            </label>
          ),
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          {loading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : assets.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 text-sm text-zinc-500">
              {assetCount === 0
                ? "Library is empty. Use bulk import or download from a cue in Media Search."
                : "No assets match these filters."}
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {assets.map((asset) => {
                const selected = selectedId === asset.id;
                return (
                  <li key={asset.id}>
                    <div
                      className={`overflow-hidden rounded-xl border bg-zinc-950 transition ${
                        selected
                          ? "border-amber-500 ring-2 ring-amber-500/40"
                          : asset.archived
                            ? "border-zinc-800 opacity-60 hover:opacity-100"
                            : "border-zinc-700 hover:border-zinc-500"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => void loadDetail(asset.id)}
                        className="group w-full text-left"
                      >
                        <div className="relative aspect-[4/3] bg-zinc-900">
                          {asset.media_type === "video" ? (
                            <video
                              src={asset.public_url}
                              className="h-full w-full object-cover"
                              muted
                              playsInline
                              preload="metadata"
                            />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={asset.thumbnail_url}
                              alt={asset.filename}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          )}
                          <span
                            className={`absolute left-2 top-2 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase ${kindBadgeClass(asset.kind)}`}
                          >
                            {asset.kind}
                          </span>
                          {asset.archived && (
                            <span className="absolute right-2 top-2 rounded bg-zinc-800/90 px-1.5 py-0.5 text-[10px] text-zinc-400">
                              archived
                            </span>
                          )}
                        </div>
                        <div className="space-y-1 p-2">
                          <p className="line-clamp-2 text-xs font-medium text-zinc-200">
                            {asset.filename}
                          </p>
                          {asset.tags.length > 0 && (
                            <p className="line-clamp-1 text-[10px] text-zinc-500">
                              {asset.tags.join(" · ")}
                            </p>
                          )}
                        </div>
                      </button>
                      <div className="space-y-2 border-t border-zinc-800 p-2">
                        {cueContext && asset.kind === "archive" && (
                          <button
                            type="button"
                            disabled={stagingId === asset.id}
                            onClick={() => void selectForCue(asset.id)}
                            className="w-full rounded-lg bg-amber-700 px-2 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                          >
                            {stagingId === asset.id
                              ? "Selecting…"
                              : "Select for this cue"}
                          </button>
                        )}
                        <OpenInFinderButton
                          libraryId={asset.id}
                          filename={asset.filename}
                          className="w-full rounded-lg border border-zinc-700 px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {total > PAGE_SIZE && (
            <nav className="mt-6 flex items-center justify-between gap-3 border-t border-zinc-800 pt-4">
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <p className="text-xs text-zinc-500">
                Page {page} of {pageCount}
              </p>
              <button
                type="button"
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Next
              </button>
            </nav>
          )}
        </div>

        <aside className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 lg:sticky lg:top-4 lg:self-start">
          {!selectedId ? (
            <p className="text-sm text-zinc-500">
              {cueContext
                ? "Pick an asset and use Select for this cue, or open details to edit metadata."
                : "Select an asset to view metadata and edit tags."}
            </p>
          ) : detailLoading ? (
            <p className="text-sm text-zinc-500">Loading asset…</p>
          ) : !detail ? (
            <p className="text-sm text-red-400">{detailMessage ?? "Not found"}</p>
          ) : (
            <div className="space-y-4">
              <div>
                {detail.media_type === "video" ? (
                  <video
                    src={`/media/_library/assets/${detail.id}/${encodeURIComponent(detail.filename)}`}
                    controls
                    className="w-full rounded-lg bg-black"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={detailImageSrc}
                    alt={detail.filename}
                    className="w-full rounded-lg bg-black object-contain"
                  />
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <OpenInFinderButton
                  libraryId={detail.id}
                  filename={detail.filename}
                  className="flex-1 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
                />
                {canCropLibraryAsset(detail) && (
                  <button
                    type="button"
                    onClick={() => setCropOpen(true)}
                    className="flex-1 rounded-lg border border-amber-700/60 bg-amber-950/40 px-3 py-2 text-sm font-medium text-amber-200 hover:bg-amber-950"
                  >
                    Crop image…
                  </button>
                )}
              </div>

              <div>
                <p className="font-mono text-[10px] text-zinc-500">{detail.id}</p>
                {detail.original_filename &&
                  detail.original_filename !== detail.filename && (
                    <p className="mt-1 text-[10px] text-zinc-600">
                      Original: {detail.original_filename}
                    </p>
                  )}
              </div>

              <label className="block text-xs text-zinc-400">
                Filename
                <input
                  value={editFilename}
                  onChange={(e) => setEditFilename(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm"
                />
              </label>

              <label className="block text-xs text-zinc-400">
                Kind
                <select
                  value={editKind}
                  onChange={(e) => setEditKind(e.target.value as LibraryKind)}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                >
                  {LIBRARY_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs text-zinc-400">
                Tags
                <input
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                />
              </label>

              <label className="block text-xs text-zinc-400">
                Notes
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={editArchived}
                  onChange={(e) => setEditArchived(e.target.checked)}
                  className="accent-amber-500"
                />
                Archived (hidden from default search)
              </label>

              {detail.source_url && (
                <a
                  href={detail.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-xs text-amber-400/90 hover:underline"
                >
                  Source ↗
                </a>
              )}

              {detail.usages.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-zinc-400">Usages</p>
                  <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-[11px] text-zinc-500">
                    {detail.usages.map((u) => (
                      <li
                        key={`${u.episode_id}:${u.cue_id}:${u.attached_at}`}
                        className="rounded border border-zinc-800 px-2 py-1"
                      >
                        <span className="font-mono text-zinc-400">
                          {u.episode_id}/{u.cue_id}
                        </span>
                        {u.spoken && (
                          <p className="mt-0.5 line-clamp-2 text-zinc-500">
                            {u.spoken}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {cueContext && detail.kind === "archive" && (
                <button
                  type="button"
                  disabled={stagingId === detail.id}
                  onClick={() => void selectForCue(detail.id)}
                  className="w-full rounded-lg bg-amber-700 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {stagingId === detail.id
                    ? "Selecting…"
                    : `Select for cue ${cueItemId}`}
                </button>
              )}

              <button
                type="button"
                disabled={detailSaving}
                onClick={() => void saveDetail()}
                className="w-full rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium hover:bg-zinc-900 disabled:opacity-50"
              >
                {detailSaving ? "Saving…" : "Save metadata"}
              </button>
              {detailMessage && (
                <p className="text-xs text-emerald-300/90">{detailMessage}</p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
    </>
  );
}
