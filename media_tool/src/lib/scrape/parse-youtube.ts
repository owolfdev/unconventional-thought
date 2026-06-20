import { scrapeResultId } from "./ids";
import type { SearchResult } from "@/lib/types";

export interface YouTubeVideoHit {
  videoId: string;
  title: string;
}

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

export function parseYouTubeWatchHref(href: string): string | null {
  const match = href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  return match?.[1] ?? null;
}

/** Dedupe watch links into video hits (order preserved). */
export function mergeYouTubeHits(
  entries: Array<{ href: string; title: string }>,
): YouTubeVideoHit[] {
  const hits: YouTubeVideoHit[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const videoId = parseYouTubeWatchHref(entry.href);
    if (!videoId || !VIDEO_ID_RE.test(videoId) || seen.has(videoId)) continue;
    seen.add(videoId);
    hits.push({
      videoId,
      title: entry.title.trim() || videoId,
    });
  }

  return hits;
}

export function mapYouTubeHits(
  hits: YouTubeVideoHit[],
  limit: number,
): SearchResult[] {
  return hits.slice(0, limit).map((hit) => {
    const watchUrl = `https://www.youtube.com/watch?v=${hit.videoId}`;
    return {
      id: scrapeResultId("youtube", hit.videoId),
      title: hit.title,
      url: watchUrl,
      thumbnail_url: `https://i.ytimg.com/vi/${hit.videoId}/hqdefault.jpg`,
      source_page: watchUrl,
      license: "YouTube — verify rights before use",
      description: hit.videoId,
    };
  });
}
