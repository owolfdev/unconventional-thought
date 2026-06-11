import type { ItemAcquisition, QueryAcquisition, SelectedMedia } from "./types";

export const OPENAI_STICKER_ENGINE = "openai_sticker";
export const OPENAI_TITLE_ENGINE = "openai_title";
export const OPENAI_PHOTO_ENGINE = "openai_photo";
export const GIPHY_STICKER_ENGINE = "giphy_sticker";
export const LIBRARY_ENGINE = "library";

export function localResultId(filename: string): string {
  return `local-acquired:${filename}`;
}

export function libraryResultId(assetId: string): string {
  return `library:${assetId}`;
}

export function acquiredPublicUrl(
  project: string,
  itemId: string,
  filename: string,
): string {
  return `/media/${project}/${itemId}/acquired/${encodeURIComponent(filename)}`;
}

export function selectionForLibraryAsset(
  assetId: string,
  filename: string,
  publicUrl: string,
  engineId: string,
  query: string,
  license: string,
  title?: string,
): SelectedMedia {
  return {
    result_id: libraryResultId(assetId),
    url: publicUrl,
    thumbnail_url: publicUrl,
    title: title ?? filename,
    source_page: publicUrl,
    license,
    engine_id: engineId,
    query,
    selected_at: new Date().toISOString(),
  };
}

function fallbackQuery(): QueryAcquisition {
  return {
    query_index: 0,
    query: "Local acquired files",
    engine_id: "commons",
    engine_url: "https://commons.wikimedia.org/w/index.php?search={query}",
    selections: [],
  };
}

export function engineIdForAcquiredFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.startsWith("sticker-")) return OPENAI_STICKER_ENGINE;
  if (lower.startsWith("giphy-")) return GIPHY_STICKER_ENGINE;
  if (lower.startsWith("title-")) return OPENAI_TITLE_ENGINE;
  return "local_acquired";
}

/** Overlay engine for library filenames, or null when not a sticker/title overlay. */
export function overlayEngineIdForFilename(filename: string): string | null {
  const engine = engineIdForAcquiredFilename(filename);
  return engine === "local_acquired" ? null : engine;
}

export function selectionForAcquiredFile(
  project: string,
  itemId: string,
  filename: string,
  engineId: string,
  query: string,
  license: string,
): SelectedMedia {
  const href = acquiredPublicUrl(project, itemId, filename);
  return {
    result_id: localResultId(filename),
    url: href,
    thumbnail_url: href,
    title: filename,
    source_page: href,
    license,
    engine_id: engineId,
    query,
    selected_at: new Date().toISOString(),
  };
}

function isOverlaySelection(s: SelectedMedia): boolean {
  if (
    s.engine_id === OPENAI_STICKER_ENGINE ||
    s.engine_id === GIPHY_STICKER_ENGINE ||
    s.engine_id === OPENAI_TITLE_ENGINE
  ) {
    return true;
  }
  const name =
    s.result_id.match(/^local-acquired:(.+)$/)?.[1] ??
    s.url.split("/").pop()?.split("?")[0] ??
    "";
  const lower = name.toLowerCase();
  return (
    lower.startsWith("sticker-") ||
    lower.startsWith("giphy-") ||
    lower.startsWith("title-")
  );
}

/** Set the single plate (background) image; keeps sticker/title overlay selections. */
export function setCuePlateSelection(
  acquisition: ItemAcquisition,
  selection: SelectedMedia,
  queryIndex = 0,
): ItemAcquisition {
  const queries =
    acquisition.queries.length > 0
      ? acquisition.queries
      : [fallbackQuery()];
  const qi = Math.max(0, Math.min(queryIndex, queries.length - 1));

  const stripped = queries.map((q) => ({
    ...q,
    selections: q.selections.filter((s) => isOverlaySelection(s)),
  }));

  stripped[qi] = {
    ...stripped[qi],
    selections: [...stripped[qi].selections, selection],
  };

  return {
    ...acquisition,
    queries: stripped,
    status:
      acquisition.status === "pending" ? "in_progress" : acquisition.status,
    updated_at: new Date().toISOString(),
  };
}

/** Add or remove a selection on a query block (default: first). */
export function updateAcquisitionSelection(
  acquisition: ItemAcquisition,
  selection: SelectedMedia,
  selected: boolean,
  queryIndex = 0,
): ItemAcquisition {
  const queries =
    acquisition.queries.length > 0
      ? acquisition.queries
      : [fallbackQuery()];

  const withoutSelection = queries.map((query) => ({
    ...query,
    selections: query.selections.filter(
      (item) =>
        item.result_id !== selection.result_id && item.url !== selection.url,
    ),
  }));

  if (selected) {
    const qi = Math.max(0, Math.min(queryIndex, withoutSelection.length - 1));
    withoutSelection[qi] = {
      ...withoutSelection[qi],
      selections: [...withoutSelection[qi].selections, selection],
    };
  }

  return {
    ...acquisition,
    queries: withoutSelection,
    status:
      selected && acquisition.status === "pending"
        ? "in_progress"
        : acquisition.status,
    updated_at: new Date().toISOString(),
  };
}
