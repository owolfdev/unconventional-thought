import { interpolate } from "remotion";
import type { AcquisitionNoteHints } from "./acquisition-notes";

/** Normalize legacy / voicecut aliases to catalog effect ids. */
export function normalizeEffectId(id: string): string {
  const aliases: Record<string, string> = {
    push_in_slow: "slow_push_in",
    extreme_close_up_push: "slow_push_in",
    ken_burns_slow: "slow_zoom_in",
    ken_burns_corner: "slow_zoom_in",
    slow_zoom: "slow_zoom_in",
  };
  return aliases[id] ?? id;
}

export function normalizeEffects(effects: string[]): string[] {
  return effects.map(normalizeEffectId);
}

export type MotionStyle = {
  transform?: string;
  filter?: string;
};

export type MediaFitMode = "cover" | "contain" | "fill-height" | "fill-width";

/** Layout size (% of frame) so transforms move real pixels, not a pre-cropped tile. */
export type MediaLayoutScale = {
  widthPercent: number;
  heightPercent: number;
  fit: MediaFitMode;
};

export function getMediaFitMode(
  effects: string[],
  noteHints?: AcquisitionNoteHints | null,
  visualMode?: string,
): MediaFitMode {
  if (noteHints?.showFullImage || noteHints?.fullFrameSpin) {
    return "contain";
  }
  if (visualMode === "artifact") {
    return "contain";
  }
  const fx = normalizeEffects(effects);
  if (
    fx.includes("slow_spin") &&
    (fx.includes("slow_zoom_out") || !fx.includes("slow_push_in"))
  ) {
    return "contain";
  }
  // Scroll/tilt on documents & portraits — show full image, not a center crop.
  if (
    fx.includes("slow_scroll_up") &&
    !fx.includes("slow_push_in") &&
    !fx.includes("slow_zoom_in")
  ) {
    return "contain";
  }
  return "cover";
}

const MOTION_EFFECT_IDS = new Set([
  "slow_push_in",
  "slow_zoom_in",
  "slow_zoom_out",
  "slow_scroll_up",
  "slow_spin",
  "tilt_left",
  "tilt_right",
  "tremble",
  "shake",
]);

export function hasMotionEffects(
  effects: string[],
  noteHints?: AcquisitionNoteHints | null,
): boolean {
  if (noteHints?.fullFrameSpin) return true;
  return normalizeEffects(effects).some((id) => MOTION_EFFECT_IDS.has(id));
}

/**
 * Overscan before object-fit cover — outer frame only clips; image stays larger.
 */
export function getMediaLayoutScale(
  effects: string[],
  noteHints?: AcquisitionNoteHints | null,
  visualMode?: string,
  fitOverride?: "cover" | "contain" | "fill-height" | "fill-width",
): MediaLayoutScale {
  const fit = fitOverride ?? getMediaFitMode(effects, noteHints, visualMode);
  if (fit === "contain") {
    return { widthPercent: 100, heightPercent: 100, fit: "contain" };
  }
  if (fit === "fill-height") {
    return { widthPercent: 0, heightPercent: 100, fit: "fill-height" };
  }
  if (fit === "fill-width") {
    return { widthPercent: 100, heightPercent: 0, fit: "fill-width" };
  }

  const fx = normalizeEffects(effects);
  let w = 100;
  let h = 100;

  if (fx.includes("slow_push_in")) {
    w = Math.max(w, 128);
    h = Math.max(h, 128);
  }
  if (fx.includes("slow_zoom_in")) {
    w = Math.max(w, 120);
    h = Math.max(h, 120);
  }
  if (fx.includes("slow_scroll_up")) {
    h = Math.max(h, 125);
    w = Math.max(w, 110);
  }
  if (
    fx.includes("slow_spin") ||
    fx.includes("tilt_left") ||
    fx.includes("tilt_right")
  ) {
    w = Math.max(w, 112);
    h = Math.max(h, 112);
  }
  if (fx.includes("slow_zoom_out")) {
    w = Math.max(w, 112);
    h = Math.max(h, 112);
  }
  if (fx.includes("tremble") || fx.includes("shake")) {
    w = Math.max(w, 108);
    h = Math.max(h, 108);
  }

  // Any motion on a cover shot needs headroom so transforms move real pixels.
  if (w === 100 && h === 100 && hasMotionEffects(effects, noteHints)) {
    w = 110;
    h = 110;
  }

  return { widthPercent: w, heightPercent: h, fit: "cover" };
}

/**
 * CSS motion for stills, video, and typography.
 * Matches voicecut / media_tool effect ids (slow_push_in, slow_scroll_up, tremble, …).
 */
export type MotionStyleOverrides = {
  tiltDeg?: number;
  /** Multiplier on slow_scroll_up range (1 = default ±10%). */
  scrollSpeed?: number;
};

export function getMotionStyle(
  effects: string[],
  frame: number,
  durationInFrames: number,
  noteHints?: AcquisitionNoteHints | null,
  motionOverrides?: MotionStyleOverrides | null,
): MotionStyle {
  const fx = normalizeEffects(effects);
  const duration = Math.max(durationInFrames, 1);
  const progress = frame / duration;
  const transforms: string[] = [];
  let filter = "";

  if (noteHints?.stillPlate) {
    return { transform: undefined, filter: undefined };
  }

  if (noteHints?.fullFrameSpin) {
    const deg = interpolate(progress, [0, 1], [0, 360], {
      extrapolateRight: "clamp",
    });
    const spinScale = noteHints.spinCoverScale ?? 1.414;
    transforms.push(`rotate(${deg}deg)`);
    transforms.push(`scale(${spinScale})`);
  } else if (fx.includes("slow_spin")) {
    const deg = interpolate(progress, [0, 1], [0, 12], {
      extrapolateRight: "clamp",
    });
    transforms.push(`rotate(${deg}deg)`);
  }

  if (fx.includes("slow_zoom_in")) {
    const scale = interpolate(progress, [0, 1], [1, 1.12], {
      extrapolateRight: "clamp",
    });
    transforms.push(`scale(${scale})`);
  }
  if (
    fx.includes("slow_zoom_out") &&
    !fx.includes("slow_push_in") &&
    !noteHints?.fullFrameSpin
  ) {
    const scale = interpolate(progress, [0, 1], [1.08, 1], {
      extrapolateRight: "clamp",
    });
    transforms.push(`scale(${scale})`);
  }
  if (fx.includes("slow_zoom_out") && noteHints?.fullFrameSpin) {
    const scale = interpolate(progress, [0, 1], [1.06, 1], {
      extrapolateRight: "clamp",
    });
    transforms.push(`scale(${scale})`);
  }
  if (fx.includes("slow_push_in")) {
    const scale = interpolate(progress, [0, 1], [1, 1.2], {
      extrapolateRight: "clamp",
    });
    transforms.push(`scale(${scale})`);
  }
  if (fx.includes("slow_scroll_up")) {
    const scrollMul = Math.max(0.15, motionOverrides?.scrollSpeed ?? 1);
    const travel = 10 * scrollMul;
    const y = interpolate(progress, [0, 1], [travel, -travel], {
      extrapolateRight: "clamp",
    });
    transforms.push(`translateY(${y}%)`);
  }
  if (fx.includes("tilt_left") || fx.includes("tilt_right")) {
    const tiltDeg =
      motionOverrides?.tiltDeg ??
      (fx.includes("tilt_left") ? -2.5 : 2.5);
    transforms.push(`rotate(${tiltDeg}deg)`);
  }
  if (fx.includes("tremble")) {
    const x =
      Math.sin(frame * 0.85) * 2.2 + Math.sin(frame * 1.47) * 1.4;
    const y =
      Math.cos(frame * 0.92) * 1.8 + Math.sin(frame * 1.21) * 1.2;
    const r = Math.sin(frame * 1.05) * 0.35;
    transforms.push(`translate(${x}px, ${y}px) rotate(${r}deg)`);
  }
  if (fx.includes("shake")) {
    const x =
      Math.sin(frame * 1.4) * 6 + Math.sin(frame * 2.1) * 4;
    const y = Math.cos(frame * 1.55) * 5;
    transforms.push(`translate(${x}px, ${y}px)`);
  }
  if (fx.includes("desaturate_soft")) {
    filter += " saturate(0.35)";
  }
  if (fx.includes("vignette_soft") || fx.includes("vignette_heavy")) {
    filter += " contrast(1.05) brightness(0.92)";
  }

  return {
    transform: transforms.length ? transforms.join(" ") : undefined,
    filter: filter.trim() || undefined,
  };
}
