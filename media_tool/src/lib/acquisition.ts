import type {
  ItemAcquisition,
  MediaAcquisitionDocument,
  MediaToolItem,
  MediaToolManifest,
  QueryAcquisition,
  ResolvedMediaType,
} from "./types";
import { getEngine, buildSearchUrl } from "./search-engines";
import { normalizeBackgroundColor } from "./background-color";
import { normalizeStickerOverlaySize } from "./sticker-overlay-size";
import {
  normalizeAcquisitionDocument,
  normalizeItemAcquisition,
  normalizeVisualMode,
  type VisualMode,
} from "./visual-modes";

function defaultMediaType(item: MediaToolItem): ResolvedMediaType {
  if (item.visual_mode === "text_graphic") return "generated";
  if (item.media_type === "video") return "video";
  return "photo";
}

function defaultQueries(item: MediaToolItem): QueryAcquisition[] {
  const queries =
    item.search_queries.length > 0
      ? item.search_queries
      : item.visual_mode === "text_graphic"
        ? ["(text graphic — no archive search)"]
        : [item.situation || item.editorial_intent.slice(0, 80)];

  const mode = normalizeVisualMode(item.visual_mode);
  const engine = getEngine(
    mode === "text_graphic"
      ? "google"
      : mode === "stock"
        ? "openverse"
        : "commons",
  );

  return queries.map((query, query_index) => ({
    query_index,
    query,
    engine_id: engine.id,
    engine_url: engine.urlTemplate,
    selections: [],
  }));
}

export function itemAcquisitionFromManifest(
  item: MediaToolItem,
  existing?: ItemAcquisition,
): ItemAcquisition {
  const now = new Date().toISOString();
  const source_visual_mode = normalizeVisualMode(item.visual_mode);
  const resolved_visual_mode: VisualMode = existing?.resolved_visual_mode
    ? normalizeVisualMode(existing.resolved_visual_mode)
    : source_visual_mode;

  const base = {
    id: item.id,
    cue: item.cue,
    source_visual_mode,
    resolved_visual_mode,
    resolved_media_type:
      existing?.resolved_media_type ?? defaultMediaType(item),
    status:
      existing?.status ??
      (item.visual_mode === "text_graphic" ? "text_graphic" : "pending"),
    notes: existing?.notes ?? "",
    effects: existing?.effects ?? [],
    transition: existing?.transition ?? null,
    text_graphic: existing?.text_graphic ?? item.text_graphic,
    text_graphic_layer: existing?.text_graphic_layer ?? null,
    background_color: normalizeBackgroundColor(existing?.background_color),
    sticker_overlay_enabled: existing?.sticker_overlay_enabled !== false,
    sticker_overlay_size: normalizeStickerOverlaySize(
      existing?.sticker_overlay_size,
    ),
    title_overlay_enabled: existing?.title_overlay_enabled !== false,
    queries: existing?.queries ?? defaultQueries(item),
    completed_at: existing?.completed_at ?? null,
    updated_at: existing?.updated_at ?? now,
  };

  return normalizeItemAcquisition(base);
}

export function mergeAcquisition(
  manifest: MediaToolManifest,
  existing: MediaAcquisitionDocument | null,
  sourceManifestRel: string,
): MediaAcquisitionDocument {
  const now = new Date().toISOString();
  const items: Record<string, ItemAcquisition> = {};

  for (const manifestItem of manifest.items) {
    items[manifestItem.id] = itemAcquisitionFromManifest(
      manifestItem,
      existing?.items[manifestItem.id],
    );
  }

  const completed_count = Object.values(items).filter(
    (i) => i.status === "complete" || i.status === "text_graphic",
  ).length;

  return normalizeAcquisitionDocument({
    version: 1,
    source_manifest: sourceManifestRel,
    episode: manifest.episode,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    item_count: manifest.items.length,
    completed_count,
    items,
  });
}

export function countCompleted(doc: MediaAcquisitionDocument): number {
  return Object.values(doc.items).filter(
    (i) => i.status === "complete" || i.status === "text_graphic",
  ).length;
}

/** Done for review workflow (complete cue or typography-only). */
export function isAcquisitionItemComplete(
  status: ItemAcquisition["status"],
): boolean {
  return status === "complete" || status === "text_graphic";
}

/** Still needs review / media work (pending, in_progress, skipped, …). */
export function isAcquisitionItemIncomplete(
  acq: ItemAcquisition | undefined,
): boolean {
  if (!acq) return true;
  return !isAcquisitionItemComplete(acq.status);
}

/**
 * Next/previous manifest index whose acquisition is incomplete.
 * Returns null if none in that direction.
 */
export function findIncompleteItemIndex(
  itemIds: readonly { id: string }[],
  itemsById: Record<string, ItemAcquisition>,
  fromIndex: number,
  direction: 1 | -1,
): number | null {
  if (direction > 0) {
    for (let i = fromIndex + 1; i < itemIds.length; i++) {
      if (isAcquisitionItemIncomplete(itemsById[itemIds[i].id])) {
        return i;
      }
    }
    return null;
  }
  for (let i = fromIndex - 1; i >= 0; i--) {
    if (isAcquisitionItemIncomplete(itemsById[itemIds[i].id])) {
      return i;
    }
  }
  return null;
}

/** Rebuild engine URL fields when user changes engine template */
export function syncQueryEngineUrl(
  query: QueryAcquisition,
  engineId: string,
  customUrl?: string,
): QueryAcquisition {
  const engine = getEngine(engineId);
  const template = customUrl?.trim() || engine.urlTemplate;
  return {
    ...query,
    engine_id: engineId,
    engine_url: template,
  };
}

export function externalSearchUrl(query: QueryAcquisition): string {
  return buildSearchUrl(query.engine_url, query.query);
}
