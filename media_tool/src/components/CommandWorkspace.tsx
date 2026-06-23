"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EpisodeInfo } from "@/lib/episodes";
import {
  cloneSavedItems,
  isItemAcquisitionDirty,
} from "@/lib/acquisition-dirty";
import { formatCueLabel } from "@/lib/cue-id";
import type { CommandActions, CommandContext, CommandState, LoadState } from "@/lib/command/context";
import { executePrompt, goToAdjacentCue } from "@/lib/command/dispatch";
import { handleAdd } from "@/lib/command/handlers";
import { loadGallerySize, type GallerySize } from "@/lib/command/gallery-size";
import { pushResponseLine } from "@/lib/command/response";
import type { GalleryState, PlayRequest, ResponseLine } from "@/lib/command/types";
import { updateSelectionStartFromSec } from "@/lib/selection-media";
import type { RenderJob } from "@/lib/render-launcher";
import type { RenderLibraryEntry, RenderListFilter } from "@/lib/render-library-shared";
import type {
  ItemAcquisition,
  MediaToolItem,
} from "@/lib/types";
import {
  SelectedMediaPreview,
  type SelectedMediaPreviewHandle,
} from "./SelectedMediaPreview";
import { CommandFooter } from "./command/CommandFooter";
import { CommandRenderPanel } from "./command/CommandRenderPanel";
import { CueStatsPanel } from "./command/CueStatsPanel";
import { ResponseArea } from "./command/ResponseArea";
import type { MediaLibraryStatus } from "@/lib/types";

const DEFAULT_MANIFEST =
  process.env.NEXT_PUBLIC_DEFAULT_MANIFEST_PATH ||
  "episodes/001_WhoWroteBackInBlack/timeline/media_search.json";

export function CommandWorkspace() {
  const [loadState, setLoadState] = useState<LoadState | null>(null);
  const [itemIndex, setItemIndex] = useState(0);
  const [savedItems, setSavedItems] = useState<Record<string, ItemAcquisition>>(
    {},
  );
  const [episodes, setEpisodes] = useState<EpisodeInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [responseLines, setResponseLines] = useState<ResponseLine[]>([]);
  const [gallery, setGallery] = useState<GalleryState | null>(null);
  const [gallerySize, setGallerySize] = useState<GallerySize>("tiny");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [acquiredFiles, setAcquiredFiles] = useState<string[]>([]);
  const [renderJob, setRenderJob] = useState<RenderJob | null>(null);
  const [renderListEntries, setRenderListEntries] = useState<
    RenderLibraryEntry[] | null
  >(null);
  const [renderListFilter, setRenderListFilter] = useState<
    RenderListFilter | null
  >(null);
  const [playRequest, setPlayRequest] = useState<PlayRequest | null>(null);
  const playSeqRef = useRef(0);
  const previewRef = useRef<SelectedMediaPreviewHandle>(null);
  const didInitialLoad = useRef(false);

  const items = loadState?.manifest.items ?? [];
  const currentItem = items[itemIndex];
  const currentItemRef = useRef(currentItem);
  currentItemRef.current = currentItem;
  const currentAcq = currentItem
    ? loadState?.acquisition.items[currentItem.id]
    : undefined;
  const isDirty =
    currentItem && currentAcq
      ? isItemAcquisitionDirty(currentAcq, savedItems[currentItem.id])
      : false;

  const loadManifest = useCallback(async (path: string, targetItemId?: string) => {
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
    setItemIndex(targetIndex >= 0 ? targetIndex : 0);
    localStorage.setItem("mediaSearch.manifestPath", path);
    const url = new URL(window.location.href);
    url.searchParams.set("path", path);
    if (targetItemId) url.searchParams.set("itemId", targetItemId);
    else url.searchParams.delete("itemId");
    window.history.replaceState({}, "", url);
  }, []);

  useEffect(() => {
    setGallerySize(loadGallerySize());
  }, []);

  useEffect(() => {
    if (didInitialLoad.current) return;
    didInitialLoad.current = true;
    const params = new URLSearchParams(window.location.search);
    const saved = localStorage.getItem("mediaSearch.manifestPath");
    const path = params.get("path") || saved || DEFAULT_MANIFEST;
    const itemId = params.get("itemId") ?? undefined;
    loadManifest(path, itemId).catch((e) =>
      setError(e instanceof Error ? e.message : "Load failed"),
    );
    fetch("/api/episodes")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.episodes)) setEpisodes(d.episodes);
      })
      .catch(() => setEpisodes([]));
  }, [loadManifest]);

  const refreshAcquired = useCallback(async () => {
    if (!loadState || !currentItem) return;
    const res = await fetch(
      `/api/download?path=${encodeURIComponent(loadState.manifestPath)}&itemId=${currentItem.id}`,
    );
    const data = await res.json();
    if (res.ok) setAcquiredFiles(data.files ?? []);
  }, [loadState, currentItem]);

  const reloadItemAcquisition = useCallback(async () => {
    if (!loadState || !currentItem) return;
    const res = await fetch(
      `/api/manifest?path=${encodeURIComponent(loadState.manifestPath)}`,
    );
    const data = await res.json();
    if (!res.ok) return;
    const itemAcq = data.acquisition?.items?.[currentItem.id] as
      | ItemAcquisition
      | undefined;
    if (!itemAcq) return;
    setLoadState((s) =>
      s
        ? {
            ...s,
            acquisition: {
              ...s.acquisition,
              items: { ...s.acquisition.items, [currentItem.id]: itemAcq },
            },
          }
        : s,
    );
  }, [loadState, currentItem]);

  const refreshAfterAcquiredChange = useCallback(async () => {
    await refreshAcquired();
    await reloadItemAcquisition();
  }, [refreshAcquired, reloadItemAcquisition]);

  const manifestPath = loadState?.manifestPath;
  const currentItemId = currentItem?.id;

  useEffect(() => {
    if (!manifestPath || !currentItemId) return;
    let cancelled = false;
    fetch(
      `/api/download?path=${encodeURIComponent(manifestPath)}&itemId=${currentItemId}`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.files) setAcquiredFiles(data.files ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [manifestPath, currentItemId]);

  useEffect(() => {
    if (!manifestPath || !currentItemId) return;
    const params = new URLSearchParams();
    params.set("path", manifestPath);
    params.set("itemId", currentItemId);
    const desired = `?${params.toString()}`;
    if (window.location.search === desired) return;
    window.history.replaceState(null, "", `/${desired}`);
  }, [manifestPath, currentItemId]);

  const navigateToIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= items.length) return;
      setItemIndex(index);
      setGallery(null);
    },
    [items.length],
  );

  const updateCurrentAcq = useCallback(
    (updater: (acq: ItemAcquisition) => ItemAcquisition) => {
      const itemId = currentItemRef.current?.id;
      if (!itemId) return;
      setLoadState((s) => {
        if (!s) return s;
        const prev = s.acquisition.items[itemId];
        if (!prev) return s;
        return {
          ...s,
          acquisition: {
            ...s.acquisition,
            items: {
              ...s.acquisition.items,
              [itemId]: updater(prev),
            },
          },
        };
      });
    },
    [],
  );

  const commandState: CommandState = useMemo(
    () => ({
      loadState,
      items,
      itemIndex,
      currentItem,
      currentAcq,
      isDirty,
      episodes,
      gallery,
      gallerySize,
      renderJob,
      renderListEntries,
      renderListFilter,
    }),
    [
      loadState,
      items,
      itemIndex,
      currentItem,
      currentAcq,
      isDirty,
      episodes,
      gallery,
      gallerySize,
      renderJob,
      renderListEntries,
      renderListFilter,
    ],
  );

  const commandActions: CommandActions = useMemo(
    () => ({
      pushLine: (text, tone) => pushResponseLine(setResponseLines, text, tone),
      clearLines: () => setResponseLines([]),
      setGallery,
      setGallerySize,
      setBusy,
      setSaving,
      setLoadState,
      setSavedItems,
      setRenderJob,
      setRenderList: (entries, filter) => {
        setRenderListEntries(entries);
        setRenderListFilter(filter);
      },
      setPlayRequest,
      navigateToIndex,
      loadManifest,
      refreshAfterAcquiredChange,
      bumpPlaySeq: () => {
        playSeqRef.current += 1;
        return playSeqRef.current;
      },
      updateCurrentAcq,
      getActivePlate: () => previewRef.current?.getActivePlate() ?? null,
      getActivePlateVideoTime: () =>
        previewRef.current?.getActivePlateVideoTime() ?? null,
    }),
    [navigateToIndex, loadManifest, refreshAfterAcquiredChange, updateCurrentAcq],
  );

  const commandContext: CommandContext = useMemo(
    () => ({ state: commandState, actions: commandActions }),
    [commandState, commandActions],
  );

  const goToAdjacentCueRef = useRef(goToAdjacentCue);
  goToAdjacentCueRef.current = goToAdjacentCue;

  const contextRef = useRef(commandContext);
  contextRef.current = commandContext;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (e.key !== "[" && e.key !== "]") return;
      e.preventDefault();
      goToAdjacentCueRef.current(
        contextRef.current,
        e.key === "]" ? 1 : -1,
      );
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleSubmit = useCallback(async () => {
    const raw = prompt.trim();
    if (!raw) return;
    setPrompt("");
    await executePrompt(raw, contextRef.current);
  }, [prompt]);

  const addGalleryResult = useCallback(async (index: number) => {
    await handleAdd(contextRef.current, index);
  }, []);

  if (error && !loadState) {
    return (
      <div className="p-8 font-mono text-red-400">
        {error}
        <Link href="?legacy=1" className="ml-4 text-zinc-500 underline">
          legacy UI
        </Link>
      </div>
    );
  }

  if (!loadState || !currentItem || !currentAcq) {
    return <div className="p-8 font-mono text-zinc-500">Loading…</div>;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-800 px-4 py-2 font-mono text-xs text-zinc-400">
        <span>
          {formatCueLabel(currentItem.id)} · {loadState.manifest.episode}
          {isDirty ? " · unsaved" : ""}
        </span>
        <Link href="?legacy=1" className="text-zinc-600 hover:text-zinc-400">
          legacy
        </Link>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:border-r lg:border-zinc-800">
          <ResponseArea lines={responseLines} className="min-h-0 flex-1" />
          <CommandFooter
            prompt={prompt}
            onPromptChange={setPrompt}
            onSubmit={() => void handleSubmit()}
            busy={busy || saving}
            gallery={gallery}
            gallerySize={gallerySize}
            onGalleryAdd={(index) => addGalleryResult(index)}
          />
        </div>

        <aside className="flex min-h-0 w-full flex-col overflow-hidden lg:w-[min(440px,42vw)] lg:shrink-0 xl:w-[500px]">
          <CueStatsPanel
            item={currentItem}
            acq={currentAcq}
            total={items.length}
            dirty={isDirty}
          />
          {loadState.mediaLibrary && (
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
              <SelectedMediaPreview
                ref={previewRef}
                acquisition={currentAcq}
                project={loadState.mediaLibrary.project}
                itemId={currentItem.id}
                acquiredFiles={acquiredFiles}
                durationSec={currentItem.duration_sec}
                tStart={currentItem.t_start}
                tEnd={currentItem.t_end}
                allowVideoScrub
                onPlateStartFromSecChange={(selection, startFromSec) => {
                  updateCurrentAcq((acq) =>
                    updateSelectionStartFromSec(
                      acq,
                      selection.result_id,
                      startFromSec,
                    ),
                  );
                }}
              />
            </div>
          )}
          <div className="shrink-0">
            <CommandRenderPanel
              manifestPath={loadState.manifestPath}
              job={renderJob}
              playRequest={playRequest}
              onJobUpdate={setRenderJob}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
