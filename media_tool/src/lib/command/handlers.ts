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
  mutateEffectsList,
  resolveEffectId,
} from "./effect-commands";
import { formatHelpTopic } from "./help-topics";
import type { HelpTopic } from "./help-topics";
import {
  describeEffectScope,
  itemsForEffectScope,
  type EffectScope,
} from "./effect-scope";
import {
  applyVisualModeChange,
  formatCurrentMode,
  resolveVisualModeArg,
} from "./mode-commands";
import { gallerySummary, runGallerySearch } from "./search-gallery";
import { gallerySizeHelp, saveGallerySize } from "./gallery-size";
import { renderRangeLabel } from "./render-parse";
import type { RenderCommand } from "./render-command-parse";
import {
  formatRenderList,
  renderJobFromEntry,
  resolveRenderEntry,
  type RenderLibraryEntry,
  type RenderListFilter,
} from "@/lib/render-library-shared";
import type { CommandContext } from "./context";
import { requireCueContext } from "./context";
import { persistAcquisitionItem, persistAcquisitionItems } from "./persist-acquisition";
import type { ItemAcquisition, TextGraphic } from "@/lib/types";
import type { GallerySource, ParsedDirective } from "./types";
import type { RenderJob } from "@/lib/render-launcher";
import { withoutStickerSelections } from "@/lib/overlay-media";
import { mediaKindFromUrl } from "@/lib/selection-media";

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
  scope: EffectScope = { type: "current" },
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

  if (scope.type === "current") {
    await applyEffectToItems(ctx, action, id, [cue.currentItem], cue);
    return;
  }

  const targets = itemsForEffectScope(ctx.state.items, scope);
  if (targets.length === 0) {
    ctx.actions.pushLine(
      `No cues match ${describeEffectScope(scope)}.`,
      "warn",
    );
    return;
  }

  await applyEffectToItems(ctx, action, id, targets, cue);
}

async function applyEffectToItems(
  ctx: CommandContext,
  action: "add" | "remove",
  id: string,
  targets: Array<{ id: string }>,
  cue: NonNullable<ReturnType<typeof requireCueContext>>,
): Promise<void> {
  const now = new Date().toISOString();
  const updates: Record<string, ItemAcquisition> = {};
  let changed = 0;
  let unchanged = 0;

  for (const item of targets) {
    const acq = cue.loadState.acquisition.items[item.id];
    if (!acq) continue;
    const result = mutateEffectsList(acq.effects ?? [], action, id);
    if (!result.changed) {
      unchanged += 1;
      continue;
    }
    changed += 1;
    updates[item.id] = {
      ...acq,
      effects: result.next,
      updated_at: now,
    };
  }

  if (changed === 0) {
    ctx.actions.pushLine(
      action === "add"
        ? `Already on stack: ${id} (${unchanged} cue${unchanged === 1 ? "" : "s"})`
        : `Not on stack: ${id} (${unchanged} cue${unchanged === 1 ? "" : "s"})`,
      "warn",
    );
    return;
  }

  const result =
    Object.keys(updates).length === 1
      ? await persistAcquisitionItem(
          ctx,
          Object.keys(updates)[0]!,
          Object.values(updates)[0]!,
        )
      : await persistAcquisitionItems(ctx, updates);

  if (!result.ok) {
    ctx.actions.pushLine(result.error, "error");
    return;
  }

  const scopeLabel =
    targets.length === 1 && targets[0]?.id === cue.currentItem.id
      ? formatCueLabel(cue.currentItem.id)
      : `${changed} cue${changed === 1 ? "" : "s"}`;

  const lines = [
    `Effect ${action === "add" ? "added" : "removed"}: ${id} → ${scopeLabel}`,
  ];
  if (unchanged > 0) {
    lines.push(`${unchanged} unchanged`);
  }
  if (targets.length === 1 && targets[0]?.id === cue.currentItem.id) {
    lines.push(formatEffects(updates[cue.currentItem.id] ?? cue.currentAcq));
  }

  ctx.actions.pushLine(lines.join("\n"), "success");
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

function defaultCommandTextGraphic(spoken: string): TextGraphic {
  return {
    type: "title",
    text: spoken,
    style: "typewriter",
  };
}

function textTargetKey(
  acq: ItemAcquisition,
): "text_graphic" | "text_graphic_layer" {
  return acq.resolved_visual_mode === "text_graphic"
    ? "text_graphic"
    : "text_graphic_layer";
}

function normalizeTextAnimation(value: string): string | null {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  const allowed = new Set([
    "typewriter",
    "word_reveal",
    "minimal",
    "stamp",
    "neon",
    "title",
    "blockbuster",
  ]);
  return allowed.has(normalized) ? normalized : null;
}

function normalizeTextSize(value: string): "sm" | "md" | "lg" | "xl" | "xxl" | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "small") return "sm";
  if (normalized === "medium") return "md";
  if (normalized === "large") return "lg";
  if (normalized === "extra-large") return "xl";
  if (normalized === "extra-extra-large" || normalized === "xx-large") return "xxl";
  if (
    normalized === "sm" ||
    normalized === "md" ||
    normalized === "lg" ||
    normalized === "xl" ||
    normalized === "xxl"
  ) {
    return normalized;
  }
  return null;
}

function parseTextStyle(style: string): {
  animation: string;
  size: "sm" | "md" | "lg" | "xl" | "xxl";
} {
  const tokens = style
    .split(/\s+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  const animation =
    tokens.find(
      (token) =>
        !token.startsWith("size-") &&
        token !== "sm" &&
        token !== "md" &&
        token !== "lg" &&
        token !== "xl" &&
        token !== "xxl",
    ) ?? "typewriter";
  const sizeToken =
    tokens.find((token) => token.startsWith("size-"))?.slice("size-".length) ??
    tokens.find(
      (token) =>
        token === "sm" ||
        token === "md" ||
        token === "lg" ||
        token === "xl" ||
        token === "xxl",
    ) ??
    "md";
  return {
    animation,
    size: normalizeTextSize(sizeToken) ?? "md",
  };
}

function composeTextStyle(
  animation: string,
  size: "sm" | "md" | "lg" | "xl" | "xxl",
): string {
  return size === "md" ? animation : `${animation} size-${size}`;
}

function normalizeStickerPosition(
  value: string,
): ItemAcquisition["sticker_overlay_position"] | null {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  switch (normalized) {
    case "center":
    case "left":
    case "right":
    case "top":
    case "bottom":
    case "top_left":
    case "top_right":
    case "bottom_left":
    case "bottom_right":
      return normalized;
    default:
      return null;
  }
}

export async function handleGenerate(
  ctx: CommandContext,
  variant: "sticker" | "image",
  prompt: string,
): Promise<void> {
  const cue = requireCueContext(ctx);
  if (!cue) return;

  ctx.actions.setBusy(true);
  try {
    const endpoint =
      variant === "sticker" ? "/api/generate-sticker" : "/api/generate-photo";
    const body =
      variant === "sticker"
        ? {
            manifestPath: cue.loadState.manifestPath,
            itemId: cue.currentItem.id,
            prompt,
            variant: "sticker",
            autoSelect: true,
          }
        : {
            manifestPath: cue.loadState.manifestPath,
            itemId: cue.currentItem.id,
            prompt,
            autoSelect: true,
          };
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      error?: string;
      filename?: string;
    };
    if (!res.ok) throw new Error(data.error ?? "Generation failed");
    await ctx.actions.refreshAfterAcquiredChange();
    ctx.actions.pushLine(
      `Generated ${variant}: ${data.filename ?? prompt.slice(0, 64)}`,
      "success",
    );
  } catch (e) {
    ctx.actions.pushLine(
      e instanceof Error ? e.message : "Generation failed",
      "error",
    );
  } finally {
    ctx.actions.setBusy(false);
  }
}

export async function handleText(
  ctx: CommandContext,
  action: "add" | "animate" | "size" | "clear",
  value?: string,
): Promise<void> {
  const cue = requireCueContext(ctx);
  if (!cue) return;

  const target = textTargetKey(cue.currentAcq);
  const existing =
    cue.currentAcq[target] ?? defaultCommandTextGraphic(cue.currentItem.spoken);
  let next: TextGraphic | null = existing;

  if (action === "add") {
    next = { ...existing, text: value!.trim() };
  } else if (action === "animate") {
    const animation = normalizeTextAnimation(value ?? "");
    if (!animation) {
      ctx.actions.pushLine(
        "Unknown text animation. Try: typewriter, word_reveal, minimal, stamp, neon, title, blockbuster",
        "error",
      );
      return;
    }
    const { size } = parseTextStyle(existing.style);
    next = { ...existing, style: composeTextStyle(animation, size) };
  } else if (action === "size") {
    const size = normalizeTextSize(value ?? "");
    if (!size) {
      ctx.actions.pushLine("Unknown text size. Use sm, md, lg, xl, or xxl.", "error");
      return;
    }
    const { animation } = parseTextStyle(existing.style);
    next = { ...existing, style: composeTextStyle(animation, size) };
  } else if (action === "clear") {
    next = null;
  }

  const updated: ItemAcquisition = {
    ...cue.currentAcq,
    [target]: next,
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

  const targetLabel =
    target === "text_graphic" ? "full-cue text" : "text overlay";
  if (action === "clear") {
    ctx.actions.pushLine(`Cleared ${targetLabel}.`, "success");
    return;
  }
  if (!next) {
    ctx.actions.pushLine(`Updated ${targetLabel}.`, "success");
    return;
  }
  const { animation, size } = parseTextStyle(next.style);
  ctx.actions.pushLine(
    `${targetLabel} → "${next.text}" · ${animation} · ${size}`,
    "success",
  );
}

export async function handleSticker(
  ctx: CommandContext,
  action: "add" | "clear" | "place",
  value?: string,
): Promise<void> {
  const cue = requireCueContext(ctx);
  if (!cue) return;

  if (action === "add") {
    const index = Number.parseInt(value ?? "", 10);
    if (!Number.isFinite(index) || index < 1) {
      ctx.actions.pushLine("Usage: @overlay add <gallery-index>", "error");
      return;
    }
    await handleAddOverlay(ctx, index);
    return;
  }

  let updated: ItemAcquisition;
  if (action === "clear") {
    updated = withoutStickerSelections({
      ...cue.currentAcq,
      updated_at: new Date().toISOString(),
    });
  } else {
    const position = normalizeStickerPosition(value ?? "");
    if (!position) {
      ctx.actions.pushLine(
        "Unknown sticker position. Use center, left, right, top, bottom, top_left, top_right, bottom_left, or bottom_right.",
        "error",
      );
      return;
    }
    updated = {
      ...cue.currentAcq,
      sticker_overlay_position: position,
      updated_at: new Date().toISOString(),
    };
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
    action === "clear"
      ? "Cleared sticker/GIF overlay selection."
      : `Sticker position → ${updated.sticker_overlay_position ?? "center"}`,
    "success",
  );
}

async function handleAddOverlay(ctx: CommandContext, index: number): Promise<void> {
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
        `Overlay [${index}] ${data.filename} (GIF sticker)`,
        "success",
      );
    } else if (gallery.source === "library") {
      const libraryId = result.id.startsWith("library-")
        ? result.id.slice("library-".length)
        : result.id.replace(/^library:/, "");
      if (mediaKindFromUrl(result.url) === "video") {
        throw new Error("Video results are not supported on the overlay layer.");
      }
      const res = await fetch("/api/library/stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manifestPath: cue.loadState.manifestPath,
          itemId: cue.currentItem.id,
          libraryId,
          selected: true,
          searchQuery: gallery.query,
          role: "sticker",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Overlay stage failed");
      ctx.actions.pushLine(
        `Overlay [${index}] ${result.title} from library`,
        "success",
      );
    } else {
      if (gallery.source === "video" || mediaKindFromUrl(result.url) === "video") {
        throw new Error("Video results are not supported on the overlay layer.");
      }
      const downloadRes = await fetch("/api/download", {
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
            gallery.source === "google"
              ? "google_images"
              : gallery.source === "bing"
                ? "bing_images"
                : "overlay_add",
          queryIndex: 0,
          syncAcquisition: false,
        }),
      });
      const downloadData = await downloadRes.json();
      if (!downloadRes.ok) {
        throw new Error(downloadData.error ?? "Download failed");
      }
      const libraryId = downloadData.libraryId as string | undefined;
      if (!libraryId) {
        throw new Error("Downloaded overlay asset missing library id.");
      }
      const stageRes = await fetch("/api/library/stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manifestPath: cue.loadState.manifestPath,
          itemId: cue.currentItem.id,
          libraryId,
          selected: true,
          searchQuery: gallery.query,
          role: "sticker",
        }),
      });
      const stageData = await stageRes.json();
      if (!stageRes.ok) {
        throw new Error(stageData.error ?? "Overlay stage failed");
      }
      ctx.actions.pushLine(
        `Overlay [${index}] ${downloadData.filename ?? result.title}`,
        "success",
      );
    }
    await ctx.actions.refreshAfterAcquiredChange();
  } catch (e) {
    ctx.actions.pushLine(
      e instanceof Error ? e.message : "Overlay add failed",
      "error",
    );
  } finally {
    ctx.actions.setBusy(false);
  }
}

export async function handleRender(
  ctx: CommandContext,
  command: RenderCommand,
): Promise<void> {
  switch (command.action) {
    case "start":
      await handleRenderStart(ctx, command.from, command.to, command.quality);
      return;
    case "startAll":
      await handleRenderStartAll(ctx, command.quality);
      return;
    case "list":
      await handleRenderList(ctx, command.filter);
      return;
    case "load":
      await handleRenderLoad(ctx, command.ref);
      return;
    case "delete":
      await handleRenderDelete(ctx, command.filter, command.target);
      return;
  }
}

async function fetchRenderLibrary(
  manifestPath: string,
  filter: RenderListFilter,
): Promise<{ entries: RenderLibraryEntry[]; episodeNumber: string }> {
  const res = await fetch(
    `/api/render/library?path=${encodeURIComponent(manifestPath)}&filter=${encodeURIComponent(filter)}`,
  );
  const data = (await res.json()) as {
    error?: string;
    entries?: RenderLibraryEntry[];
    episodeNumber?: string;
  };
  if (!res.ok) throw new Error(data.error ?? "Failed to list renders");
  return {
    entries: data.entries ?? [],
    episodeNumber: data.episodeNumber ?? "000",
  };
}

async function handleRenderList(
  ctx: CommandContext,
  filter: RenderListFilter,
): Promise<void> {
  const { loadState } = ctx.state;
  if (!loadState) return;

  ctx.actions.setBusy(true);
  try {
    const { entries, episodeNumber } = await fetchRenderLibrary(
      loadState.manifestPath,
      filter,
    );
    ctx.actions.setRenderList(entries, filter);
    ctx.actions.pushLine(formatRenderList(entries, filter));
  } catch (e) {
    ctx.actions.pushLine(
      e instanceof Error ? e.message : "Failed to list renders",
      "error",
    );
  } finally {
    ctx.actions.setBusy(false);
  }
}

async function handleRenderLoad(
  ctx: CommandContext,
  ref: string,
): Promise<void> {
  const { loadState, renderListEntries, renderListFilter } = ctx.state;
  if (!loadState) return;

  ctx.actions.setBusy(true);
  try {
    let entries = renderListEntries;
    let filter = renderListFilter ?? "all";
    let episodeNumber = loadState.manifest.episode.match(/^(\d{3})_/)?.[1] ?? "000";

    if (!entries?.length) {
      const listed = await fetchRenderLibrary(loadState.manifestPath, "all");
      entries = listed.entries;
      episodeNumber = listed.episodeNumber;
      filter = "all";
    }

    const resolved = resolveRenderEntry(entries, ref);
    if ("error" in resolved) {
      ctx.actions.pushLine(resolved.error, "error");
      return;
    }

    const job = renderJobFromEntry(
      resolved.entry,
      loadState.manifestPath,
      loadState.manifest.episode,
      episodeNumber.padStart(3, "0"),
    );
    ctx.actions.setRenderJob(job);
    ctx.actions.setRenderList(entries, filter);
    ctx.actions.pushLine(
      `Loaded ${resolved.entry.title}.mp4 (${renderRangeLabel(job.from, job.to)}${job.preview ? " · preview" : " · full"})`,
      "success",
    );
  } catch (e) {
    ctx.actions.pushLine(
      e instanceof Error ? e.message : "Failed to load render",
      "error",
    );
  } finally {
    ctx.actions.setBusy(false);
  }
}

async function handleRenderDelete(
  ctx: CommandContext,
  filter: RenderListFilter,
  target: "all" | string,
): Promise<void> {
  const { loadState, renderListEntries, renderListFilter, renderJob } =
    ctx.state;
  if (!loadState) return;

  ctx.actions.setBusy(true);
  try {
    const listFilter = target === "all" ? filter : (renderListFilter ?? "all");
    let entries =
      renderListEntries ??
      (await fetchRenderLibrary(loadState.manifestPath, listFilter)).entries;

    if (target !== "all") {
      if (
        !renderListEntries?.length ||
        (renderListFilter && renderListFilter !== listFilter)
      ) {
        entries = (
          await fetchRenderLibrary(loadState.manifestPath, "all")
        ).entries;
      }
      const resolved = resolveRenderEntry(entries, target);
      if ("error" in resolved) {
        ctx.actions.pushLine(resolved.error, "error");
        return;
      }
      entries = [resolved.entry];
    } else if (filter !== "all") {
      entries = (
        await fetchRenderLibrary(loadState.manifestPath, filter)
      ).entries;
    } else if (!renderListEntries?.length) {
      entries = (
        await fetchRenderLibrary(loadState.manifestPath, "all")
      ).entries;
    }

    if (entries.length === 0) {
      ctx.actions.pushLine("Nothing to delete.", "warn");
      return;
    }

    const res = await fetch("/api/render/library", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        manifestPath: loadState.manifestPath,
        filter: listFilter,
        keys: entries.map((entry) => entry.key),
      }),
    });
    const data = (await res.json()) as { error?: string; deleted?: number };
    if (!res.ok) throw new Error(data.error ?? "Delete failed");

    const deletedKeys = new Set(entries.map((entry) => entry.key));
    if (
      renderJob?.id.startsWith("library:") &&
      deletedKeys.has(renderJob.id.slice("library:".length))
    ) {
      ctx.actions.setRenderJob(null);
    }

    const remaining = (renderListEntries ?? []).filter(
      (entry) => !deletedKeys.has(entry.key),
    );
    ctx.actions.setRenderList(
      remaining.length > 0 ? remaining : null,
      remaining.length > 0 ? renderListFilter : null,
    );

    ctx.actions.pushLine(
      `Deleted ${data.deleted ?? entries.length} render${(data.deleted ?? entries.length) === 1 ? "" : "s"}.`,
      "success",
    );
  } catch (e) {
    ctx.actions.pushLine(
      e instanceof Error ? e.message : "Failed to delete render",
      "error",
    );
  } finally {
    ctx.actions.setBusy(false);
  }
}

async function handleRenderStart(
  ctx: CommandContext,
  from: string,
  to: string,
  quality: "preview" | "full",
): Promise<void> {
  const { loadState, isDirty } = ctx.state;
  if (!loadState) return;

  if (isDirty) {
    ctx.actions.pushLine("Unsaved changes — @save first.", "warn");
    return;
  }

  const manifestIds = new Set(
    loadState.manifest.items.map((i) => i.id.toLowerCase()),
  );
  for (const id of [from, to]) {
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
        from,
        to,
        quality,
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
        `Rendering ${renderRangeLabel(from, to)} (${quality === "preview" ? "preview · quarter-res" : "full"})…`,
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

async function handleRenderStartAll(
  ctx: CommandContext,
  quality: "preview" | "full",
): Promise<void> {
  const { loadState } = ctx.state;
  if (!loadState) return;

  const first = loadState.manifest.items[0]?.id;
  const last = loadState.manifest.items[loadState.manifest.items.length - 1]?.id;
  if (!first || !last) {
    ctx.actions.pushLine("Manifest has no cues to render.", "error");
    return;
  }

  await handleRenderStart(ctx, first, last, quality);
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
            gallery.source === "google"
              ? "google_images"
              : gallery.source === "bing"
                ? "bing_images"
                : "youtube",
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

export function handleHelpTopic(ctx: CommandContext, topic: HelpTopic): void {
  ctx.actions.pushLine(
    formatHelpTopic(topic, { gallerySize: ctx.state.gallerySize }),
  );
}

export function handleEpisodes(ctx: CommandContext): void {
  ctx.actions.pushLine(
    formatEpisodesList(ctx.state.episodes, ctx.state.loadState?.manifestPath),
  );
}
