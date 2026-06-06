import fs from "fs";
import path from "path";
import { writeJsonFile } from "@/lib/paths";
import { buildSearchText, ensureLibraryDirs, mediaTypeFromFilename } from "./helpers";
import { getAssetMetaPath } from "./paths";
import { readAssetMeta, rebuildLibraryIndex } from "./ingest";
import { canCropLibraryAsset } from "./crop-shared";
import type { LibraryAssetMeta } from "./types";

/** Overwrite the asset file in place (same id + library refs stay valid). Server only. */
export function replaceLibraryAssetImage(
  assetId: string,
  data: Buffer,
): LibraryAssetMeta {
  const meta = readAssetMeta(assetId);
  if (!meta) throw new Error(`Unknown library asset: ${assetId}`);
  if (!canCropLibraryAsset(meta)) {
    throw new Error("This asset type cannot be cropped");
  }

  const dir = ensureLibraryDirs(assetId);
  const filePath = path.join(dir, meta.filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found on disk: ${meta.filename}`);
  }

  fs.writeFileSync(filePath, data);
  meta.media_type = mediaTypeFromFilename(meta.filename);
  meta.updated_at = new Date().toISOString();
  meta.search_text = buildSearchText(meta);
  writeJsonFile(getAssetMetaPath(assetId), meta);
  rebuildLibraryIndex();
  return meta;
}
