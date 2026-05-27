import type { ItemAcquisition, QueryAcquisition, SelectedMedia } from "./types";

export const OPENAI_STICKER_ENGINE = "openai_sticker";
export const OPENAI_TITLE_ENGINE = "openai_title";
export const GIPHY_STICKER_ENGINE = "giphy_sticker";

export function localResultId(filename: string): string {
  return `local-acquired:${filename}`;
}

export function acquiredPublicUrl(
  project: string,
  itemId: string,
  filename: string,
): string {
  return `/media/${project}/${itemId}/acquired/${encodeURIComponent(filename)}`;
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

/** Add or remove a selection on the first query block. */
export function updateAcquisitionSelection(
  acquisition: ItemAcquisition,
  selection: SelectedMedia,
  selected: boolean,
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
    withoutSelection[0] = {
      ...withoutSelection[0],
      selections: [...withoutSelection[0].selections, selection],
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
