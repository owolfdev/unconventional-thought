import { findIncompleteItemIndex } from "@/lib/acquisition";
import { cloneSavedItems } from "@/lib/acquisition-dirty";
import { formatCueLabel, formatCuePositionLabel, normalizeCueId } from "@/lib/cue-id";
import {
  formatEffects,
  formatInfo,
  formatLayers,
  formatStatus,
} from "./format-cue-info";
import { formatEpisodesList } from "./format-episodes";
import {
  formatEffectsHelp,
  mutateEffectsList,
  resolveEffectId,
} from "./effect-commands";
import {
  applyVisualModeChange,
  formatCurrentMode,
  formatModesHelp,
  resolveVisualModeArg,
} from "./mode-commands";
import { gallerySummary, runGallerySearch } from "./search-gallery";
import { gallerySizeHelp, saveGallerySize } from "./gallery-size";
import { parseRenderRange, renderRangeLabel } from "./render-parse";
import type { CommandContext } from "./context";
import { requireCueContext } from "./context";
import { persistAcquisitionItem } from "./persist-acquisition";
import type { ItemAcquisition } from "@/lib/types";
import type { GallerySource, ParsedDirective } from "./types";
import type { RenderJob } from "@/lib/render-launcher";

export function goToAdjacentCue(ctx: CommandContext, delta: -1 | 1): void {
  const { items, itemIndex, isDirty } = ctx.state;
  const next = itemIndex + delta;
  if (next < 0 || next >= items.length) return;
  if (isDirty) {
    ctx.actions.pushLine(
      "Unsaved changes — @save first or changes may be lost.",
      "warn",
    );
  }
  ctx.actions.navigateToIndex(next);
  const item = items[next];
  ctx.actions.pushLine(
    `→ ${formatCueLabel(item.id)} · ${formatCuePositionLabel(item, items.length)}`,
  );
}

export function goToCueId(ctx: CommandContext, id: string): void {
  const { items, isDirty } = ctx.state;
  const normalized = normalizeCueId(id);
  const idx = items.findIndex(
    (it) => it.id.toLowerCase() === normalized.toLowerCase(),
  );
  if (idx < 0) {
    ctx.actions.pushLine(
      `Cue not found: ${formatCueLabel(normalized)}`,
      "error",
    );
    return;
  }
  if (isDirty) {
    ctx.actions.pushLine(
      "Unsaved changes — @save first or changes may be lost.",
      "warn",
    );
  }
  ctx.actions.navigateToIndex(idx);
  ctx.actions.pushLine(`→ ${formatCueLabel(normalized)}`);
}

export function switchEpisode(ctx: CommandContext, ref: string): void {
  const { episodes, isDirty } = ctx.state;
  const normalized = ref.trim().toLowerCase();
  const ep = episodes.find(
    (e) =>
      e.number === normalized ||
      e.episodeId.toLowerCase().startsWith(`${normalized}_`) ||
      e.episodeId.toLowerCase() === normalized,
  );
  if (!ep?.hasManifest) {
    ctx.actions.pushLine(`Episode not found: ${ref}`, "error");
    return;
  }
  if (isDirty) {
    ctx.actions.pushLine("Unsaved changes — @save first.", "warn");
    return;
  }
  void ctx.actions.loadManifest(ep.manifestPath).catch((e) =>
    ctx.actions.pushLine(
      e instanceof Error ? e.message : "Load failed",
      "error",
    ),
  );
  ctx.actions.pushLine(`Loaded ${ep.episodeId}`);
}

export async function handleSave(ctx: CommandContext): Promise<void> {
  const cue = requireCueContext(ctx);
  if (!cue) return;

  ctx.actions.setSaving(true);
  try {
    const res = await fetch("/api/acquisition", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        manifestPath: cue.loadState.manifestPath,
        acquisition: cue.loadState.acquisition,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Save failed");
    ctx.actions.setLoadState((s) =>
      s ? { ...s, acquisition: data.acquisition } : s,
    );
    ctx.actions.setSavedItems(cloneSavedItems(data.acquisition.items));
    ctx.actions.pushLine(`Saved → ${data.path}`, "success");
    await ctx.actions.refreshAfterAcquiredChange();
  } catch (e) {
    ctx.actions.pushLine(
      e instanceof Error ? e.message : "Save failed",
      "error",
    );
  } finally {
    ctx.actions.setSaving(false);
  }
}

export async function handleEffect(
  ctx: CommandContext,
  action: "add" | "remove",
  rawId: string,
): Promise<void> {
  const cue = requireCueContext(ctx);
  if (!cue) return;

  const id = resolveEffectId(rawId);
  if (!id) {
    ctx.actions.pushLine(
      `Unknown effect: ${rawId}\nTry @help effects`,
      "error",
    );
    return;
  }

  const { next, changed, message } = mutateEffectsList(
    cue.currentAcq.effects ?? [],
    action,
    id,
  );
  if (!changed) {
    ctx.actions.pushLine(message ?? "No change.", "warn");
    return;
  }

  const updated: ItemAcquisition = {
    ...cue.currentAcq,
    effects: next,
    updated_at: new Date().toISOString(),
  };
  const result = await persistAcquisitionItem(
    ctx,
    cue.currentItem.id,
    updated,
  );
  if (!result.ok) {
    ctx.actions.pushLine(result.error, "error");
    return;
  }
  ctx.actions.pushLine(
    [
      `Effect ${action === "add" ? "added" : "removed"}: ${id}`,
      formatEffects({ ...cue.currentAcq, effects: next }),
    ].join("\n"),
    "success",
  );
}

export async function handleMode(
  ctx: CommandContext,
  rawMode?: string,
): Promise<void> {
  const cue = requireCueContext(ctx);
  if (!cue) return;

  if (!rawMode) {
    ctx.actions.pushLine(formatCurrentMode(cue.currentAcq));
    return;
  }

  const mode = resolveVisualModeArg(rawMode);
  if (!mode) {
    ctx.actions.pushLine(
      `Unknown visual mode: ${rawMode}\nTry @help mode`,
      "error",
    );
    return;
  }

  const updated = applyVisualModeChange(
    cue.currentAcq,
    mode,
    cue.currentItem,
  );
  if (updated === cue.currentAcq) {
    ctx.actions.pushLine(`Already ${mode}.`, "warn");
    return;
  }

  const result = await persistAcquisitionItem(
    ctx,
    cue.currentItem.id,
    updated,
  );
  if (!result.ok) {
    ctx.actions.pushLine(result.error, "error");
    return;
  }
  ctx.actions.pushLine(
    [`Visual mode → ${mode}`, formatCurrentMode(updated)].join("\n"),
    "success",
  );
}

export async function handleRender(
  ctx: CommandContext,
  args: string[],
): Promise<void> {
  const { loadState, isDirty } = ctx.state;
  if (!loadState) return;

  const parsed = parseRenderRange(args);
  if (typeof parsed === "string") {
    ctx.actions.pushLine(parsed, "error");
    return;
  }

  if (isDirty) {
    ctx.actions.pushLine("Unsaved changes — @save first.", "warn");
    return;
  }

  const manifestIds = new Set(
    loadState.manifest.items.map((i) => i.id.toLowerCase()),
  );
  for (const id of [parsed.from, parsed.to]) {
    if (!manifestIds.has(id.toLowerCase())) {
      ctx.actions.pushLine(`Cue not in manifest: ${id}`, "error");
      return;
    }
  }

  ctx.actions.setBusy(true);
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
    };
    if (!res.ok) throw new Error(data.error ?? "Render failed to start");
    if (data.job) {
      ctx.actions.setRenderJob(data.job);
      ctx.actions.pushLine(
        `Rendering ${renderRangeLabel(parsed.from, parsed.to)} (preview)…`,
        "success",
      );
    }
  } catch (e) {
    ctx.actions.pushLine(
      e instanceof Error ? e.message : "Render failed",
      "error",
    );
  } finally {
    ctx.actions.setBusy(false);
  }
}

export function handlePlay(
  ctx: CommandContext,
  loopCount?: number | null,
): void {
  const { renderJob } = ctx.state;
  if (!renderJob || renderJob.status !== "completed") {
    ctx.actions.pushLine("No completed render — @render first.", "warn");
    return;
  }

  const seq = ctx.actions.bumpPlaySeq();
  ctx.actions.setPlayRequest({ seq, loopCount });

  const label =
    loopCount === null
      ? "Playing render preview (loop)."
      : typeof loopCount === "number"
        ? `Playing render preview (${loopCount}×).`
        : "Playing render preview.";
  ctx.actions.pushLine(label, "success");
}

export async function handleSearch(
  ctx: CommandContext,
  engine: GallerySource,
  query: string,
): Promise<void> {
  ctx.actions.setBusy(true);
  try {
    const nextGallery = await runGallerySearch(engine, query);
    ctx.actions.setGallery(nextGallery);
    ctx.actions.pushLine(gallerySummary(nextGallery));
    if (nextGallery.apiNote) {
      ctx.actions.pushLine(nextGallery.apiNote, "warn");
    }
  } catch (e) {
    ctx.actions.pushLine(
      e instanceof Error ? e.message : "Search failed",
      "error",
    );
  } finally {
    ctx.actions.setBusy(false);
  }
}

export async function handleAdd(ctx: CommandContext, index: number): Promise<void> {
  const cue = requireCueContext(ctx);
  if (!cue) return;
  const { gallery } = ctx.state;
  if (!gallery) {
    ctx.actions.pushLine("No gallery results.", "error");
    return;
  }
  const result = gallery.results[index - 1];
  if (!result) {
    ctx.actions.pushLine(`No result #${index}.`, "error");
    return;
  }

  ctx.actions.setBusy(true);
  try {
    if (gallery.source === "gif") {
      const hit = gallery.giphyHits?.find((h) => `giphy-${h.id}` === result.id);
      if (!hit) throw new Error("GIPHY hit not found.");
      const res = await fetch("/api/giphy/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manifestPath: cue.loadState.manifestPath,
          itemId: cue.currentItem.id,
          giphyId: hit.id,
          downloadUrl: hit.downloadUrl,
          title: hit.title,
          autoSelect: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      ctx.actions.pushLine(
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
          manifestPath: cue.loadState.manifestPath,
          itemId: cue.currentItem.id,
          libraryId,
          selected: true,
          searchQuery: gallery.query,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Stage failed");
      ctx.actions.pushLine(
        `Added [${index}] ${result.title} from library`,
        "success",
      );
    } else {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manifestPath: cue.loadState.manifestPath,
          itemId: cue.currentItem.id,
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
      ctx.actions.pushLine(
        `Added [${index}] ${data.filename ?? result.title}`,
        "success",
      );
    }
    await ctx.actions.refreshAfterAcquiredChange();
  } catch (e) {
    ctx.actions.pushLine(
      e instanceof Error ? e.message : "Add failed",
      "error",
    );
  } finally {
    ctx.actions.setBusy(false);
  }
}

export function handlePreviewGallery(ctx: CommandContext, index: number): void {
  const { gallery } = ctx.state;
  if (!gallery) return;
  const result = gallery.results[index - 1];
  if (!result) {
    ctx.actions.pushLine(`No result #${index}.`, "error");
    return;
  }
  ctx.actions.pushLine(
    [
      `[${index}] ${result.title}`,
      result.url,
      result.license,
      result.source_page,
    ].join("\n"),
  );
}

export async function handleComplete(ctx: CommandContext): Promise<void> {
  const cue = requireCueContext(ctx);
  if (!cue) return;

  const completed: ItemAcquisition = {
    ...cue.currentAcq,
    status: "complete",
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const result = await persistAcquisitionItem(
    ctx,
    cue.currentItem.id,
    completed,
  );
  if (!result.ok) {
    ctx.actions.pushLine(result.error, "error");
    return;
  }
  const next = Math.min(
    ctx.state.itemIndex + 1,
    ctx.state.items.length - 1,
  );
  ctx.actions.navigateToIndex(next);
  ctx.actions.pushLine(
    `${formatCueLabel(cue.currentItem.id)} complete → next cue`,
    "success",
  );
}

export function handleNavigate(
  ctx: CommandContext,
  parsed: Extract<ParsedDirective, { kind: "navigate" }>,
): void {
  if (parsed.target === "cue" && parsed.cueId) {
    goToCueId(ctx, parsed.cueId);
    return;
  }
  if (parsed.target === "next") {
    goToAdjacentCue(ctx, 1);
    return;
  }
  if (parsed.target === "prev") {
    goToAdjacentCue(ctx, -1);
    return;
  }
  if (parsed.target === "next_incomplete") {
    const cue = requireCueContext(ctx);
    if (!cue) return;
    const idx = findIncompleteItemIndex(
      ctx.state.items,
      cue.loadState.acquisition.items,
      ctx.state.itemIndex,
      1,
    );
    if (idx === null) {
      ctx.actions.pushLine("No more incomplete cues ahead.", "warn");
    } else {
      ctx.actions.navigateToIndex(idx);
    }
  }
}

export function handleGallerySize(
  ctx: CommandContext,
  size: ParsedDirective extends { kind: "gallery" } ? ParsedDirective["size"] : never,
): void {
  if (size) {
    ctx.actions.setGallerySize(size);
    saveGallerySize(size);
    ctx.actions.pushLine(`Gallery size → ${size}`, "success");
  } else {
    ctx.actions.pushLine(gallerySizeHelp(ctx.state.gallerySize));
  }
}

export function handlePhase5Stub(
  ctx: CommandContext,
  parsed: ParsedDirective,
): void {
  if (parsed.kind === "split") {
    ctx.actions.pushLine(
      `Split preview (${parsed.lines.length} cues):\n${parsed.lines.map((l, i) => `  ${i + 1}. "${l}"`).join("\n")}\n\n@implementation phase 5 — @confirm not wired yet`,
      "warn",
    );
    return;
  }
  if (parsed.kind === "merge") {
    ctx.actions.pushLine(
      `Merge ${formatCueLabel(parsed.firstId)} + ${formatCueLabel(parsed.secondId)} — @implementation phase 5.\nWhich cue's content? Reply @use ${formatCueLabel(parsed.firstId)} or @use ${formatCueLabel(parsed.secondId)}`,
      "warn",
    );
    return;
  }
  ctx.actions.pushLine(`${parsed.kind} — phase 5.`, "warn");
}

export function handleReadOnlyCue(
  ctx: CommandContext,
  parsed: ParsedDirective,
): void {
  const cue = requireCueContext(ctx);
  if (!cue) return;

  switch (parsed.kind) {
    case "info":
      ctx.actions.pushLine(
        formatInfo(
          cue.currentItem,
          cue.currentAcq,
          cue.loadState.manifest.episode,
          ctx.state.isDirty,
        ),
      );
      break;
    case "layers":
      ctx.actions.pushLine(formatLayers(cue.currentAcq));
      break;
    case "effects":
      ctx.actions.pushLine(formatEffects(cue.currentAcq));
      break;
    case "status":
      ctx.actions.pushLine(
        formatStatus(
          cue.currentItem,
          cue.currentAcq,
          ctx.state.items.length,
          ctx.state.isDirty,
        ),
      );
      break;
    default:
      break;
  }
}

export function handleHelpTopic(
  ctx: CommandContext,
  topic: "effects" | "modes",
): void {
  if (topic === "effects") {
    ctx.actions.pushLine(formatEffectsHelp());
  } else {
    ctx.actions.pushLine(formatModesHelp());
  }
}

export function handleEpisodes(ctx: CommandContext): void {
  ctx.actions.pushLine(
    formatEpisodesList(ctx.state.episodes, ctx.state.loadState?.manifestPath),
  );
}
