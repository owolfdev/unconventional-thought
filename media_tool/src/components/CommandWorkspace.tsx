"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { EpisodeInfo } from "@/lib/episodes";
import { findIncompleteItemIndex } from "@/lib/acquisition";
import {
  cloneSavedItems,
  isItemAcquisitionDirty,
} from "@/lib/acquisition-dirty";
import { helpText, formatCueLabel, normalizeCueId, parseDirectiveInput } from "@/lib/command/directives";
import {
  formatEffects,
  formatInfo,
  formatLayers,
  formatStatus,
} from "@/lib/command/format-cue-info";
import { formatEpisodesList } from "@/lib/command/format-episodes";
import {
  formatEffectsHelp,
  mutateEffectsList,
  resolveEffectId,
} from "@/lib/command/effect-commands";
import {
  applyVisualModeChange,
  formatCurrentMode,
  formatModesHelp,
  resolveVisualModeArg,
} from "@/lib/command/mode-commands";
import {
  gallerySummary,
  runGallerySearch,
} from "@/lib/command/search-gallery";
import {
  gallerySizeHelp,
  loadGallerySize,
  saveGallerySize,
  type GallerySize,
} from "@/lib/command/gallery-size";
import {
  parseRenderRange,
  renderRangeLabel,
} from "@/lib/command/render-parse";
import type { GalleryState, PlayRequest, ResponseLine } from "@/lib/command/types";
import type { RenderJob } from "@/lib/render-launcher";
import type {
  ItemAcquisition,
  MediaToolItem,
  MediaAcquisitionDocument,
  MediaToolManifest,
} from "@/lib/types";
import { SelectedMediaPreview } from "./SelectedMediaPreview";
import { CommandFooter } from "./command/CommandFooter";
import { CommandRenderPanel } from "./command/CommandRenderPanel";
import { CueStatsPanel } from "./command/CueStatsPanel";
import { ResponseArea } from "./command/ResponseArea";
import type { MediaLibraryStatus } from "./ReviewWorkspace";

const DEFAULT_MANIFEST =
  process.env.NEXT_PUBLIC_DEFAULT_MANIFEST_PATH ||
  "episodes/001_WhoWroteBackInBlack/timeline/media_search.json";

interface LoadState {
  manifest: MediaToolManifest;
  acquisition: MediaAcquisitionDocument;
  manifestPath: string;
  acquisitionPath: string;
  mediaLibrary: MediaLibraryStatus | null;
}

function pushLine(
  setLines: (fn: (prev: ResponseLine[]) => ResponseLine[]) => void,
  text: string,
  tone: ResponseLine["tone"] = "info",
) {
  setLines((prev) => [...prev.slice(-40), { text, tone }]);
}

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
  const [playRequest, setPlayRequest] = useState<PlayRequest | null>(null);
  const playSeqRef = useRef(0);
  const didInitialLoad = useRef(false);

  const items = loadState?.manifest.items ?? [];
  const currentItem = items[itemIndex];
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

  const saveAcquisition = useCallback(async (): Promise<boolean> => {
    if (!loadState) return false;
    setSaving(true);
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
      setLoadState((s) => (s ? { ...s, acquisition: data.acquisition } : s));
      setSavedItems(cloneSavedItems(data.acquisition.items));
      pushLine(setResponseLines, `Saved → ${data.path}`, "success");
      await refreshAcquired();
      return true;
    } catch (e) {
      pushLine(
        setResponseLines,
        e instanceof Error ? e.message : "Save failed",
        "error",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [loadState, refreshAcquired]);

  const applyEffectCommand = useCallback(
    async (action: "add" | "remove", rawId: string) => {
      if (!loadState || !currentItem || !currentAcq) return;

      const id = resolveEffectId(rawId);
      if (!id) {
        pushLine(
          setResponseLines,
          `Unknown effect: ${rawId}\nTry @help effects`,
          "error",
        );
        return;
      }

      const { next, changed, message } = mutateEffectsList(
        currentAcq.effects ?? [],
        action,
        id,
      );
      if (!changed) {
        pushLine(setResponseLines, message ?? "No change.", "warn");
        return;
      }

      const updated: ItemAcquisition = {
        ...currentAcq,
        effects: next,
        updated_at: new Date().toISOString(),
      };
      const acquisition = {
        ...loadState.acquisition,
        items: {
          ...loadState.acquisition.items,
          [currentItem.id]: updated,
        },
      };

      setSaving(true);
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
        setLoadState((s) => (s ? { ...s, acquisition: data.acquisition } : s));
        setSavedItems(cloneSavedItems(data.acquisition.items));
        pushLine(
          setResponseLines,
          [
            `Effect ${action === "add" ? "added" : "removed"}: ${id}`,
            formatEffects({ ...currentAcq, effects: next }),
          ].join("\n"),
          "success",
        );
      } catch (e) {
        pushLine(
          setResponseLines,
          e instanceof Error ? e.message : "Save failed",
          "error",
        );
      } finally {
        setSaving(false);
      }
    },
    [loadState, currentItem, currentAcq],
  );

  const applyModeCommand = useCallback(
    async (rawMode?: string) => {
      if (!loadState || !currentItem || !currentAcq) return;

      if (!rawMode) {
        pushLine(setResponseLines, formatCurrentMode(currentAcq));
        return;
      }

      const mode = resolveVisualModeArg(rawMode);
      if (!mode) {
        pushLine(
          setResponseLines,
          `Unknown visual mode: ${rawMode}\nTry @help modes`,
          "error",
        );
        return;
      }

      if (currentAcq.resolved_visual_mode === mode) {
        pushLine(setResponseLines, `Already ${mode}.`, "warn");
        return;
      }

      const updated = applyVisualModeChange(currentAcq, mode);

      const acquisition = {
        ...loadState.acquisition,
        items: {
          ...loadState.acquisition.items,
          [currentItem.id]: updated,
        },
      };

      setSaving(true);
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
        setLoadState((s) => (s ? { ...s, acquisition: data.acquisition } : s));
        setSavedItems(cloneSavedItems(data.acquisition.items));
        pushLine(
          setResponseLines,
          [`Visual mode → ${mode}`, formatCurrentMode(updated)].join("\n"),
          "success",
        );
      } catch (e) {
        pushLine(
          setResponseLines,
          e instanceof Error ? e.message : "Save failed",
          "error",
        );
      } finally {
        setSaving(false);
      }
    },
    [loadState, currentItem, currentAcq],
  );

  const startCueRender = useCallback(
    async (args: string[]) => {
      if (!loadState) return;

      const parsed = parseRenderRange(args);
      if (typeof parsed === "string") {
        pushLine(setResponseLines, parsed, "error");
        return;
      }

      if (isDirty) {
        pushLine(setResponseLines, "Unsaved changes — @save first.", "warn");
        return;
      }

      const manifestIds = new Set(
        loadState.manifest.items.map((i) => i.id.toLowerCase()),
      );
      for (const id of [parsed.from, parsed.to]) {
        if (!manifestIds.has(id.toLowerCase())) {
          pushLine(setResponseLines, `Cue not in manifest: ${id}`, "error");
          return;
        }
      }

      setBusy(true);
      try {
        const res = await fetch("/api/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            manifestPath: loadState.manifestPath,
            from: parsed.from,
            to: parsed.to,
            quality: "preview",
          }),
        });
        const data = (await res.json()) as {
          error?: string;
          job?: RenderJob;
          message?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Render failed to start");
        if (data.job) {
          setRenderJob(data.job);
          pushLine(
            setResponseLines,
            `Rendering ${renderRangeLabel(parsed.from, parsed.to)} (preview)…`,
            "success",
          );
        }
      } catch (e) {
        pushLine(
          setResponseLines,
          e instanceof Error ? e.message : "Render failed",
          "error",
        );
      } finally {
        setBusy(false);
      }
    },
    [loadState, isDirty],
  );

  const playRenderPreview = useCallback(
    (loopCount?: number | null) => {
      if (!renderJob || renderJob.status !== "completed") {
        pushLine(
          setResponseLines,
          "No completed render — @render first.",
          "warn",
        );
        return;
      }

      playSeqRef.current += 1;
      setPlayRequest({ seq: playSeqRef.current, loopCount });

      const label =
        loopCount === null
          ? "Playing render preview (loop)."
          : typeof loopCount === "number"
            ? `Playing render preview (${loopCount}×).`
            : "Playing render preview.";
      pushLine(setResponseLines, label, "success");
    },
    [renderJob],
  );

  const navigateToIndex = useCallback((index: number) => {
    if (index < 0 || index >= items.length) return;
    setItemIndex(index);
    setGallery(null);
  }, [items.length]);

  const goToCueId = useCallback(
    (id: string) => {
      const normalized = normalizeCueId(id);
      const idx = items.findIndex(
        (it) => it.id.toLowerCase() === normalized.toLowerCase(),
      );
      if (idx < 0) {
        pushLine(setResponseLines, `Cue not found: ${formatCueLabel(normalized)}`, "error");
        return;
      }
      if (isDirty) {
        pushLine(
          setResponseLines,
          "Unsaved changes — @save first or changes may be lost.",
          "warn",
        );
      }
      navigateToIndex(idx);
      pushLine(setResponseLines, `→ ${formatCueLabel(normalized)}`);
    },
    [items, isDirty, navigateToIndex],
  );

  const addGalleryResult = useCallback(
    async (index: number) => {
      if (!loadState || !currentItem || !gallery) {
        pushLine(setResponseLines, "No gallery results.", "error");
        return;
      }
      const result = gallery.results[index - 1];
      if (!result) {
        pushLine(setResponseLines, `No result #${index}.`, "error");
        return;
      }

      setBusy(true);
      try {
        if (gallery.source === "gif") {
          const hit = gallery.giphyHits?.find((h) => `giphy-${h.id}` === result.id);
          if (!hit) throw new Error("GIPHY hit not found.");
          const res = await fetch("/api/giphy/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              manifestPath: loadState.manifestPath,
              itemId: currentItem.id,
              giphyId: hit.id,
              downloadUrl: hit.downloadUrl,
              title: hit.title,
              autoSelect: true,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Import failed");
          pushLine(
            setResponseLines,
            `Added [${index}] ${data.filename} (GIF sticker)`,
            "success",
          );
        } else if (gallery.source === "library") {
          const libraryId = result.id.startsWith("library-")
            ? result.id.slice("library-".length)
            : result.id.replace(/^library:/, "");
          const res = await fetch("/api/library/stage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              manifestPath: loadState.manifestPath,
              itemId: currentItem.id,
              libraryId,
              selected: true,
              searchQuery: gallery.query,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Stage failed");
          pushLine(
            setResponseLines,
            `Added [${index}] ${result.title} from library`,
            "success",
          );
        } else {
          const res = await fetch("/api/download", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              manifestPath: loadState.manifestPath,
              itemId: currentItem.id,
              url: result.url,
              title: result.title,
              license: result.license,
              searchQuery: gallery.query,
              sourceEngine:
                gallery.source === "google" ? "google_images" : "youtube",
              queryIndex: 0,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Download failed");
          pushLine(
            setResponseLines,
            `Added [${index}] ${data.filename ?? result.title}`,
            "success",
          );
        }
        await refreshAfterAcquiredChange();
      } catch (e) {
        pushLine(
          setResponseLines,
          e instanceof Error ? e.message : "Add failed",
          "error",
        );
      } finally {
        setBusy(false);
      }
    },
    [loadState, currentItem, gallery, refreshAfterAcquiredChange],
  );

  const previewGalleryResult = useCallback(
    (index: number) => {
      if (!gallery) return;
      const result = gallery.results[index - 1];
      if (!result) {
        pushLine(setResponseLines, `No result #${index}.`, "error");
        return;
      }
      pushLine(
        setResponseLines,
        [
          `[${index}] ${result.title}`,
          result.url,
          result.license,
          result.source_page,
        ].join("\n"),
      );
    },
    [gallery],
  );

  const switchEpisode = useCallback(
    (ref: string) => {
      const normalized = ref.trim().toLowerCase();
      const ep = episodes.find(
        (e) =>
          e.number === normalized ||
          e.episodeId.toLowerCase().startsWith(`${normalized}_`) ||
          e.episodeId.toLowerCase() === normalized,
      );
      if (!ep?.hasManifest) {
        pushLine(setResponseLines, `Episode not found: ${ref}`, "error");
        return;
      }
      if (isDirty) {
        pushLine(setResponseLines, "Unsaved changes — @save first.", "warn");
        return;
      }
      loadManifest(ep.manifestPath).catch((e) =>
        pushLine(
          setResponseLines,
          e instanceof Error ? e.message : "Load failed",
          "error",
        ),
      );
      pushLine(setResponseLines, `Loaded ${ep.episodeId}`);
    },
    [episodes, isDirty, loadManifest],
  );

  const completeAndNext = useCallback(async () => {
    if (!loadState || !currentItem || !currentAcq) return;
    const completed: ItemAcquisition = {
      ...currentAcq,
      status: "complete",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setSaving(true);
    try {
      const acquisition = {
        ...loadState.acquisition,
        items: {
          ...loadState.acquisition.items,
          [currentItem.id]: completed,
        },
      };
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
      setLoadState((s) => (s ? { ...s, acquisition: data.acquisition } : s));
      setSavedItems(cloneSavedItems(data.acquisition.items));
      const next = Math.min(itemIndex + 1, items.length - 1);
      navigateToIndex(next);
      pushLine(setResponseLines, `${formatCueLabel(currentItem.id)} complete → next cue`, "success");
    } catch (e) {
      pushLine(
        setResponseLines,
        e instanceof Error ? e.message : "Complete failed",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }, [
    loadState,
    currentItem,
    currentAcq,
    itemIndex,
    items.length,
    navigateToIndex,
  ]);

  const handleSubmit = useCallback(async () => {
    const raw = prompt.trim();
    if (!raw) return;
    setPrompt("");

    const parsed = parseDirectiveInput(raw);
    if (parsed.kind === "unknown") {
      if (raw.startsWith("@")) {
        pushLine(
          setResponseLines,
          parsed.raw || `Unknown directive: ${raw.split("\n")[0]}`,
          "error",
        );
        return;
      }
      pushLine(
        setResponseLines,
        "Natural language agent coming in phase 4. Try @help or @search library …",
        "warn",
      );
      return;
    }

    if (parsed.kind === "help") {
      pushLine(setResponseLines, helpText());
      return;
    }
    if (parsed.kind === "helpTopic") {
      if (parsed.topic === "effects") {
        pushLine(setResponseLines, formatEffectsHelp());
      } else if (parsed.topic === "modes") {
        pushLine(setResponseLines, formatModesHelp());
      }
      return;
    }
    if (parsed.kind === "episodes") {
      pushLine(
        setResponseLines,
        formatEpisodesList(episodes, loadState?.manifestPath),
      );
      return;
    }
    if (parsed.kind === "episode") {
      switchEpisode(parsed.ref);
      return;
    }

    if (!loadState || !currentItem || !currentAcq) {
      pushLine(setResponseLines, "Manifest not loaded.", "error");
      return;
    }

    switch (parsed.kind) {
      case "info":
        pushLine(
          setResponseLines,
          formatInfo(
            currentItem,
            currentAcq,
            loadState.manifest.episode,
            isDirty,
          ),
        );
        break;
      case "layers":
        pushLine(setResponseLines, formatLayers(currentAcq));
        break;
      case "effects":
        pushLine(setResponseLines, formatEffects(currentAcq));
        break;
      case "effect":
        await applyEffectCommand(parsed.action, parsed.id);
        break;
      case "mode":
        await applyModeCommand(parsed.set);
        break;
      case "render":
        await startCueRender(parsed.args);
        break;
      case "play":
        playRenderPreview(parsed.loopCount);
        break;
      case "status":
        pushLine(
          setResponseLines,
          formatStatus(currentItem, currentAcq, itemIndex, items.length, isDirty),
        );
        break;
      case "navigate": {
        if (parsed.target === "cue" && parsed.cueId) {
          goToCueId(parsed.cueId);
          break;
        }
        if (parsed.target === "next") {
          navigateToIndex(Math.min(itemIndex + 1, items.length - 1));
          break;
        }
        if (parsed.target === "prev") {
          navigateToIndex(Math.max(itemIndex - 1, 0));
          break;
        }
        if (parsed.target === "next_incomplete") {
          const idx = findIncompleteItemIndex(
            items,
            loadState.acquisition.items,
            itemIndex,
            1,
          );
          if (idx === null) {
            pushLine(setResponseLines, "No more incomplete cues ahead.", "warn");
          } else {
            navigateToIndex(idx);
          }
        }
        break;
      }
      case "search": {
        setBusy(true);
        try {
          const nextGallery = await runGallerySearch(parsed.engine, parsed.query);
          setGallery(nextGallery);
          pushLine(setResponseLines, gallerySummary(nextGallery));
        } catch (e) {
          pushLine(
            setResponseLines,
            e instanceof Error ? e.message : "Search failed",
            "error",
          );
        } finally {
          setBusy(false);
        }
        break;
      }
      case "add":
        await addGalleryResult(parsed.index);
        break;
      case "preview":
        previewGalleryResult(parsed.index);
        break;
      case "gallery":
        if (parsed.size) {
          setGallerySize(parsed.size);
          saveGallerySize(parsed.size);
          pushLine(
            setResponseLines,
            `Gallery size → ${parsed.size}`,
            "success",
          );
        } else {
          pushLine(setResponseLines, gallerySizeHelp(gallerySize));
        }
        break;
      case "save":
        await saveAcquisition();
        break;
      case "complete":
        await completeAndNext();
        break;
      case "split":
        pushLine(
          setResponseLines,
          `Split preview (${parsed.lines.length} cues):\n${parsed.lines.map((l, i) => `  ${i + 1}. "${l}"`).join("\n")}\n\n@implementation phase 5 — @confirm not wired yet`,
          "warn",
        );
        break;
      case "merge":
        pushLine(
          setResponseLines,
          `Merge ${formatCueLabel(parsed.firstId)} + ${formatCueLabel(parsed.secondId)} — @implementation phase 5.\nWhich cue's content? Reply @use ${formatCueLabel(parsed.firstId)} or @use ${formatCueLabel(parsed.secondId)}`,
          "warn",
        );
        break;
      case "use":
      case "confirm":
      case "cancel":
        pushLine(setResponseLines, `${parsed.kind} — phase 5.`, "warn");
        break;
      default:
        break;
    }
  }, [
    prompt,
    loadState,
    currentItem,
    currentAcq,
    isDirty,
    itemIndex,
    items,
    goToCueId,
    navigateToIndex,
    episodes,
    switchEpisode,
    addGalleryResult,
    previewGalleryResult,
    saveAcquisition,
    applyEffectCommand,
    applyModeCommand,
    startCueRender,
    playRenderPreview,
    completeAndNext,
    gallerySize,
  ]);

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
        {/* Left: scrollable response + fixed footer (prompt + gallery) */}
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

        {/* Right: cue context + preview */}
        <aside className="flex min-h-0 w-full flex-col overflow-hidden lg:w-[min(440px,42vw)] lg:shrink-0 xl:w-[500px]">
          <CueStatsPanel
            item={currentItem}
            acq={currentAcq}
            itemIndex={itemIndex}
            total={items.length}
            dirty={isDirty}
          />
          {loadState.mediaLibrary && (
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
              <SelectedMediaPreview
                acquisition={currentAcq}
                project={loadState.mediaLibrary.project}
                itemId={currentItem.id}
                acquiredFiles={acquiredFiles}
                durationSec={currentItem.duration_sec}
                tStart={currentItem.t_start}
                tEnd={currentItem.t_end}
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
