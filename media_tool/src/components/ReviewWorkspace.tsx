"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ItemAcquisition,
  MediaAcquisitionDocument,
  MediaToolItem,
  MediaToolManifest,
  ResolvedMediaType,
  SelectedMedia,
  VisualMode,
} from "@/lib/types";
import {
  normalizeVisualMode,
  VISUAL_MODE_LABELS,
  VISUAL_MODES,
} from "@/lib/visual-modes";
import { CueLibraryPicker } from "./CueLibraryPicker";
import { CueStagedMedia } from "./CueStagedMedia";
import { EffectsPanel } from "./EffectsPanel";
import { QueryRow } from "./QueryRow";
import {
  defaultTextGraphic,
  TextGraphicFields,
} from "./TextGraphicFields";
import { BackgroundColorControl } from "./BackgroundColorControl";
import { SelectedMediaPreview } from "./SelectedMediaPreview";
import { GenerateStickerPanel } from "./GenerateStickerPanel";
import { GiphyStickerPanel } from "./GiphyStickerPanel";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";
import { normalizeBackgroundColor } from "@/lib/background-color";
import { findIncompleteItemIndex } from "@/lib/acquisition";
import { libraryHrefForCue } from "@/lib/library-cue-link";
import {
  cloneSavedItems,
  isItemAcquisitionDirty,
} from "@/lib/acquisition-dirty";
import {
  buildCuesMarkdown,
  cuesMarkdownFilename,
  downloadMarkdownFile,
} from "@/lib/export-cues-markdown";

const DEFAULT_MANIFEST =
  process.env.NEXT_PUBLIC_DEFAULT_MANIFEST_PATH ||
  "episodes/001_WhoWroteBackInBlack/timeline/media_search.json";

export interface MediaLibraryStatus {
  project: string;
  projectDir: string;
  publicBaseUrl: string;
  exists: boolean;
  itemFolders: number;
  totalItems: number;
  withAssetManifest: number;
  withAcquisition: number;
  acquiredFileCount: number;
}

interface LoadState {
  manifest: MediaToolManifest;
  acquisition: MediaAcquisitionDocument;
  manifestPath: string;
  acquisitionPath: string;
  mediaLibrary: MediaLibraryStatus | null;
}

export function ReviewWorkspace() {
  const [manifestPathInput, setManifestPathInput] = useState(DEFAULT_MANIFEST);
  const [loadState, setLoadState] = useState<LoadState | null>(null);
  const [itemIndex, setItemIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [folderBusy, setFolderBusy] = useState(false);
  const [folderMessage, setFolderMessage] = useState<string | null>(null);
  const [acquiredFiles, setAcquiredFiles] = useState<string[]>([]);
  const [ytDlpOk, setYtDlpOk] = useState<boolean | null>(null);
  const [googleCseStatus, setGoogleCseStatus] = useState<
    "not_configured" | "ok" | "blocked" | null
  >(null);
  const [libraryAssetCount, setLibraryAssetCount] = useState<number | null>(
    null,
  );
  const [jumpItemId, setJumpItemId] = useState("");
  /** Last saved acquisition per item (baseline for dirty detection). */
  const [savedItems, setSavedItems] = useState<
    Record<string, ItemAcquisition>
  >({});
  const [pendingNavIndex, setPendingNavIndex] = useState<number | null>(null);
  const [showCueOverlay, setShowCueOverlay] = useState(true);
  const [overlayBusy, setOverlayBusy] = useState(false);
  const didInitialLoad = useRef(false);

  const exportCuesMarkdown = useCallback(() => {
    if (!loadState) return;
    const md = buildCuesMarkdown(
      loadState.manifest,
      loadState.acquisition,
      loadState.manifestPath,
    );
    downloadMarkdownFile(
      md,
      cuesMarkdownFilename(loadState.manifest.episode),
    );
  }, [loadState]);

  const loadManifest = useCallback(async (path: string, targetItemId?: string | null) => {
    setError(null);
    const res = await fetch(`/api/manifest?path=${encodeURIComponent(path)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to load manifest");
    const targetIndex = targetItemId
      ? data.manifest.items.findIndex(
          (item: MediaToolItem) => item.id === targetItemId,
        )
      : -1;
    setLoadState({
      manifest: data.manifest,
      acquisition: data.acquisition,
      manifestPath: data.manifestPath,
      acquisitionPath: data.acquisitionPath,
      mediaLibrary: data.mediaLibrary ?? null,
    });
    setSavedItems(cloneSavedItems(data.acquisition.items));
    setPendingNavIndex(null);
    setItemIndex(targetIndex >= 0 ? targetIndex : 0);
    setShowCueOverlay(data.remotionPreview?.showCueOverlay !== false);
    localStorage.setItem("mediaSearch.manifestPath", path);
  }, []);

  const setRemotionCueOverlay = useCallback(
    async (enabled: boolean) => {
      if (!loadState) return;
      setOverlayBusy(true);
      setShowCueOverlay(enabled);
      try {
        const res = await fetch("/api/remotion-preview", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            manifestPath: loadState.manifestPath,
            showCueOverlay: enabled,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to update overlay");
        setSaveMessage(
          enabled
            ? "Remotion preview: cue labels on (refresh Studio if open)"
            : "Remotion preview: cue labels off (refresh Studio if open)",
        );
      } catch (e) {
        setShowCueOverlay(!enabled);
        setSaveMessage(
          e instanceof Error ? e.message : "Overlay setting failed",
        );
      } finally {
        setOverlayBusy(false);
      }
    },
    [loadState],
  );

  useEffect(() => {
    if (didInitialLoad.current) return;
    didInitialLoad.current = true;

    const params = new URLSearchParams(window.location.search);
    const saved = localStorage.getItem("mediaSearch.manifestPath");
    const path = params.get("path") || saved || DEFAULT_MANIFEST;
    const itemId = params.get("itemId");
    setManifestPathInput(path);
    loadManifest(path, itemId).catch((e) =>
      setError(e instanceof Error ? e.message : "Load failed"),
    );

    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        setGoogleCseStatus(
          data.googleCseStatus === "ok" ||
            data.googleCseStatus === "blocked" ||
            data.googleCseStatus === "not_configured"
            ? data.googleCseStatus
            : data.googleCseConfigured === true
              ? "ok"
              : "not_configured",
        );
        setYtDlpOk(data.ytDlpAvailable === true);
        setLibraryAssetCount(
          typeof data.libraryAssetCount === "number"
            ? data.libraryAssetCount
            : 0,
        );
      })
      .catch(() => {
        setGoogleCseStatus(null);
      });
  }, [loadManifest]);

  const items = loadState?.manifest.items ?? [];
  const currentItem: MediaToolItem | undefined = items[itemIndex];
  const currentItemId = currentItem?.id;
  const manifestPathLoaded = loadState?.manifestPath;
  const currentAcq: ItemAcquisition | undefined = currentItem
    ? loadState?.acquisition.items[currentItem.id]
    : undefined;

  const refreshAcquired = useCallback(async () => {
    if (!manifestPathLoaded || !currentItemId) return;
    const res = await fetch(
      `/api/download?path=${encodeURIComponent(manifestPathLoaded)}&itemId=${currentItemId}`,
    );
    const data = await res.json();
    if (res.ok) {
      setAcquiredFiles(data.files ?? []);
      setYtDlpOk(data.ytDlpAvailable ?? false);
    }
  }, [manifestPathLoaded, currentItemId]);

  /** Reload per-cue acquisition.json after server-side import (GIPHY, generate-sticker). */
  const reloadItemAcquisition = useCallback(async () => {
    if (!manifestPathLoaded || !currentItemId) return;
    const res = await fetch(
      `/api/manifest?path=${encodeURIComponent(manifestPathLoaded)}`,
    );
    const data = await res.json();
    if (!res.ok) return;
    const itemAcq = data.acquisition?.items?.[currentItemId] as
      | ItemAcquisition
      | undefined;
    if (!itemAcq) return;
    setLoadState((s) =>
      s
        ? {
            ...s,
            acquisition: {
              ...s.acquisition,
              items: {
                ...s.acquisition.items,
                [currentItemId]: itemAcq,
              },
            },
          }
        : s,
    );
  }, [manifestPathLoaded, currentItemId]);

  const refreshAfterAcquiredChange = useCallback(async () => {
    await refreshAcquired();
    await reloadItemAcquisition();
  }, [refreshAcquired, reloadItemAcquisition]);

  useEffect(() => {
    if (!manifestPathLoaded || !currentItemId) return;
    void refreshAcquired();
  }, [refreshAcquired, manifestPathLoaded, currentItemId]);

  useEffect(() => {
    if (!manifestPathLoaded || !currentItemId) return;
    const params = new URLSearchParams();
    params.set("path", manifestPathLoaded);
    params.set("itemId", currentItemId);
    const desired = `?${params.toString()}`;
    if (window.location.search === desired) return;
    window.history.replaceState(null, "", `/${desired}`);
  }, [manifestPathLoaded, currentItemId]);

  const updateCurrentAcq = useCallback(
    (patch: Partial<ItemAcquisition>) => {
      if (!loadState || !currentItem) return;
      const prev = loadState.acquisition.items[currentItem.id];
      const updated: ItemAcquisition = {
        ...prev,
        ...patch,
        updated_at: new Date().toISOString(),
      };
      setLoadState({
        ...loadState,
        acquisition: {
          ...loadState.acquisition,
          items: {
            ...loadState.acquisition.items,
            [currentItem.id]: updated,
          },
        },
      });
    },
    [loadState, currentItem],
  );

  const removeStagedSelection = useCallback(
    (queryIndex: number, selection: SelectedMedia) => {
      if (!currentAcq) return;
      const queries = currentAcq.queries.map((q, i) =>
        i === queryIndex
          ? {
              ...q,
              selections: q.selections.filter(
                (s) => s.result_id !== selection.result_id,
              ),
            }
          : q,
      );
      updateCurrentAcq({ queries });
    },
    [currentAcq, updateCurrentAcq],
  );

  const isCurrentDirty =
    currentItem && currentAcq
      ? isItemAcquisitionDirty(currentAcq, savedItems[currentItem.id])
      : false;

  const saveAcquisition = useCallback(async (): Promise<boolean> => {
    if (!loadState) return false;
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/acquisition", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manifestPath: loadState.manifestPath,
          acquisition: loadState.acquisition,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setLoadState((s) =>
        s ? { ...s, acquisition: data.acquisition } : s,
      );
      setSavedItems(cloneSavedItems(data.acquisition.items));
      setSaveMessage(`Saved → ${data.path}`);
      await refreshAcquired();
      return true;
    } catch (e) {
      setSaveMessage(e instanceof Error ? e.message : "Save failed");
      return false;
    } finally {
      setSaving(false);
    }
  }, [loadState, refreshAcquired]);

  const navigateToIndex = useCallback((index: number) => {
    setPendingNavIndex(null);
    setItemIndex(index);
    setSaveMessage(null);
  }, []);

  const requestNavigateToIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= items.length || index === itemIndex) return;
      if (isCurrentDirty) {
        setPendingNavIndex(index);
        return;
      }
      navigateToIndex(index);
    },
    [items.length, itemIndex, isCurrentDirty, navigateToIndex],
  );

  const goNext = useCallback(
    (opts?: { incompleteOnly?: boolean }) => {
      if (opts?.incompleteOnly && loadState) {
        const idx = findIncompleteItemIndex(
          items,
          loadState.acquisition.items,
          itemIndex,
          1,
        );
        if (idx === null) {
          setSaveMessage("No more incomplete items ahead.");
          return;
        }
        requestNavigateToIndex(idx);
        return;
      }
      requestNavigateToIndex(Math.min(itemIndex + 1, items.length - 1));
    },
    [items, itemIndex, loadState, requestNavigateToIndex],
  );

  const goPrev = useCallback(
    (opts?: { incompleteOnly?: boolean }) => {
      if (opts?.incompleteOnly && loadState) {
        const idx = findIncompleteItemIndex(
          items,
          loadState.acquisition.items,
          itemIndex,
          -1,
        );
        if (idx === null) {
          setSaveMessage("No more incomplete items before this cue.");
          return;
        }
        requestNavigateToIndex(idx);
        return;
      }
      requestNavigateToIndex(Math.max(itemIndex - 1, 0));
    },
    [items, itemIndex, loadState, requestNavigateToIndex],
  );

  const goToItemId = (id: string) => {
    const normalized = id.trim();
    if (!normalized) return;
    const nextIndex = items.findIndex(
      (item) => item.id.toLowerCase() === normalized.toLowerCase(),
    );
    if (nextIndex < 0) {
      setSaveMessage(`Item not found: ${normalized}`);
      return;
    }
    requestNavigateToIndex(nextIndex);
    setJumpItemId("");
  };

  const discardCurrentAndNavigate = useCallback(() => {
    if (!loadState || !currentItem || pendingNavIndex === null) return;
    const saved = savedItems[currentItem.id];
    if (saved) {
      setLoadState({
        ...loadState,
        acquisition: {
          ...loadState.acquisition,
          items: {
            ...loadState.acquisition.items,
            [currentItem.id]: JSON.parse(
              JSON.stringify(saved),
            ) as ItemAcquisition,
          },
        },
      });
    }
    navigateToIndex(pendingNavIndex);
  }, [loadState, currentItem, pendingNavIndex, savedItems, navigateToIndex]);

  const saveAndNavigate = useCallback(async () => {
    if (pendingNavIndex === null) return;
    const ok = await saveAcquisition();
    if (ok) navigateToIndex(pendingNavIndex);
  }, [pendingNavIndex, saveAcquisition, navigateToIndex]);

  const completeAndNext = useCallback(async () => {
    if (!loadState || !currentItem || !currentAcq) return;
    const completed: ItemAcquisition = {
      ...currentAcq,
      status: "complete",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const acquisition: MediaAcquisitionDocument = {
      ...loadState.acquisition,
      items: {
        ...loadState.acquisition.items,
        [currentItem.id]: completed,
      },
    };
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/acquisition", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manifestPath: loadState.manifestPath,
          acquisition,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setLoadState((s) =>
        s ? { ...s, acquisition: data.acquisition } : s,
      );
      setSavedItems(cloneSavedItems(data.acquisition.items));
      setSaveMessage(`Saved → ${data.path}`);
      await refreshAcquired();
      const next = Math.min(itemIndex + 1, items.length - 1);
      navigateToIndex(next);
    } catch (e) {
      setSaveMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [
    loadState,
    currentItem,
    currentAcq,
    itemIndex,
    items.length,
    refreshAcquired,
    navigateToIndex,
  ]);

  useEffect(() => {
    if (!isCurrentDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isCurrentDirty]);

  const createMediaFolders = useCallback(
    async (refreshManifests = false) => {
      if (!loadState) return;
      setFolderBusy(true);
      setFolderMessage(null);
      try {
        const res = await fetch("/api/media-folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            manifestPath: loadState.manifestPath,
            refreshManifests,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Folder creation failed");
        setLoadState((s) =>
          s ? { ...s, mediaLibrary: data.status ?? s.mediaLibrary } : s,
        );
        setFolderMessage(
          `Folders ready: ${data.result.created} new, ${data.result.updated} manifests refreshed · public${data.status.publicBaseUrl}`,
        );
      } catch (e) {
        setFolderMessage(
          e instanceof Error ? e.message : "Folder creation failed",
        );
      } finally {
        setFolderBusy(false);
      }
    },
    [loadState],
  );

  const isTextGraphic =
    currentAcq?.resolved_visual_mode === "text_graphic";
  const isEffectOnly =
    currentAcq?.resolved_visual_mode === "effect_only";
  const needsMediaTool = !isTextGraphic && !isEffectOnly;
  const hasTextLayer = Boolean(currentAcq?.text_graphic_layer);
  const showMediaPreview =
    Boolean(loadState?.mediaLibrary?.project) &&
    Boolean(currentItem) &&
    Boolean(currentAcq) &&
    !isTextGraphic;

  const libraryHref =
    loadState && currentItem
      ? libraryHrefForCue(loadState.manifestPath, currentItem.id)
      : "/library";

  if (!loadState && !error) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-zinc-500">
        Loading manifest…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Setup bar */}
      <header className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-lg font-semibold tracking-tight">Media Search</h1>
              <Link
                href={libraryHref}
                className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-900"
              >
                Library ({libraryAssetCount ?? "…"})
              </Link>
            </div>
            <p className="mt-1 text-sm text-zinc-400">
          Per-cue folders under{" "}
          <code className="text-amber-400/90">public/media/&lt;project&gt;/m001/</code>{" "}
          with <code className="text-amber-400/90">asset_manifest.json</code> +{" "}
          <code className="text-amber-400/90">acquired/</code>
            </p>
          </div>
          {loadState && (
            <button
              type="button"
              disabled={overlayBusy}
              onClick={() => void setRemotionCueOverlay(!showCueOverlay)}
              title="Burn in cue number + media id (m###) on Remotion preview renders"
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition disabled:opacity-50 ${
                showCueOverlay
                  ? "border-amber-600/80 bg-amber-950/80 text-amber-200 hover:bg-amber-900/60"
                  : "border-zinc-600 bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              {overlayBusy
                ? "Updating…"
                : showCueOverlay
                  ? "Remotion cue labels: ON"
                  : "Remotion cue labels: OFF"}
            </button>
          )}
        </div>
        <form
          className="mt-4 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            loadManifest(manifestPathInput).catch((err) =>
              setError(err instanceof Error ? err.message : "Load failed"),
            );
          }}
        >
          <input
            className="min-w-[280px] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            value={manifestPathInput}
            onChange={(e) => setManifestPathInput(e.target.value)}
            placeholder="episodes/001_WhoWroteBackInBlack/timeline/media_search.json"
          />
          <button
            type="submit"
            className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-600"
          >
            Load
          </button>
        </form>
        {loadState && (
          <p className="mt-2 text-xs text-zinc-500">
            {loadState.manifest.episode} · {items.length} items ·{" "}
            {loadState.acquisition.completed_count} marked complete ·{" "}
            <button
              type="button"
              onClick={exportCuesMarkdown}
              className="text-amber-400/90 hover:underline"
            >
              Export cues (.md)
            </button>
          </p>
        )}

        {loadState && (
          <div className="mt-4 rounded-lg border border-zinc-700/80 bg-zinc-950/80 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={folderBusy}
                onClick={() => createMediaFolders(false)}
                className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {folderBusy ? "Creating…" : "Create media folders"}
              </button>
              <button
                type="button"
                disabled={folderBusy}
                onClick={() => createMediaFolders(true)}
                className="rounded-lg border border-zinc-600 px-3 py-2 text-xs hover:bg-zinc-800"
              >
                Refresh asset manifests
              </button>
            </div>
            {loadState.mediaLibrary && (
              <p className="mt-2 text-xs text-zinc-500">
                <code className="text-zinc-400">
                  public/media/{loadState.mediaLibrary.project}/
                </code>
                {" · "}
                {loadState.mediaLibrary.itemFolders}/
                {loadState.mediaLibrary.totalItems} folders ·{" "}
                {loadState.mediaLibrary.acquiredFileCount} files in acquired/{" "}
                (legacy)
              </p>
            )}
            {libraryAssetCount !== null && (
              <p className="mt-1 text-xs text-zinc-500">
                <code className="text-zinc-400">public/media/_library/</code>
                {" · "}
                {libraryAssetCount} archive asset
                {libraryAssetCount === 1 ? "" : "s"}
                {libraryAssetCount === 0
                  ? " — empty until you download or run Phase 2 migration"
                  : ""}
              </p>
            )}
            {folderMessage && (
              <p className="mt-2 text-xs text-emerald-400/90">{folderMessage}</p>
            )}
            {googleCseStatus === "not_configured" && (
              <p className="mt-2 text-xs text-amber-200/80">
                Google Images gallery: add{" "}
                <code className="text-zinc-300">GOOGLE_API_KEY</code> and{" "}
                <code className="text-zinc-300">GOOGLE_CSE_ID</code> to{" "}
                <code className="text-zinc-300">media_tool/.env.local</code>{" "}
                — or use Commons / Openverse / Repo library. Restart dev server.
              </p>
            )}
            {googleCseStatus === "blocked" && (
              <p className="mt-2 text-xs text-amber-200/80">
                Google Images API blocked for this GCP project (403 — JSON API
                closed to new customers). Search still opens Google in browser;
                in-app gallery falls back to Openverse. Use{" "}
                <strong className="font-normal text-amber-100/90">
                  Repo library
                </strong>
                , Commons, or paste URLs manually.
              </p>
            )}
            {googleCseStatus === "ok" && (
              <p className="mt-1 text-xs text-zinc-600">
                Google Custom Search ready · gallery returns direct image URLs
              </p>
            )}
            {ytDlpOk === false && (
              <p className="mt-2 text-xs text-amber-200/80">
                YouTube: install{" "}
                <code className="text-zinc-300">brew install yt-dlp</code> then
                restart the dev server.
              </p>
            )}
            {ytDlpOk === true && (
              <p className="mt-1 text-xs text-zinc-600">
                yt-dlp ready · images use direct download
              </p>
            )}
          </div>
        )}

        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </header>

      {currentItem && currentAcq && loadState && (
        <>
          {/* Item header */}
          <section className="mb-6 rounded-xl border border-amber-900/40 bg-gradient-to-b from-amber-950/30 to-zinc-950 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-2xl font-bold text-amber-400">
                  {currentItem.id}
                </p>
                <p className="mt-0.5 text-sm text-zinc-500">
                  Cue {currentItem.cue} · {currentItem.t_start.toFixed(2)}s –{" "}
                  {currentItem.t_end.toFixed(2)}s · {currentItem.duration_sec}s
                </p>
                {loadState?.mediaLibrary?.exists && (
                  <p className="mt-2 font-mono text-xs text-zinc-500">
                    <a
                      href={`${loadState.mediaLibrary.publicBaseUrl}/${currentItem.id}/`}
                      className="text-emerald-400/90 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      public/media/{loadState.mediaLibrary.project}/
                      {currentItem.id}/
                    </a>
                    {" · asset_manifest.json · acquisition.json"}
                  </p>
                )}
              </div>
              <p className="text-sm text-zinc-500">
                {itemIndex + 1} / {items.length}
              </p>
            </div>

            {showMediaPreview && loadState.mediaLibrary && (
              <>
                <SelectedMediaPreview
                  acquisition={currentAcq}
                  project={loadState.mediaLibrary.project}
                  itemId={currentItem.id}
                  acquiredFiles={acquiredFiles}
                  durationSec={currentItem.duration_sec}
                  tStart={currentItem.t_start}
                  tEnd={currentItem.t_end}
                  onStickerOverlayEnabledChange={(enabled) =>
                    updateCurrentAcq({ sticker_overlay_enabled: enabled })
                  }
                  onStickerOverlaySizeChange={(size) =>
                    updateCurrentAcq({ sticker_overlay_size: size })
                  }
                  onTitleOverlayEnabledChange={(enabled) =>
                    updateCurrentAcq({ title_overlay_enabled: enabled })
                  }
                />
                {needsMediaTool && (
                  <CueLibraryPicker
                    manifestPath={loadState.manifestPath}
                    episodeId={loadState.acquisition.episode}
                    itemId={currentItem.id}
                    acquisition={currentAcq}
                    defaultQuery={
                      currentAcq.queries[0]?.query ??
                      currentItem.search_queries[0] ??
                      ""
                    }
                    onStaged={refreshAfterAcquiredChange}
                  />
                )}
                <CueStagedMedia
                  acquisition={currentAcq}
                  project={loadState.mediaLibrary.project}
                  itemId={currentItem.id}
                  legacyAcquiredFiles={acquiredFiles}
                  onRemove={removeStagedSelection}
                />
              </>
            )}

            <blockquote className="mt-4 text-xl leading-relaxed text-zinc-100">
              &ldquo;{currentItem.spoken}&rdquo;
            </blockquote>

            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <Meta label="Editorial" value={currentItem.editorial_intent} />
              <Meta label="Situation" value={currentItem.situation} />
              <Meta
                label="Dates"
                value={`${currentItem.date_from || "—"} → ${currentItem.date_to || "—"}`}
              />
              <Meta
                label="People"
                value={
                  currentItem.people.length
                    ? currentItem.people.map((p) => p.name).join(", ")
                    : "—"
                }
              />
              {currentItem.avoid.length > 0 && (
                <Meta label="Avoid" value={currentItem.avoid.join(" · ")} />
              )}
              {currentItem.artifact && (
                <Meta
                  label="Artifact"
                  value={`${currentItem.artifact.object} — ${currentItem.artifact.story_link}`}
                />
              )}
            </dl>
          </section>

          {/* Overrides */}
          <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Acquisition settings
            </h2>
            <div className="mt-3 flex flex-wrap gap-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-500">Visual mode</span>
                <select
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5"
                  value={normalizeVisualMode(currentAcq.resolved_visual_mode)}
                  onChange={(e) => {
                    const mode = e.target.value as VisualMode;
                    updateCurrentAcq({
                      resolved_visual_mode: mode,
                      text_graphic_layer:
                        mode === "text_graphic" || mode === "effect_only"
                          ? null
                          : currentAcq.text_graphic_layer,
                      status:
                        mode === "text_graphic"
                          ? "text_graphic"
                          : mode === "effect_only"
                            ? "in_progress"
                            : currentAcq.status === "text_graphic"
                              ? "in_progress"
                              : currentAcq.status,
                      resolved_media_type:
                        mode === "text_graphic" || mode === "effect_only"
                          ? "generated"
                          : currentAcq.resolved_media_type,
                    });
                  }}
                >
                  {VISUAL_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {VISUAL_MODE_LABELS[mode]}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-zinc-600">
                  Pair with media type (e.g. historical + video, stock + photo)
                </span>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-500">Media type</span>
                <select
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5"
                  value={currentAcq.resolved_media_type}
                  onChange={(e) =>
                    updateCurrentAcq({
                      resolved_media_type: e.target
                        .value as ResolvedMediaType,
                    })
                  }
                >
                  <option value="photo">photo</option>
                  <option value="video">video</option>
                  <option value="generated">generated (text graphic)</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-500">Status</span>
                <select
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5"
                  value={currentAcq.status}
                  onChange={(e) =>
                    updateCurrentAcq({
                      status: e.target.value as ItemAcquisition["status"],
                    })
                  }
                >
                  <option value="pending">pending</option>
                  <option value="in_progress">in_progress</option>
                  <option value="complete">complete</option>
                  <option value="skipped">skipped</option>
                  <option value="text_graphic">text_graphic</option>
                </select>
              </label>
              <BackgroundColorControl
                value={normalizeBackgroundColor(currentAcq.background_color)}
                onChange={(background_color) =>
                  updateCurrentAcq({
                    background_color: normalizeBackgroundColor(background_color),
                  })
                }
              />
            </div>

            {isTextGraphic && (
              <div className="mt-4 space-y-3 rounded-lg border border-violet-900/50 bg-violet-950/20 p-3 text-sm">
                <p className="text-violet-200">
                  Text graphic — no archive search required.
                </p>
                <TextGraphicFields
                  value={
                    currentAcq.text_graphic ??
                    defaultTextGraphic(currentItem.spoken)
                  }
                  defaultText={currentItem.spoken}
                  onChange={(text_graphic) => updateCurrentAcq({ text_graphic })}
                />
              </div>
            )}

            {needsMediaTool && (
              <div className="mt-4 space-y-3 rounded-lg border border-violet-900/40 bg-violet-950/15 p-3 text-sm">
                <label className="flex cursor-pointer items-center gap-2 text-violet-200">
                  <input
                    type="checkbox"
                    className="rounded border-violet-700"
                    checked={hasTextLayer}
                    onChange={(e) =>
                      updateCurrentAcq({
                        text_graphic_layer: e.target.checked
                          ? defaultTextGraphic(currentItem.spoken)
                          : null,
                      })
                    }
                  />
                  Text graphic layer (overlay on photo/video)
                </label>
                {hasTextLayer && currentAcq.text_graphic_layer && (
                  <TextGraphicFields
                    compact
                    value={currentAcq.text_graphic_layer}
                    defaultText={currentItem.spoken}
                    onChange={(text_graphic_layer) =>
                      updateCurrentAcq({ text_graphic_layer })
                    }
                  />
                )}
              </div>
            )}


            <label className="mt-4 block text-sm">
              <span className="text-zinc-500">Notes</span>
              <textarea
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                rows={2}
                value={currentAcq.notes}
                onChange={(e) => updateCurrentAcq({ notes: e.target.value })}
                placeholder={
                  isEffectOnly
                    ? "e.g. black plate only, heavy scratches, no picture…"
                    : "License concerns, edit direction, alternate ideas…"
                }
              />
            </label>

            <EffectsPanel
              effectOnly={isEffectOnly}
              effects={currentAcq.effects ?? []}
              transition={currentAcq.transition ?? null}
              onEffectsChange={(effects) => updateCurrentAcq({ effects })}
              onTransitionChange={(transition) => updateCurrentAcq({ transition })}
            />
          </section>

          {/* Queries */}
          {needsMediaTool && (
            <section className="space-y-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                Search queries
              </h2>
              {currentAcq.queries.map((q, qi) => (
                <QueryRow
                  key={`${currentItem.id}-q${qi}`}
                  queryIndex={qi}
                  queryAcq={q}
                  manifestPath={loadState.manifestPath}
                  itemId={currentItem.id}
                  onAcquiredUpdated={() => void refreshAfterAcquiredChange()}
                  onChange={(updated) => {
                    const queries = [...currentAcq.queries];
                    queries[qi] = updated;
                    updateCurrentAcq({ queries, status: "in_progress" });
                  }}
                />
              ))}
            </section>
          )}

          <ItemDownloadSection
            manifestPath={loadState.manifestPath}
            itemId={currentItem.id}
            spokenHint={currentItem.spoken}
            mediaLibrary={loadState.mediaLibrary}
            acquiredFiles={acquiredFiles}
            acquisition={currentAcq}
            onStickerOverlayEnabledChange={(enabled) =>
              updateCurrentAcq({ sticker_overlay_enabled: enabled })
            }
            onStickerOverlaySizeChange={(size) =>
              updateCurrentAcq({ sticker_overlay_size: size })
            }
            onAcquiredUpdated={refreshAfterAcquiredChange}
          />

          {/* Nav */}
          <footer className="sticky bottom-0 mt-10 flex flex-wrap items-center gap-3 border-t border-zinc-800 bg-zinc-950/95 py-4 backdrop-blur">
            <button
              type="button"
              disabled={itemIndex === 0}
              onClick={(e) => goPrev({ incompleteOnly: e.shiftKey })}
              title="Previous cue. Shift+click: previous incomplete cue."
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm disabled:opacity-40"
            >
              ← Previous
            </button>
            <button
              type="button"
              onClick={() => void saveAcquisition()}
              disabled={saving}
              className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${
                isCurrentDirty
                  ? "bg-amber-800 ring-1 ring-amber-600 hover:bg-amber-700"
                  : "bg-zinc-700 hover:bg-zinc-600"
              }`}
            >
              {saving ? "Saving…" : "Save settings"}
              {isCurrentDirty && !saving ? " *" : ""}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void completeAndNext()}
              className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
            >
              Complete &amp; next →
            </button>
            <button
              type="button"
              disabled={itemIndex >= items.length - 1}
              onClick={(e) => goNext({ incompleteOnly: e.shiftKey })}
              title="Next cue. Shift+click: next incomplete cue."
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm"
            >
              Next →
            </button>
            {loadState.mediaLibrary && (
              <a
                href={libraryHref}
                className="rounded-lg border border-emerald-800 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-950"
              >
                Select from library
              </a>
            )}
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                goToItemId(jumpItemId);
              }}
            >
              <input
                className="w-24 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm"
                value={jumpItemId}
                onChange={(e) => setJumpItemId(e.target.value)}
                placeholder={currentItem.id}
                aria-label="Go to item id"
              />
              <button
                type="submit"
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900"
              >
                Go
              </button>
            </form>
            {isCurrentDirty && (
              <span className="text-xs text-amber-400/90">Unsaved changes</span>
            )}
            {saveMessage && (
              <span className="text-xs text-zinc-500">{saveMessage}</span>
            )}
          </footer>

          {pendingNavIndex !== null && currentItem && (
            <UnsavedChangesDialog
              itemId={currentItem.id}
              saving={saving}
              onCancel={() => setPendingNavIndex(null)}
              onDiscardAndContinue={discardCurrentAndNavigate}
              onSaveAndContinue={() => void saveAndNavigate()}
            />
          )}
        </>
      )}
    </div>
  );
}

function ItemDownloadSection({
  manifestPath,
  itemId,
  spokenHint,
  mediaLibrary,
  acquiredFiles,
  acquisition,
  onStickerOverlayEnabledChange,
  onStickerOverlaySizeChange,
  onAcquiredUpdated,
}: {
  manifestPath: string;
  itemId: string;
  spokenHint?: string;
  mediaLibrary: MediaLibraryStatus | null;
  acquiredFiles: string[];
  acquisition?: ItemAcquisition;
  onStickerOverlayEnabledChange?: (enabled: boolean) => void;
  onStickerOverlaySizeChange?: (size: import("@/lib/sticker-overlay-size").StickerOverlaySize) => void;
  onAcquiredUpdated: () => Promise<void>;
}) {
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<"image" | "video" | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = downloading !== null || uploading;

  const download = async (kind: "image" | "video") => {
    const trimmed = (kind === "image" ? imageUrl : videoUrl).trim();
    if (!trimmed) return;

    setDownloading(kind);
    setMessage(null);
    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manifestPath,
          itemId,
          url: trimmed,
          queryIndex: 0,
          searchQuery: acquisition?.queries[0]?.query,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Download failed");
      const selectedNote = data.selected ? " · staged on cue" : "";
      setMessage(`Saved ${data.filename} → library${selectedNote}`);
      if (kind === "image") {
        setImageUrl("");
      } else {
        setVideoUrl("");
      }
      await onAcquiredUpdated();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(null);
    }
  };

  const uploadFromComputer = async (file: File) => {
    setUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("manifestPath", manifestPath);
      formData.append("itemId", itemId);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      const selectedNote = data.acquisitionUpdated ? " · staged on cue" : "";
      setMessage(`Saved ${data.filename} → library${selectedNote}`);
      await onAcquiredUpdated();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="mt-8 rounded-xl border border-emerald-900/40 bg-emerald-950/15 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
            Download
          </h2>
          {mediaLibrary && (
            <p className="mt-1 font-mono text-xs text-zinc-500">
              Downloads → public/media/_library/ · staged refs in acquisition.json
            </p>
          )}
        </div>
        {mediaLibrary && (
          <a
            href={libraryHrefForCue(manifestPath, itemId)}
            className="rounded-lg border border-emerald-800 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-950"
          >
            Select from library
          </a>
        )}
      </div>

      <div className="mt-4 space-y-4">
        <GenerateStickerPanel
          manifestPath={manifestPath}
          itemId={itemId}
          acquisition={acquisition}
          spokenHint={spokenHint}
          onAcquiredUpdated={onAcquiredUpdated}
          onStickerOverlayEnabledChange={onStickerOverlayEnabledChange}
          onStickerOverlaySizeChange={onStickerOverlaySizeChange}
        />

        <GiphyStickerPanel
          manifestPath={manifestPath}
          itemId={itemId}
          acquisition={acquisition}
          spokenHint={spokenHint}
          onStickerOverlayEnabledChange={onStickerOverlayEnabledChange}
          onStickerOverlaySizeChange={onStickerOverlaySizeChange}
          onAcquiredUpdated={onAcquiredUpdated}
        />

        <DownloadUrlRow
          label="Image URL"
          placeholder="Paste direct image URL"
          value={imageUrl}
          onChange={setImageUrl}
          buttonText="Download image"
          downloading={downloading === "image"}
          disabled={busy}
          onDownload={() => download("image")}
        />

        <DownloadUrlRow
          label="Video URL"
          placeholder="Paste YouTube or direct video URL"
          value={videoUrl}
          onChange={setVideoUrl}
          buttonText="Download video"
          downloading={downloading === "video"}
          disabled={busy}
          onDownload={() => download("video")}
        />

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
          <p className="text-xs font-medium text-zinc-400">From your computer</p>
          <p className="mt-1 text-xs text-zinc-600">
            Uploads to the repo library and stages a reference on this cue (same as
            download).
          </p>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,video/*,audio/*,.mp4,.mov,.webm,.m4v,.mkv,.webp,.jpg,.jpeg,.png,.gif"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadFromComputer(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 rounded-lg border border-emerald-800 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-950 disabled:opacity-50"
          >
            {uploading ? "Copying…" : "Pick from computer"}
          </button>
        </div>
      </div>

      {message && (
        <p className="mt-2 text-xs text-emerald-300/90">{message}</p>
      )}

      {acquiredFiles.length > 0 && mediaLibrary && (
        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
          <p className="text-xs font-medium text-zinc-500">
            Legacy acquired/ files ({acquiredFiles.length}) — episode 001 copies only
          </p>
          <ul className="mt-2 space-y-1 font-mono text-xs">
            {acquiredFiles.map((file) => (
              <li key={file}>
                <a
                  className="text-emerald-300/90 hover:underline"
                  href={`${mediaLibrary.publicBaseUrl}/${itemId}/acquired/${file}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {file}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function DownloadUrlRow({
  label,
  placeholder,
  value,
  onChange,
  buttonText,
  downloading,
  disabled,
  onDownload,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  buttonText: string;
  downloading: boolean;
  disabled: boolean;
  onDownload: () => Promise<void>;
}) {
  return (
    <label className="block text-sm">
      <span className="text-zinc-500">{label}</span>
      <div className="mt-1 flex flex-col gap-2 sm:flex-row">
        <input
          className="min-w-[220px] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void onDownload();
            }
          }}
        />
        <button
          type="button"
          disabled={!value.trim() || disabled}
          onClick={() => void onDownload()}
          className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          {downloading ? "Downloading..." : buttonText}
        </button>
      </div>
    </label>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="text-zinc-300">{value}</dd>
    </div>
  );
}
