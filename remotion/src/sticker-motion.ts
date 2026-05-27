import type { CSSProperties } from "react";
import { getMotionStyle } from "./motion-effects";

const STICKER_MOTION_IDS = new Set(["shake", "tremble"]);

/** Shake / tremble on sticker layer only (not plate zoom, tilt, scroll). */
export function getStickerMotionStyle(
  effects: string[] | undefined,
  frame: number,
  durationInFrames: number,
): CSSProperties {
  if (!effects?.length) return {};
  const stickerFx = effects.filter((id) => STICKER_MOTION_IDS.has(id));
  if (!stickerFx.length) return {};
  const { transform } = getMotionStyle(stickerFx, frame, durationInFrames);
  if (!transform) return {};
  return { transform, transformOrigin: "center center" };
}
