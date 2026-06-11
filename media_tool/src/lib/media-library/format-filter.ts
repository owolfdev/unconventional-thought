import type { LibraryIndexEntry } from "./types";

export type LibraryFormatFilter =
  | "all"
  | "photo"
  | "video"
  | "gif"
  | "jpg"
  | "png"
  | "webp"
  | "mp4"
  | "mov"
  | "webm";

export const LIBRARY_FORMAT_FILTER_OPTIONS: {
  value: LibraryFormatFilter;
  label: string;
}[] = [
  { value: "all", label: "All types" },
  { value: "photo", label: "Photos" },
  { value: "video", label: "Videos" },
  { value: "gif", label: "GIF" },
  { value: "jpg", label: "JPG" },
  { value: "png", label: "PNG" },
  { value: "webp", label: "WebP" },
  { value: "mp4", label: "MP4" },
  { value: "mov", label: "MOV" },
  { value: "webm", label: "WebM" },
];

function fileExtension(filename: string): string {
  const match = filename.match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : "";
}

export function parseLibraryFormatFilter(
  raw: string | null | undefined,
): LibraryFormatFilter {
  const value = raw?.trim().toLowerCase();
  if (!value || value === "all") return "all";
  if (LIBRARY_FORMAT_FILTER_OPTIONS.some((opt) => opt.value === value)) {
    return value as LibraryFormatFilter;
  }
  return "all";
}

export function matchesLibraryFormatFilter(
  entry: LibraryIndexEntry,
  filter: LibraryFormatFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "photo") return entry.media_type === "photo";
  if (filter === "video") return entry.media_type === "video";

  const ext = fileExtension(entry.filename);
  if (filter === "jpg") return ext === "jpg" || ext === "jpeg";
  return ext === filter;
}
