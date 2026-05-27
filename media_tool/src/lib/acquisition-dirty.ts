import { normalizeBackgroundColor } from "./background-color";
import { normalizeStickerOverlaySize } from "./sticker-overlay-size";
import type { ItemAcquisition } from "./types";

function withCompareDefaults(acq: ItemAcquisition): ItemAcquisition {
  return {
    ...acq,
    background_color: normalizeBackgroundColor(acq.background_color),
    text_graphic_layer: acq.text_graphic_layer ?? null,
    sticker_overlay_enabled: acq.sticker_overlay_enabled !== false,
    sticker_overlay_size: normalizeStickerOverlaySize(acq.sticker_overlay_size),
    title_overlay_enabled: acq.title_overlay_enabled !== false,
  };
}

/** Compare acquisition state ignoring `updated_at` (changes on every edit). */
export function stableAcquisitionKey(acq: ItemAcquisition): string {
  const { updated_at: _, ...rest } = withCompareDefaults(acq);
  return JSON.stringify(rest);
}

export function isItemAcquisitionDirty(
  current: ItemAcquisition | undefined,
  saved: ItemAcquisition | undefined,
): boolean {
  if (!current || !saved) return false;
  return stableAcquisitionKey(current) !== stableAcquisitionKey(saved);
}

export function cloneSavedItems(
  items: Record<string, ItemAcquisition>,
): Record<string, ItemAcquisition> {
  const cloned = JSON.parse(JSON.stringify(items)) as Record<
    string,
    ItemAcquisition
  >;
  for (const id of Object.keys(cloned)) {
    cloned[id] = withCompareDefaults(cloned[id]);
  }
  return cloned;
}
