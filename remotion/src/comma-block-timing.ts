/** Resolve active comma-block index from VO-aligned frame offsets. */
export function activeCommaBlockIndex(
  frame: number,
  startFrames: number[],
): number {
  let index = 0;
  for (let i = 0; i < startFrames.length; i++) {
    if (frame >= startFrames[i]) index = i;
  }
  return index;
}

export function localBlockFrame(
  frame: number,
  blockIndex: number,
  startFrames: number[],
  durationInFrames: number,
): number {
  const blockStart = startFrames[blockIndex] ?? 0;
  const blockEnd =
    blockIndex < startFrames.length - 1
      ? startFrames[blockIndex + 1]
      : durationInFrames;
  return Math.max(0, frame - blockStart);
}

export function blockDurationFrames(
  blockIndex: number,
  startFrames: number[],
  durationInFrames: number,
): number {
  const blockStart = startFrames[blockIndex] ?? 0;
  const blockEnd =
    blockIndex < startFrames.length - 1
      ? startFrames[blockIndex + 1]
      : durationInFrames;
  return Math.max(1, blockEnd - blockStart);
}
