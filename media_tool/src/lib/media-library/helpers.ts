import fs from "fs";
import path from "path";
import type { MediaToolItem } from "@/lib/types";
import type { IngestContext, LibraryUsage } from "./types";
export {
  buildSearchHaystack,
  buildSearchText,
  parseSearchFieldsParam,
  searchFieldsToParam,
} from "./search-fields";

export function usageFromManifestItem(
  item: MediaToolItem,
  episodeId: string,
  searchQueries?: string[],
): LibraryUsage {
  return {
    episode_id: episodeId,
    cue_id: item.id,
    spoken: item.spoken ?? "",
    search_queries:
      searchQueries ??
      item.search_queries ??
      (item.situation ? [item.situation] : []),
    people: item.people ?? [],
    situation: item.situation ?? "",
    editorial_intent: item.editorial_intent ?? "",
    attached_at: new Date().toISOString(),
  };
}

export function inferKindFromFilename(filename: string): IngestContext["kind"] {
  const lower = filename.toLowerCase();
  if (lower.startsWith("sticker-") || lower.startsWith("giphy-")) {
    return "overlay";
  }
  if (lower.startsWith("title-")) {
    return "overlay";
  }
  return "archive";
}

export function mediaTypeFromFilename(filename: string): "photo" | "video" {
  const ext = path.extname(filename).toLowerCase();
  if ([".mp4", ".mov", ".webm", ".m4v", ".mkv"].includes(ext)) {
    return "video";
  }
  return "photo";
}

export function usageKey(usage: LibraryUsage): string {
  return `${usage.episode_id}:${usage.cue_id}:${usage.attached_at}`;
}

export function appendUsage(
  usages: LibraryUsage[],
  next: LibraryUsage,
): LibraryUsage[] {
  const exists = usages.some(
    (u) => u.episode_id === next.episode_id && u.cue_id === next.cue_id,
  );
  if (exists) {
    return usages.map((u) =>
      u.episode_id === next.episode_id && u.cue_id === next.cue_id ? next : u,
    );
  }
  return [...usages, next];
}

export function ensureLibraryDirs(assetId: string): string {
  const dir = path.join(
    process.cwd(),
    "public",
    "media",
    "_library",
    "assets",
    assetId,
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
