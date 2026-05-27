/** True when a public/ media path should use frame-synced GIF playback. */
export function isGifSrc(src: string): boolean {
  return src.toLowerCase().endsWith(".gif");
}
