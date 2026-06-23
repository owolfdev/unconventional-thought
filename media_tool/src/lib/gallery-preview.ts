import type { GallerySource } from "@/lib/command/types";
import type { SearchResult } from "@/lib/types";

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|mkv)(\?|$)/i;

export type GalleryPreviewKind = "image" | "video" | "youtube";

export function parseYouTubeVideoId(url: string): string | null {
  const watch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watch) return watch[1];
  const short = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  return short?.[1] ?? null;
}

export function youtubeEmbedUrl(watchUrl: string, autoplay = true): string | null {
  const id = parseYouTubeVideoId(watchUrl);
  if (!id) return null;
  const params = autoplay ? "?autoplay=1&rel=0" : "?rel=0";
  return `https://www.youtube.com/embed/${id}${params}`;
}

export function galleryResultPreviewKind(
  result: SearchResult,
  source: GallerySource,
): GalleryPreviewKind {
  if (source === "video" || /youtube\.com|youtu\.be/i.test(result.url)) {
    return parseYouTubeVideoId(result.url) ? "youtube" : "video";
  }
  if (VIDEO_EXT.test(result.url.split("?")[0])) return "video";
  return "image";
}
