import type { PlateFrame } from "./types";

/** Which plate in a multi-image cue is active at the current frame. */
export function activePlateIndex(
  frame: number,
  durationInFrames: number,
  mediaDelayFrames: number,
  plateCount: number,
): number {
  if (plateCount <= 1) return 0;
  const motionFrames = Math.max(1, durationInFrames - mediaDelayFrames);
  const motionFrame = Math.max(0, frame - mediaDelayFrames);
  const progress = motionFrame / motionFrames;
  return Math.min(Math.floor(progress * plateCount), plateCount - 1);
}

export function resolveActivePlate(
  shot: {
    plateSequence?: PlateFrame[];
    src: string | null;
    mediaKind: string;
  },
  index: number,
): PlateFrame | null {
  const seq = shot.plateSequence;
  if (seq && seq.length > 0) {
    return seq[Math.min(index, seq.length - 1)] ?? null;
  }
  if (shot.src && (shot.mediaKind === "image" || shot.mediaKind === "video")) {
    return { src: shot.src, mediaKind: shot.mediaKind };
  }
  return null;
}
