import type { ItemAcquisition, SelectedMedia } from "./types";

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|mkv)$/i;

export type SelectionMediaKind = "image" | "video" | "unknown";

export function mediaKindFromUrl(url: string): SelectionMediaKind {
  const path = url.split("?")[0].toLowerCase();
  if (IMAGE_EXT.test(path)) return "image";
  if (VIDEO_EXT.test(path)) return "video";
  return "unknown";
}

export function flattenSelections(acq: ItemAcquisition): SelectedMedia[] {
  const out: SelectedMedia[] = [];
  const seen = new Set<string>();
  for (const q of acq.queries) {
    for (const sel of q.selections) {
      const key = sel.result_id || sel.url;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(sel);
    }
  }
  return out;
}

export interface StagedSelection {
  selection: SelectedMedia;
  queryIndex: number;
}

/** All selections staged for this cue (deduped), with query row index. */
export function flattenStagedSelections(acq: ItemAcquisition): StagedSelection[] {
  const out: StagedSelection[] = [];
  const seen = new Set<string>();
  acq.queries.forEach((q, queryIndex) => {
    for (const sel of q.selections) {
      const key = sel.result_id || sel.url;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ selection: sel, queryIndex });
    }
  });
  return out;
}

/** Resolve browser URL for preview (library or legacy acquired path). */
export function resolveSelectionPreviewUrl(
  selection: SelectedMedia,
  project: string,
  itemId: string,
): string {
  const libraryMatch = selection.result_id.match(/^library:(.+)$/);
  if (libraryMatch && selection.url.startsWith("/media/_library/")) {
    return selection.url;
  }
  const localMatch = selection.result_id.match(/^local-acquired:(.+)$/);
  if (localMatch) {
    return `/media/${project}/${itemId}/acquired/${encodeURIComponent(localMatch[1])}`;
  }
  if (selection.url.startsWith("/media/")) {
    return selection.url;
  }
  if (selection.url.includes("/acquired/")) {
    return selection.url;
  }
  return selection.thumbnail_url || selection.url;
}

function selectionFromAcquiredFile(
  name: string,
  project: string,
  itemId: string,
): SelectedMedia {
  const url = `/media/${project}/${itemId}/acquired/${encodeURIComponent(name)}`;
  return {
    result_id: `local-acquired:${name}`,
    url,
    thumbnail_url: url,
    title: name,
    source_page: url,
    license: "local acquired file",
    engine_id: "local_acquired",
    query: "",
    selected_at: "",
  };
}

export function pickPrimarySelection(
  selections: SelectedMedia[],
  acquiredFiles: string[],
  project: string,
  itemId: string,
): SelectedMedia | null {
  if (selections.length > 0) {
    const library = selections.find((s) => s.result_id.startsWith("library:"));
    const local = selections.find(
      (s) =>
        s.result_id.startsWith("local-acquired:") ||
        s.url.includes("/acquired/"),
    );
    return library ?? local ?? selections[0];
  }
  if (acquiredFiles.length > 0) {
    return selectionFromAcquiredFile(acquiredFiles[0], project, itemId);
  }
  return null;
}
