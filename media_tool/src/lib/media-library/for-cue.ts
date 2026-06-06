import fs from "fs";
import { readAssetMeta, readLibraryIndex } from "./ingest";
import { getAssetMetaPath } from "./paths";
import type { LibraryIndexEntry } from "./types";

/** Assets with a library usage record for this episode + cue (newest first). */
export function listLibraryAssetsForCue(
  episodeId: string,
  cueId: string,
  limit = 12,
): LibraryIndexEntry[] {
  const index = readLibraryIndex();
  const matches: LibraryIndexEntry[] = [];

  for (const entry of index.assets) {
    if (entry.archived) continue;
    const metaPath = getAssetMetaPath(entry.id);
    if (!fs.existsSync(metaPath)) continue;
    const meta = readAssetMeta(entry.id);
    if (!meta) continue;
    const usedHere = meta.usages.some(
      (u) => u.episode_id === episodeId && u.cue_id === cueId,
    );
    if (usedHere) matches.push(entry);
  }

  return matches
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, limit);
}
