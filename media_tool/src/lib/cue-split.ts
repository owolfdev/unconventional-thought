import fs from "fs";
import path from "path";
import { countCompleted, itemAcquisitionFromManifest } from "./acquisition";
import {
  assetManifestPath,
  ensureItemFolder,
  getItemDir,
  getProjectDir,
  itemAcquisitionPath,
  projectSlugFromManifest,
  writeItemToFolder,
  type ProjectIndex,
} from "./media-folders";
import { readAssetMeta } from "./media-library/ingest";
import { getAssetMetaPath, getLibraryAssetsRoot } from "./media-library/paths";
import type { LibraryAssetMeta } from "./media-library/types";
import {
  acquisitionPathForManifest,
  readJsonFile,
  resolveManifestPath,
  writeJsonFile,
} from "./paths";
import type {
  ItemAcquisition,
  MediaAcquisitionDocument,
  MediaToolItem,
  MediaToolManifest,
} from "./types";

export interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

export interface AlignedCueWord {
  index: number;
  display: string;
  start: number;
  end: number;
}

export interface CueSplitPreview {
  itemId: string;
  alignedWords: AlignedCueWord[];
  canSplit: boolean;
  reason?: string;
}

export interface CueSplitHalfPreview {
  id: string;
  cue: number;
  t_start: number;
  t_end: number;
  duration_sec: number;
  spoken: string;
}

export interface CueSplitResultPreview {
  first: CueSplitHalfPreview;
  second: CueSplitHalfPreview;
  splitTimeSec: number;
  renames: Array<{ from: string; to: string }>;
}

function wordToken(word: string): string {
  return word.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
}

export function formatCueId(cue: number): string {
  return `m${String(cue).padStart(3, "0")}`;
}

export function parseCueNumber(id: string): number {
  const m = id.match(/^m(\d+)$/i);
  if (!m) throw new Error(`Invalid cue id: ${id}`);
  return parseInt(m[1], 10);
}

function episodeDirForManifest(manifestPath: string): string {
  const manifestAbs = resolveManifestPath(manifestPath);
  return path.dirname(path.dirname(manifestAbs));
}

/** Whisper word-level JSON (not SRT). */
export function transcriptJsonPathForManifest(
  manifestPath: string,
  manifest: MediaToolManifest,
): string {
  const episodeDir = episodeDirForManifest(manifestPath);
  const episodeJsonPath = path.join(episodeDir, "episode.json");
  if (fs.existsSync(episodeJsonPath)) {
    try {
      const cfg = readJsonFile<{ transcript_json?: string }>(episodeJsonPath);
      if (cfg.transcript_json?.trim()) {
        return path.join(episodeDir, cfg.transcript_json.trim());
      }
    } catch {
      /* fall through */
    }
  }

  const rel = manifest.source_transcript?.trim();
  if (rel) {
    if (/\.srt$/i.test(rel)) {
      const jsonRel = rel.replace(/\.srt$/i, ".json");
      const jsonPath = path.join(episodeDir, jsonRel);
      if (fs.existsSync(jsonPath)) return jsonPath;
    }
    const direct = path.join(episodeDir, rel);
    if (/\.json$/i.test(rel)) return direct;
  }

  return path.join(episodeDir, "transcript", "transcript.json");
}

interface TranscriptDoc {
  words?: WhisperWord[];
  segments?: Array<{ words?: WhisperWord[] }>;
}

function flattenTranscriptWords(doc: TranscriptDoc): WhisperWord[] {
  if (doc.words?.length) return doc.words;
  if (!doc.segments?.length) return [];
  const out: WhisperWord[] = [];
  for (const seg of doc.segments) {
    if (seg.words?.length) out.push(...seg.words);
  }
  return out;
}

export function loadTranscriptWords(
  manifestPath: string,
  manifest: MediaToolManifest,
): WhisperWord[] {
  const transcriptPath = transcriptJsonPathForManifest(manifestPath, manifest);
  if (!fs.existsSync(transcriptPath)) return [];
  try {
    const doc = readJsonFile<TranscriptDoc>(transcriptPath);
    return flattenTranscriptWords(doc);
  } catch {
    return [];
  }
}

export function wordsInCueRange(
  words: WhisperWord[],
  tStart: number,
  tEnd: number,
): WhisperWord[] {
  const margin = 0.15;
  return words.filter(
    (w) => w.start < tEnd + margin && w.end > tStart - margin,
  );
}

export function alignSpokenToWords(
  spoken: string,
  cueWords: WhisperWord[],
): AlignedCueWord[] {
  const displayTokens = spoken.trim().split(/\s+/).filter(Boolean);
  const aligned: AlignedCueWord[] = [];
  let wi = 0;

  for (let i = 0; i < displayTokens.length; i += 1) {
    const display = displayTokens[i];
    const tok = wordToken(display);
    if (!tok) continue;

    while (wi < cueWords.length && wordToken(cueWords[wi].word) !== tok) {
      wi += 1;
    }
    if (wi >= cueWords.length) break;

    aligned.push({
      index: aligned.length,
      display,
      start: cueWords[wi].start,
      end: cueWords[wi].end,
    });
    wi += 1;
  }

  return aligned;
}

export function getCueSplitPreview(
  item: MediaToolItem,
  words: WhisperWord[],
): CueSplitPreview {
  const spoken = item.spoken?.trim() ?? "";
  if (!spoken) {
    return {
      itemId: item.id,
      alignedWords: [],
      canSplit: false,
      reason: "This cue has no spoken text.",
    };
  }

  const cueWords = wordsInCueRange(words, item.t_start, item.t_end);
  if (cueWords.length < 2) {
    return {
      itemId: item.id,
      alignedWords: [],
      canSplit: false,
      reason: "Not enough transcript words in this cue range.",
    };
  }

  const aligned = alignSpokenToWords(spoken, cueWords);
  if (aligned.length < 2) {
    return {
      itemId: item.id,
      alignedWords: aligned,
      canSplit: false,
      reason: "Could not align spoken text to transcript words.",
    };
  }

  return {
    itemId: item.id,
    alignedWords: aligned,
    canSplit: true,
  };
}

export function previewCueSplit(
  item: MediaToolItem,
  words: WhisperWord[],
  splitAfterWordIndex: number,
  itemIndex: number,
): CueSplitResultPreview {
  const splitPreview = getCueSplitPreview(item, words);
  if (!splitPreview.canSplit) {
    throw new Error(splitPreview.reason ?? "Cannot split this cue");
  }
  if (
    splitAfterWordIndex < 0 ||
    splitAfterWordIndex >= splitPreview.alignedWords.length - 1
  ) {
    throw new Error("Choose a split point between two words.");
  }

  const aligned = splitPreview.alignedWords;
  const firstWords = aligned.slice(0, splitAfterWordIndex + 1);
  const secondWords = aligned.slice(splitAfterWordIndex + 1);
  const splitTimeSec =
    (firstWords[firstWords.length - 1].end +
      secondWords[0].start) /
    2;

  const firstSpoken = firstWords.map((w) => w.display).join(" ");
  const secondSpoken = secondWords.map((w) => w.display).join(" ");

  const first: CueSplitHalfPreview = {
    id: formatCueId(itemIndex),
    cue: itemIndex,
    t_start: item.t_start,
    t_end: roundSec(splitTimeSec),
    duration_sec: roundSec(splitTimeSec - item.t_start),
    spoken: firstSpoken,
  };

  const second: CueSplitHalfPreview = {
    id: formatCueId(itemIndex + 1),
    cue: itemIndex + 1,
    t_start: roundSec(splitTimeSec),
    t_end: item.t_end,
    duration_sec: roundSec(item.t_end - splitTimeSec),
    spoken: secondSpoken,
  };

  return {
    first,
    second,
    splitTimeSec: roundSec(splitTimeSec),
    renames: [],
  };
}

function roundSec(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function cloneManifestItem(
  item: MediaToolItem,
  patch: Partial<MediaToolItem>,
): MediaToolItem {
  return {
    ...item,
    ...patch,
    duration_sec: roundSec(
      (patch.t_end ?? item.t_end) - (patch.t_start ?? item.t_start),
    ),
  };
}

function buildFolderRenames(
  oldItems: MediaToolItem[],
  insertIndex: number,
): Map<string, string> {
  const renames = new Map<string, string>();
  for (let oldIdx = insertIndex + 1; oldIdx < oldItems.length; oldIdx += 1) {
    const oldId = oldItems[oldIdx].id;
    const newId = formatCueId(oldIdx + 1);
    if (oldId !== newId) renames.set(oldId, newId);
  }
  return renames;
}

function renameCueFolders(
  projectSlug: string,
  renames: Map<string, string>,
): void {
  const ordered = [...renames.entries()].sort(
    (a, b) => parseCueNumber(b[0]) - parseCueNumber(a[0]),
  );
  for (const [fromId, toId] of ordered) {
    const fromDir = getItemDir(projectSlug, fromId);
    const toDir = getItemDir(projectSlug, toId);
    if (!fs.existsSync(fromDir)) continue;
    if (fs.existsSync(toDir)) {
      throw new Error(`Cannot rename ${fromId} → ${toId}: target exists`);
    }
    fs.renameSync(fromDir, toDir);
  }
}

function patchAcquisitionIds(
  projectSlug: string,
  itemId: string,
  item: MediaToolItem,
): void {
  const acqPath = itemAcquisitionPath(projectSlug, itemId);
  if (!fs.existsSync(acqPath)) return;
  const acq = readJsonFile<ItemAcquisition>(acqPath);
  acq.id = item.id;
  acq.cue = item.cue;
  writeJsonFile(acqPath, acq);

  const amPath = assetManifestPath(projectSlug, itemId);
  if (fs.existsSync(amPath)) {
    const am = readJsonFile<Record<string, unknown>>(amPath);
    am.id = item.id;
    am.cue = item.cue;
    am.t_start = item.t_start;
    am.t_end = item.t_end;
    am.duration_sec = item.duration_sec;
    am.spoken = item.spoken;
    writeJsonFile(amPath, am);
  }
}

function updateLibraryCueIds(
  episodeId: string,
  renames: Map<string, string>,
): void {
  if (renames.size === 0) return;
  const assetsRoot = getLibraryAssetsRoot();
  if (!fs.existsSync(assetsRoot)) return;

  for (const entry of fs.readdirSync(assetsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const meta = readAssetMeta(entry.name);
    if (!meta?.usages?.length) continue;

    let changed = false;
    const usages = meta.usages.map((u) => {
      if (u.episode_id !== episodeId) return u;
      const nextId = renames.get(u.cue_id);
      if (!nextId) return u;
      changed = true;
      return { ...u, cue_id: nextId };
    });

    if (changed) {
      const updated: LibraryAssetMeta = { ...meta, usages };
      writeJsonFile(getAssetMetaPath(entry.name), updated);
    }
  }
}

function loadAcquisitionFromFolders(
  projectSlug: string,
  manifestItems: MediaToolItem[],
): Record<string, ItemAcquisition> {
  const items: Record<string, ItemAcquisition> = {};
  for (const item of manifestItems) {
    const acqPath = itemAcquisitionPath(projectSlug, item.id);
    if (fs.existsSync(acqPath)) {
      items[item.id] = readJsonFile<ItemAcquisition>(acqPath);
    } else {
      items[item.id] = itemAcquisitionFromManifest(item);
    }
  }
  return items;
}

export interface SplitCueOptions {
  manifestPath: string;
  itemId: string;
  splitAfterWordIndex: number;
  copyEditorialToSecondHalf?: boolean;
}

export interface SplitCueResult {
  manifest: MediaToolManifest;
  acquisition: MediaAcquisitionDocument;
  firstId: string;
  secondId: string;
  renames: Array<{ from: string; to: string }>;
}

export function splitCueInManifest(options: SplitCueOptions): SplitCueResult {
  const {
    manifestPath,
    itemId,
    splitAfterWordIndex,
    copyEditorialToSecondHalf = true,
  } = options;

  const manifestAbs = resolveManifestPath(manifestPath);
  const manifest = readJsonFile<MediaToolManifest>(manifestAbs);
  const itemIndex = manifest.items.findIndex((it) => it.id === itemId);
  if (itemIndex < 0) throw new Error(`Cue not found: ${itemId}`);

  const item = manifest.items[itemIndex];
  const words = loadTranscriptWords(manifestPath, manifest);
  const halves = previewCueSplit(
    item,
    words,
    splitAfterWordIndex,
    itemIndex,
  );

  const projectSlug = projectSlugFromManifest(manifest);
  const oldItems = manifest.items;
  const renames = buildFolderRenames(oldItems, itemIndex);

  renameCueFolders(projectSlug, renames);
  updateLibraryCueIds(manifest.episode, renames);

  const firstItem = cloneManifestItem(item, {
    cue: itemIndex,
    id: formatCueId(itemIndex),
    t_start: halves.first.t_start,
    t_end: halves.first.t_end,
    spoken: halves.first.spoken,
  });

  const secondItem = cloneManifestItem(item, {
    cue: itemIndex + 1,
    id: formatCueId(itemIndex + 1),
    t_start: halves.second.t_start,
    t_end: halves.second.t_end,
    spoken: halves.second.spoken,
    reuse_id: "",
    ...(copyEditorialToSecondHalf
      ? {}
      : {
          search_queries: [],
          editorial_intent: `${item.editorial_intent} (split — second half)`,
        }),
  });

  const newItems = [
    ...oldItems.slice(0, itemIndex),
    firstItem,
    secondItem,
    ...oldItems.slice(itemIndex + 1),
  ];

  for (let i = 0; i < newItems.length; i += 1) {
    newItems[i] = {
      ...newItems[i],
      cue: i,
      id: formatCueId(i),
      duration_sec: roundSec(newItems[i].t_end - newItems[i].t_start),
    };
  }

  for (const [fromId, toId] of renames.entries()) {
    const renamedItem = newItems.find((it) => it.id === toId);
    if (renamedItem) patchAcquisitionIds(projectSlug, toId, renamedItem);
  }

  const firstAcqPath = itemAcquisitionPath(projectSlug, firstItem.id);
  const existingFirst = fs.existsSync(firstAcqPath)
    ? readJsonFile<ItemAcquisition>(firstAcqPath)
    : itemAcquisitionFromManifest(item);
  writeItemToFolder(
    projectSlug,
    firstItem,
    { ...existingFirst, id: firstItem.id, cue: firstItem.cue },
    manifestPath,
  );

  ensureItemFolder(projectSlug, secondItem, manifestPath);

  for (const [, toId] of renames.entries()) {
    const renamedItem = newItems.find((it) => it.id === toId);
    if (renamedItem) patchAcquisitionIds(projectSlug, toId, renamedItem);
  }

  const updatedManifest: MediaToolManifest = {
    ...manifest,
    cue_count: newItems.length,
    items: newItems,
  };

  writeJsonFile(manifestAbs, updatedManifest);

  const projectIndexPath = path.join(getProjectDir(projectSlug), "project.json");
  if (fs.existsSync(projectIndexPath)) {
    const projectIndex = readJsonFile<ProjectIndex>(projectIndexPath);
    projectIndex.item_count = newItems.length;
    projectIndex.updated_at = new Date().toISOString();
    writeJsonFile(projectIndexPath, projectIndex);
  }

  const acqAbs = acquisitionPathForManifest(manifestPath);
  const now = new Date().toISOString();
  const itemsById = loadAcquisitionFromFolders(projectSlug, newItems);
  const acquisition: MediaAcquisitionDocument = {
    version: 1,
    source_manifest: manifestPath,
    episode: updatedManifest.episode,
    created_at: fs.existsSync(acqAbs)
      ? readJsonFile<MediaAcquisitionDocument>(acqAbs).created_at
      : now,
    updated_at: now,
    item_count: newItems.length,
    completed_count: countCompleted({ items: itemsById } as MediaAcquisitionDocument),
    items: itemsById,
  };
  writeJsonFile(acqAbs, acquisition);

  return {
    manifest: updatedManifest,
    acquisition,
    firstId: newItems[itemIndex].id,
    secondId: newItems[itemIndex + 1].id,
    renames: [...renames.entries()].map(([from, to]) => ({ from, to })),
  };
}
