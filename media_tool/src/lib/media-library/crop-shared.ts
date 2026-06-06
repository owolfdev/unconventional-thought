import type { LibraryAssetMeta } from "./types";

const NON_CROPPABLE_EXT = new Set([".gif", ".svg", ".bin"]);

function fileExt(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i).toLowerCase() : "";
}

export function canCropLibraryAsset(meta: LibraryAssetMeta): boolean {
  if (meta.media_type !== "photo") return false;
  return !NON_CROPPABLE_EXT.has(fileExt(meta.filename));
}

export function mimeForFilename(filename: string): string {
  switch (fileExt(filename)) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".png":
    default:
      return "image/png";
  }
}
