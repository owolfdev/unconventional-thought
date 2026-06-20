import type { ItemAcquisition, SelectedMedia } from "./types";

/** Format seconds for in-point display (m:ss.s). */
export function formatVideoTime(sec: number): string {
  const clamped = Math.max(0, sec);
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${s.toFixed(1).padStart(m > 0 ? 4 : 3, "0")}`;
}

export function normalizeStartFromSec(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 1000) / 1000;
}

/** Parse @inpoint args: seconds, m:ss.s, clear/none, playhead. */
export function parseInpointArg(raw: string): number | "clear" | "playhead" | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower === "clear" || lower === "none" || lower === "reset") return "clear";
  if (lower === "playhead" || lower === "head") return "playhead";

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return normalizeStartFromSec(Number(trimmed)) ?? null;
  }

  const timeMatch = trimmed.match(/^(\d+):(\d+(?:\.\d+)?)$/);
  if (timeMatch) {
    const minutes = Number(timeMatch[1]);
    const seconds = Number(timeMatch[2]);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds >= 60) {
      return null;
    }
    return normalizeStartFromSec(minutes * 60 + seconds) ?? null;
  }

  return null;
}

export function updateSelectionStartFromSec(
  acq: ItemAcquisition,
  resultId: string,
  startFromSec: number | undefined,
): ItemAcquisition {
  const normalized = normalizeStartFromSec(startFromSec);
  return {
    ...acq,
    queries: acq.queries.map((q) => ({
      ...q,
      selections: q.selections.map((sel) => {
        if (sel.result_id !== resultId) return sel;
        if (normalized == null) {
          const { start_from_sec: _, ...rest } = sel;
          return rest;
        }
        return { ...sel, start_from_sec: normalized };
      }),
    })),
  };
}

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

/** Library asset id for the cue's primary plate (excludes sticker/giphy/title layers). */
export function selectedPlateLibraryId(acq: ItemAcquisition): string | null {
  const staged = flattenStagedSelections(acq);
  const plate = staged.find(
    ({ selection }) =>
      selection.result_id.startsWith("library:") &&
      !selection.engine_id.includes("sticker") &&
      !selection.engine_id.includes("giphy") &&
      !selection.engine_id.includes("title"),
  );
  if (!plate) return null;
  return plate.selection.result_id.slice("library:".length);
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
