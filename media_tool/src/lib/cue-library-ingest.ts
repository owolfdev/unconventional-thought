import {
  LIBRARY_ENGINE,
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
import { readJsonFile } from "@/lib/paths";
import type { ItemAcquisition, MediaToolItem, MediaToolManifest } from "@/lib/types";

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
  },
): ItemAcquisition | null {
  const meta = readAssetMeta(libraryId.trim());
  if (!meta) return null;

  ensureItemFolder(slug, item, manifestPath);
  const acq = readJsonFile<ItemAcquisition>(
    itemAcquisitionPath(slug, item.id),
  );

  const publicUrl = libraryPublicUrl(meta.id, meta.filename);
  const selection = selectionForLibraryAsset(
    meta.id,
    meta.filename,
    publicUrl,
    opts.engineId ?? LIBRARY_ENGINE,
    opts.query ?? meta.filename,
    opts.license ?? meta.license,
    opts.title ?? meta.filename,
  );

  const updated =
    opts.selected !== false
      ? setCuePlateSelection(acq, selection, opts.queryIndex ?? 0)
      : updateAcquisitionSelection(
          acq,
          selection,
          false,
          opts.queryIndex ?? 0,
        );
  writeItemToFolder(slug, item, updated, manifestPath);
  return updated;
}

export { usageFromManifestItem };
