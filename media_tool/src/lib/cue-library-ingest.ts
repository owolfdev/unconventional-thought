import {
  addCuePlateSelection,
  LIBRARY_ENGINE,
  overlayEngineIdForFilename,
  selectionForLibraryAsset,
  setCuePlateSelection,
  updateAcquisitionSelection,
} from "@/lib/acquisition-selection";
import {
  ensureItemFolder,
  itemAcquisitionPath,
  writeItemToFolder,
} from "@/lib/media-folders";
import type { IngestContext, IngestResult } from "@/lib/media-library";
import { readAssetMeta, usageFromManifestItem } from "@/lib/media-library";
import { libraryPublicUrl } from "@/lib/media-library/paths";
import {
  isStickerFilename,
  isTitleFilename,
  withoutStickerSelections,
  withoutTitleSelections,
} from "@/lib/overlay-media";
import { isLibraryPlateKind } from "@/lib/media-library/plate-kind";
import { readJsonFile } from "@/lib/paths";
import type { ItemAcquisition, MediaToolItem, MediaToolManifest } from "@/lib/types";

/** How a library asset attaches to a cue. */
export type LibraryCueRole = "plate" | "sticker" | "title";

/** Replace all plates, or append to the cue plate playlist. */
export type PlateSelectionMode = "replace" | "add";

function resolveLibraryCueRole(
  meta: { kind: string; filename: string },
  role?: LibraryCueRole,
): LibraryCueRole {
  if (role) return role;
  if (isLibraryPlateKind(meta.kind)) return "plate";
  if (isTitleFilename(meta.filename)) return "title";
  if (meta.kind === "overlay" || isStickerFilename(meta.filename)) return "sticker";
  return "plate";
}

function applyLibrarySelection(
  acq: ItemAcquisition,
  selection: ReturnType<typeof selectionForLibraryAsset>,
  role: LibraryCueRole,
  queryIndex: number,
  selected: boolean,
  plateMode: PlateSelectionMode = "replace",
): ItemAcquisition {
  if (role === "plate") {
    if (!selected) {
      return updateAcquisitionSelection(acq, selection, false, queryIndex);
    }
    return plateMode === "add"
      ? addCuePlateSelection(acq, selection, queryIndex)
      : setCuePlateSelection(acq, selection, queryIndex);
  }
  if (role === "sticker") {
    const base = selected ? withoutStickerSelections(acq) : acq;
    return updateAcquisitionSelection(base, selection, selected, queryIndex);
  }
  const base = selected ? withoutTitleSelections(acq) : acq;
  return updateAcquisitionSelection(base, selection, selected, queryIndex);
}

export function ingestContextFromCue(
  manifest: MediaToolManifest,
  item: MediaToolItem,
  extras?: Partial<IngestContext>,
): IngestContext {
  return {
    episode_id: manifest.episode,
    cue_id: item.id,
    spoken: item.spoken,
    search_queries: item.search_queries,
    people: item.people,
    situation: item.situation,
    editorial_intent: item.editorial_intent,
    ...extras,
  };
}

export function applyLibrarySelectionToCue(
  slug: string,
  item: MediaToolItem,
  manifestPath: string,
  ingest: IngestResult,
  opts: {
    engineId?: string;
    query: string;
    license: string;
    title?: string;
    queryIndex?: number;
  },
): boolean {
  ensureItemFolder(slug, item, manifestPath);

  const acq = readJsonFile<ItemAcquisition>(
    itemAcquisitionPath(slug, item.id),
  );
  const selection = selectionForLibraryAsset(
    ingest.id,
    ingest.filename,
    ingest.publicUrl,
    opts.engineId ?? LIBRARY_ENGINE,
    opts.query,
    opts.license,
    opts.title ?? ingest.filename,
  );
  const updated = setCuePlateSelection(
    acq,
    selection,
    opts.queryIndex ?? 0,
  );
  writeItemToFolder(slug, item, updated, manifestPath);
  return true;
}

export function stageLibraryAssetOnCue(
  slug: string,
  item: MediaToolItem,
  manifestPath: string,
  libraryId: string,
  opts: {
    engineId?: string;
    query?: string;
    license?: string;
    title?: string;
    queryIndex?: number;
    selected?: boolean;
    role?: LibraryCueRole;
    plateMode?: PlateSelectionMode;
  },
): ItemAcquisition | null {
  const meta = readAssetMeta(libraryId.trim());
  if (!meta) return null;

  ensureItemFolder(slug, item, manifestPath);
  const acq = readJsonFile<ItemAcquisition>(
    itemAcquisitionPath(slug, item.id),
  );

  const role = resolveLibraryCueRole(meta, opts.role);
  const overlayEngine = overlayEngineIdForFilename(meta.filename);
  const engineId =
    opts.engineId ??
    (role === "plate" ? LIBRARY_ENGINE : overlayEngine ?? LIBRARY_ENGINE);

  const publicUrl = libraryPublicUrl(meta.id, meta.filename);
  const selection = selectionForLibraryAsset(
    meta.id,
    meta.filename,
    publicUrl,
    engineId,
    opts.query ?? meta.filename,
    opts.license ?? meta.license,
    opts.title ?? meta.filename,
  );

  const queryIndex = opts.queryIndex ?? 0;
  const selected = opts.selected !== false;
  const updated = applyLibrarySelection(
    acq,
    selection,
    role,
    queryIndex,
    selected,
    opts.plateMode ?? "replace",
  );
  writeItemToFolder(slug, item, updated, manifestPath);
  return updated;
}

export { usageFromManifestItem };
