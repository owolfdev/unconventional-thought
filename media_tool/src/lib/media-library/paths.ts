import path from "path";

export const LIBRARY_SLUG = "_library";

export function getLibraryRoot(): string {
  return path.join(process.cwd(), "public", "media", LIBRARY_SLUG);
}

export function getLibraryAssetsRoot(): string {
  return path.join(getLibraryRoot(), "assets");
}

export function getLibraryIndexPath(): string {
  return path.join(getLibraryRoot(), "index.json");
}

export function getAssetDir(assetId: string): string {
  return path.join(getLibraryAssetsRoot(), assetId);
}

export function getAssetMetaPath(assetId: string): string {
  return path.join(getAssetDir(assetId), "meta.json");
}

export function libraryPublicUrl(assetId: string, filename: string): string {
  return `/media/${LIBRARY_SLUG}/assets/${assetId}/${encodeURIComponent(filename)}`;
}
