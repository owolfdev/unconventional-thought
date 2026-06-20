import type { GiphyStickerHit } from "@/lib/giphy";
import type { SearchResult } from "@/lib/types";
import type { GallerySource, GalleryState } from "./types";

function giphyToResult(hit: GiphyStickerHit): SearchResult {
  return {
    id: `giphy-${hit.id}`,
    title: hit.title,
    url: hit.downloadUrl,
    thumbnail_url: hit.stillPreviewUrl,
    source_page: `https://giphy.com/gifs/${hit.id}`,
    license: "GIPHY — verify rights",
    description: hit.id,
  };
}

export async function runGallerySearch(
  engine: GallerySource,
  query: string,
): Promise<GalleryState> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("Search query is empty.");
  }

  if (engine === "library") {
    const res = await fetch(
      `/api/library/search?q=${encodeURIComponent(trimmed)}&limit=20`,
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Library search failed");
    return {
      source: "library",
      sourceLabel: "Repo library",
      query: trimmed,
      results: (data.results as SearchResult[]) ?? [],
    };
  }

  if (engine === "gif") {
    const res = await fetch(
      `/api/giphy/search?q=${encodeURIComponent(trimmed)}&limit=16`,
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "GIPHY search failed");
    const hits = (data.results as GiphyStickerHit[]) ?? [];
    return {
      source: "gif",
      sourceLabel: "GIPHY",
      query: trimmed,
      results: hits.map(giphyToResult),
      giphyHits: hits,
    };
  }

  const engineId = engine === "google" ? "google_images" : "youtube";
  const res = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ engineId, query: trimmed, limit: 20 }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Search failed");

  const label =
    (data.gallerySource as string) ??
    (engine === "google" ? "Google Images" : "YouTube");

  return {
    source: engine,
    sourceLabel: label,
    query: trimmed,
    results: (data.results as SearchResult[]) ?? [],
  };
}

export function gallerySummary(gallery: GalleryState): string {
  const n = gallery.results.length;
  if (n === 0) {
    return `${gallery.sourceLabel}: no results for "${gallery.query}".`;
  }
  return `${gallery.sourceLabel}: ${n} result${n === 1 ? "" : "s"} for "${gallery.query}". Use @add <n> to import.`;
}
