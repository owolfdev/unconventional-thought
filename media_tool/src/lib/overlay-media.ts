import {
  GIPHY_STICKER_ENGINE,
  OPENAI_STICKER_ENGINE,
  OPENAI_TITLE_ENGINE,
} from "./acquisition-selection";
import { flattenSelections } from "./selection-media";
import type { ItemAcquisition, SelectedMedia } from "./types";

const STICKER_ENGINES = new Set([OPENAI_STICKER_ENGINE, GIPHY_STICKER_ENGINE]);
const STICKER_PREFIXES = ["sticker-", "giphy-"] as const;
const TITLE_PREFIX = "title-";

export function selectionFilename(sel: SelectedMedia): string | null {
  const local = sel.result_id.match(/^local-acquired:(.+)$/);
  if (local) return local[1];
  const url = sel.url || "";
  if (url.includes("/acquired/")) {
    return decodeURIComponent(url.split("/acquired/").pop()!.split("?")[0]);
  }
  if (url.includes("/media/_library/assets/")) {
    return decodeURIComponent(url.split("/").pop()!.split("?")[0] ?? "");
  }
  return null;
}

export function isStickerFilename(name: string): boolean {
  const lower = name.toLowerCase();
  return STICKER_PREFIXES.some((p) => lower.startsWith(p));
}

export function isTitleFilename(name: string): boolean {
  return name.toLowerCase().startsWith(TITLE_PREFIX);
}

export function isStickerOverlaySelection(sel: SelectedMedia): boolean {
  if (STICKER_ENGINES.has(sel.engine_id)) return true;
  const name = selectionFilename(sel);
  return name ? isStickerFilename(name) : false;
}

export function isTitleOverlaySelection(sel: SelectedMedia): boolean {
  if (sel.engine_id === OPENAI_TITLE_ENGINE) return true;
  const name = selectionFilename(sel);
  return name ? isTitleFilename(name) : false;
}

export function isAnyOverlaySelection(sel: SelectedMedia): boolean {
  return isStickerOverlaySelection(sel) || isTitleOverlaySelection(sel);
}

export function stickerOverlayEnabled(acq: ItemAcquisition): boolean {
  return acq.sticker_overlay_enabled !== false;
}

export function titleOverlayEnabled(acq: ItemAcquisition): boolean {
  return acq.title_overlay_enabled !== false;
}

/** First selected sticker/GIF overlay (matches Remotion pick order: OpenAI then GIPHY). */
export function getActiveStickerSelection(
  acq: ItemAcquisition,
): SelectedMedia | null {
  const flat = flattenSelections(acq);
  const openai = flat.find(
    (s) =>
      s.engine_id === OPENAI_STICKER_ENGINE ||
      (selectionFilename(s)?.toLowerCase().startsWith("sticker-") ?? false),
  );
  if (openai) return openai;
  return (
    flat.find(
      (s) =>
        s.engine_id === GIPHY_STICKER_ENGINE ||
        (selectionFilename(s)?.toLowerCase().startsWith("giphy-") ?? false),
    ) ?? null
  );
}

export function getActiveTitleSelection(
  acq: ItemAcquisition,
): SelectedMedia | null {
  return (
    flattenSelections(acq).find((s) => isTitleOverlaySelection(s)) ?? null
  );
}

export type CuePreviewModel = {
  platePlaylist: SelectedMedia[];
  sticker: SelectedMedia | null;
  title: SelectedMedia | null;
  showSticker: boolean;
  showTitle: boolean;
  hasPlate: boolean;
  hasContent: boolean;
};

export function buildCuePreviewModel(acq: ItemAcquisition): CuePreviewModel {
  const flat = flattenSelections(acq);
  const platePlaylist = flat.filter((s) => !isAnyOverlaySelection(s));

  const sticker = getActiveStickerSelection(acq);
  const title = getActiveTitleSelection(acq);
  const showSticker = Boolean(sticker) && stickerOverlayEnabled(acq);
  const showTitle = Boolean(title) && titleOverlayEnabled(acq);
  const hasPlate = platePlaylist.length > 0;
  const hasContent = hasPlate || showSticker || showTitle;

  return {
    platePlaylist,
    sticker,
    title,
    showSticker,
    showTitle,
    hasPlate,
    hasContent,
  };
}

/** Remove sticker/GIF overlay selections (keep title and plate). */
export function withoutStickerSelections(
  acq: ItemAcquisition,
): ItemAcquisition {
  return {
    ...acq,
    queries: acq.queries.map((q) => ({
      ...q,
      selections: q.selections.filter((s) => !isStickerOverlaySelection(s)),
    })),
    updated_at: new Date().toISOString(),
  };
}
