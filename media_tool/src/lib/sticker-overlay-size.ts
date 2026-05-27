import type { ItemAcquisition } from "./types";

export const STICKER_OVERLAY_SIZES = ["small", "medium", "large"] as const;
export type StickerOverlaySize = (typeof STICKER_OVERLAY_SIZES)[number];

/** Sticker/GIF height vs video frame (percent); width follows aspect ratio. Large = 90% frame height. */
export const STICKER_SIZE_PERCENT: Record<StickerOverlaySize, number> = {
  small: 40,
  medium: 62,
  large: 90,
};

export const STICKER_SIZE_LABELS: Record<StickerOverlaySize, string> = {
  small: "Small (40% frame height)",
  medium: "Medium (62% frame height)",
  large: "Large (90% frame height)",
};

export function normalizeStickerOverlaySize(value: unknown): StickerOverlaySize {
  if (
    typeof value === "string" &&
    STICKER_OVERLAY_SIZES.includes(value as StickerOverlaySize)
  ) {
    return value as StickerOverlaySize;
  }
  return "medium";
}

export function stickerMaxPercent(acq: ItemAcquisition): number {
  return STICKER_SIZE_PERCENT[normalizeStickerOverlaySize(acq.sticker_overlay_size)];
}
