import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { readJsonFile, writeJsonFile } from "@/lib/paths";
import {
  getAssetMetaPath,
  getLibraryAssetsRoot,
  getLibraryIndexPath,
  getLibraryRoot,
  libraryPublicUrl,
} from "./paths";
import {
  appendUsage,
  buildSearchText,
  ensureLibraryDirs,
  mediaTypeFromFilename,
} from "./helpers";
import {
  isUglyFilename,
  sanitizeFilename,
  suggestLibraryFilename,
  uniqueFilenameInDir,
} from "./filename";
import type {
  IngestContext,
  IngestResult,
  LibraryAssetMeta,
  LibraryIndex,
  LibraryIndexEntry,
  LibraryKind,
  LibraryUsage,
} from "./types";

export function contentHashId(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex").slice(0, 16);
}

function metaToIndexEntry(meta: LibraryAssetMeta): LibraryIndexEntry {
  return {
    id: meta.id,
    filename: meta.filename,
    original_filename: meta.original_filename,
    kind: meta.kind,
    media_type: meta.media_type,
    thumbnail_url: libraryPublicUrl(meta.id, meta.filename),
    public_url: libraryPublicUrl(meta.id, meta.filename),
    tags: meta.tags,
    manual_notes: meta.manual_notes,
    search_text: meta.search_text,
    usage_count: meta.usages.length,
    archived: meta.archived,
    created_at: meta.created_at,
    updated_at: meta.updated_at,
  };
}

export function rebuildLibraryIndex(): LibraryIndex {
  fs.mkdirSync(getLibraryRoot(), { recursive: true });
  fs.mkdirSync(getLibraryAssetsRoot(), { recursive: true });

  const assets: LibraryIndexEntry[] = [];
  if (fs.existsSync(getLibraryAssetsRoot())) {
  for (const id of fs.readdirSync(getLibraryAssetsRoot())) {
    const metaPath = getAssetMetaPath(id);
    if (!fs.existsSync(metaPath)) continue;
    const meta = readJsonFile<LibraryAssetMeta>(metaPath);
    const nextSearch = buildSearchText(meta);
    if (meta.search_text !== nextSearch) {
      meta.search_text = nextSearch;
      writeJsonFile(metaPath, meta);
    }
    assets.push(metaToIndexEntry(meta));
  }
  }

  assets.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const index: LibraryIndex = {
    version: 1,
    updated_at: new Date().toISOString(),
    asset_count: assets.length,
    assets,
  };
  writeJsonFile(getLibraryIndexPath(), index);
  return index;
}

export function readLibraryIndex(): LibraryIndex {
  const indexPath = getLibraryIndexPath();
  if (!fs.existsSync(indexPath)) {
    return rebuildLibraryIndex();
  }
  return readJsonFile<LibraryIndex>(indexPath);
}

function buildUsage(ctx: IngestContext): LibraryUsage {
  return {
    episode_id: ctx.episode_id,
    cue_id: ctx.cue_id,
    spoken: ctx.spoken ?? "",
    search_queries: ctx.search_queries ?? [],
    people: ctx.people ?? [],
    situation: ctx.situation ?? "",
    editorial_intent: ctx.editorial_intent ?? "",
    attached_at: new Date().toISOString(),
  };
}

function deriveTags(ctx: IngestContext): string[] {
  const tags = new Set(ctx.tags ?? []);
  for (const p of ctx.people ?? []) {
    if (p.name.trim()) tags.add(p.name.trim().toLowerCase());
  }
  return [...tags];
}

export function ingestFromBuffer(
  data: Buffer,
  originalFilename: string,
  ctx: IngestContext,
): IngestResult {
  const id = contentHashId(data);
  const assetDir = ensureLibraryDirs(id);
  const metaPath = getAssetMetaPath(id);
  const usage = buildUsage(ctx);
  const kind: LibraryKind =
    ctx.kind ??
    (originalFilename.toLowerCase().startsWith("sticker-") ||
    originalFilename.toLowerCase().startsWith("giphy-") ||
    originalFilename.toLowerCase().startsWith("title-")
      ? "overlay"
      : "archive");
  const now = new Date().toISOString();

  if (fs.existsSync(metaPath)) {
    const existing = readJsonFile<LibraryAssetMeta>(metaPath);
    existing.usages = appendUsage(existing.usages, usage);
    existing.tags = [...new Set([...existing.tags, ...deriveTags(ctx)])];
    existing.updated_at = now;
    existing.search_text = buildSearchText(existing);
    writeJsonFile(metaPath, existing);
    rebuildLibraryIndex();
    return {
      id,
      filename: existing.filename,
      publicUrl: libraryPublicUrl(id, existing.filename),
      deduplicated: true,
      media_type: existing.media_type,
      kind: existing.kind,
    };
  }

  const queryHint = ctx.search_queries?.[0] ?? ctx.title;
  const filename = uniqueFilenameInDir(
    assetDir,
    suggestLibraryFilename(originalFilename, {
      title: ctx.title,
      query: queryHint,
    }),
  );
  const filePath = `${assetDir}/${filename}`;
  fs.writeFileSync(filePath, data);

  const meta: LibraryAssetMeta = {
    version: 1,
    id,
    filename,
    original_filename: originalFilename,
    kind,
    media_type: mediaTypeFromFilename(filename),
    source_url: ctx.source_url ?? null,
    source_engine: ctx.source_engine ?? null,
    license: ctx.license ?? "verify rights before use",
    tags: deriveTags(ctx),
    manual_notes: ctx.manual_notes ?? "",
    usages: [usage],
    archived: false,
    created_at: now,
    updated_at: now,
    search_text: "",
  };
  meta.search_text = buildSearchText(meta);
  writeJsonFile(metaPath, meta);
  rebuildLibraryIndex();

  return {
    id,
    filename,
    publicUrl: libraryPublicUrl(id, filename),
    deduplicated: false,
    media_type: meta.media_type,
    kind: meta.kind,
  };
}

export function ingestFromFile(
  absolutePath: string,
  originalFilename: string,
  ctx: IngestContext,
): IngestResult {
  const data = fs.readFileSync(absolutePath);
  return ingestFromBuffer(data, originalFilename, ctx);
}

export function readAssetMeta(assetId: string): LibraryAssetMeta | null {
  const metaPath = getAssetMetaPath(assetId);
  if (!fs.existsSync(metaPath)) return null;
  return readJsonFile<LibraryAssetMeta>(metaPath);
}

/** Append cue context to library assets referenced in acquisition selections. */
export function syncLibraryUsagesFromSelections(
  ctx: IngestContext,
  selections: Array<{ result_id: string }>,
): void {
  const usage = buildUsage(ctx);
  let changed = false;

  for (const sel of selections) {
    const match = sel.result_id.match(/^library:([a-f0-9]{16})$/);
    if (!match) continue;
    const assetId = match[1];
    const meta = readAssetMeta(assetId);
    if (!meta || meta.archived) continue;
    meta.usages = appendUsage(meta.usages, usage);
    meta.updated_at = new Date().toISOString();
    meta.search_text = buildSearchText(meta);
    writeJsonFile(getAssetMetaPath(assetId), meta);
    changed = true;
  }

  if (changed) rebuildLibraryIndex();
}

export interface UpdateLibraryAssetPatch {
  filename?: string;
  tags?: string[];
  manual_notes?: string;
  archived?: boolean;
  kind?: LibraryKind;
}

function resolveRenamedFilename(
  currentFilename: string,
  requestedName: string,
): string | null {
  const trimmed = requestedName.trim();
  if (!trimmed) return null;
  let next = sanitizeFilename(trimmed);
  const currentExt = path.extname(currentFilename);
  if (!path.extname(next) && currentExt) {
    next = sanitizeFilename(`${next}${currentExt}`);
  }
  if (!next || next === "." || next === "..") return null;
  return next;
}

export function updateLibraryAsset(
  assetId: string,
  patch: UpdateLibraryAssetPatch,
): LibraryAssetMeta {
  const meta = readAssetMeta(assetId);
  if (!meta) throw new Error(`Unknown library asset: ${assetId}`);

  if (patch.filename !== undefined) {
    const next = resolveRenamedFilename(meta.filename, patch.filename);
    if (!next) throw new Error("Invalid filename");
    if (next !== meta.filename) {
      const dir = ensureLibraryDirs(assetId);
      const currentPath = path.join(dir, meta.filename);
      if (!fs.existsSync(currentPath)) {
        throw new Error(`File not found on disk: ${meta.filename}`);
      }
      let targetName = next;
      const targetPath = path.join(dir, targetName);
      if (fs.existsSync(targetPath) && targetName !== meta.filename) {
        targetName = uniqueFilenameInDir(dir, targetName);
      }
      fs.renameSync(currentPath, path.join(dir, targetName));
      meta.filename = targetName;
      meta.media_type = mediaTypeFromFilename(targetName);
    }
  }

  if (patch.tags !== undefined) {
    meta.tags = [...new Set(patch.tags.map((t) => t.trim()).filter(Boolean))];
  }
  if (patch.manual_notes !== undefined) {
    meta.manual_notes = patch.manual_notes.trim();
  }
  if (patch.archived !== undefined) {
    meta.archived = patch.archived;
  }
  if (patch.kind !== undefined) {
    meta.kind = patch.kind;
  }

  meta.updated_at = new Date().toISOString();
  meta.search_text = buildSearchText(meta);
  writeJsonFile(getAssetMetaPath(assetId), meta);
  rebuildLibraryIndex();
  return meta;
}

/** Rename asset file when meta filename differs from ugly original on disk */
export function normalizeExistingAssetFilename(assetId: string): void {
  const meta = readAssetMeta(assetId);
  if (!meta) return;
  const dir = ensureLibraryDirs(assetId);
  const currentPath = `${dir}/${meta.filename}`;
  if (fs.existsSync(currentPath)) return;
  const candidates = fs
    .readdirSync(dir)
    .filter((f) => f !== "meta.json" && !f.startsWith("."));
  if (candidates.length === 1 && isUglyFilename(candidates[0])) {
    const next = suggestLibraryFilename(candidates[0], {
      title: meta.usages[0]?.spoken,
      query: meta.usages[0]?.search_queries[0],
    });
    fs.renameSync(`${dir}/${candidates[0]}`, `${dir}/${next}`);
    meta.filename = next;
    meta.updated_at = new Date().toISOString();
    meta.search_text = buildSearchText(meta);
    writeJsonFile(getAssetMetaPath(assetId), meta);
    rebuildLibraryIndex();
  }
}
