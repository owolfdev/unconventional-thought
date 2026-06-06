import fs from "fs";
import path from "path";
import type {
  ItemAcquisition,
  MediaToolItem,
  MediaToolManifest,
  TextGraphic,
} from "./types";
import { itemAcquisitionFromManifest } from "./acquisition";
import {
  DEFAULT_BACKGROUND_COLOR,
  normalizeBackgroundColor,
} from "./background-color";
import {
  normalizeVisualMode,
  requiresAcquiredMedia,
} from "./visual-modes";
import { listAcquiredFiles } from "./download-media";
import { readJsonFile, writeJsonFile } from "./paths";

/** Next.js app root (media_tool/) */
export function getAppRoot(): string {
  return process.cwd();
}

/** public/media — served at /media/... */
export function getMediaPublicRoot(): string {
  return path.join(getAppRoot(), "public", "media");
}

export function projectSlugFromManifest(manifest: MediaToolManifest): string {
  return manifest.episode.trim() || "unknown_project";
}

export function getProjectDir(slug: string): string {
  return path.join(getMediaPublicRoot(), slug);
}

export function getItemDir(projectSlug: string, itemId: string): string {
  return path.join(getProjectDir(projectSlug), itemId);
}

export function getAcquiredDir(projectSlug: string, itemId: string): string {
  return path.join(getItemDir(projectSlug, itemId), "acquired");
}

export function assetManifestPath(projectSlug: string, itemId: string): string {
  return path.join(getItemDir(projectSlug, itemId), "asset_manifest.json");
}

export function itemAcquisitionPath(projectSlug: string, itemId: string): string {
  return path.join(getItemDir(projectSlug, itemId), "acquisition.json");
}

/** URL path for browser (under public/) */
export function publicUrlForItem(projectSlug: string, itemId: string): string {
  return `/media/${projectSlug}/${itemId}`;
}

export interface ItemAssetManifest {
  version: 1;
  id: string;
  cue: number;
  t_start: number;
  t_end: number;
  duration_sec: number;
  spoken: string;
  visual_mode: string;
  expected_media_type: string;
  editorial_intent: string;
  situation: string;
  people: MediaToolItem["people"];
  date_from: string;
  date_to: string;
  location: string;
  search_queries: string[];
  avoid: string[];
  artifact: MediaToolItem["artifact"];
  text_graphic: MediaToolItem["text_graphic"];
  /** Typography composited over primary media (photo/video). */
  text_graphic_layer?: TextGraphic | null;
  /** What still needs to be sourced */
  targets: Array<{
    slot: string;
    description: string;
    status: "needed" | "selected" | "acquired";
  }>;
  /** voicecut-ready when saved from acquisition */
  effects?: string[];
  transition?: string | null;
  background_color?: string;
  requires_media_files: boolean;
  acquired_files: string[];
  source_media_search: string;
  updated_at: string;
}

export interface ProjectIndex {
  version: 1;
  project: string;
  source_media_search: string;
  item_count: number;
  created_at: string;
  updated_at: string;
  /** When true, Remotion preview renders cue + media id overlays (m###). */
  remotion_show_cue_overlay?: boolean;
}

function buildAssetManifest(
  item: MediaToolItem,
  sourceRel: string,
): ItemAssetManifest {
  const mode = normalizeVisualMode(item.visual_mode);
  const isText = mode === "text_graphic";
  const isEffectOnly = mode === "effect_only";
  const targets = isEffectOnly
    ? [
        {
          slot: "black_plate",
          description: "No source image — VO + effects on black",
          status: "needed" as const,
        },
      ]
    : isText
    ? [
        {
          slot: "generated",
          description: `Text graphic: ${item.text_graphic?.type ?? "transcription"} — ${item.text_graphic?.text ?? item.spoken}`,
          status: "needed" as const,
        },
      ]
    : [
        {
          slot: "primary",
          description: item.editorial_intent || item.situation,
          status: "needed" as const,
        },
        ...item.search_queries.slice(0, 3).map((q, i) => ({
          slot: `search_${i + 1}`,
          description: `Candidate from query: ${q}`,
          status: "needed" as const,
        })),
      ];

  return {
    version: 1,
    id: item.id,
    cue: item.cue,
    t_start: item.t_start,
    t_end: item.t_end,
    duration_sec: item.duration_sec,
    spoken: item.spoken,
    visual_mode: mode,
    expected_media_type: isText ? "generated" : item.media_type || "photo",
    editorial_intent: item.editorial_intent,
    situation: item.situation,
    people: item.people,
    date_from: item.date_from,
    date_to: item.date_to,
    location: item.location,
    search_queries: item.search_queries,
    avoid: item.avoid,
    artifact: item.artifact,
    text_graphic: item.text_graphic,
    text_graphic_layer: null,
    targets,
    effects: [],
    transition: null,
    background_color: DEFAULT_BACKGROUND_COLOR,
    requires_media_files: !isText && !isEffectOnly,
    acquired_files: [],
    source_media_search: sourceRel,
    updated_at: new Date().toISOString(),
  };
}

export interface FolderInitResult {
  project: string;
  projectDir: string;
  publicBaseUrl: string;
  created: number;
  updated: number;
  skipped: number;
  total: number;
}

export function ensureProjectFolders(
  manifest: MediaToolManifest,
  sourceManifestRel: string,
  options?: { refreshManifests?: boolean },
): FolderInitResult {
  const slug = projectSlugFromManifest(manifest);
  const projectDir = getProjectDir(slug);
  const now = new Date().toISOString();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  fs.mkdirSync(projectDir, { recursive: true });

  const projectIndexPath = path.join(projectDir, "project.json");
  const projectIndex: ProjectIndex = fs.existsSync(projectIndexPath)
    ? readJsonFile<ProjectIndex>(projectIndexPath)
    : {
        version: 1,
        project: slug,
        source_media_search: sourceManifestRel,
        item_count: manifest.items.length,
        created_at: now,
        updated_at: now,
      };
  projectIndex.updated_at = now;
  projectIndex.item_count = manifest.items.length;
  projectIndex.source_media_search = sourceManifestRel;
  writeJsonFile(projectIndexPath, projectIndex);

  for (const item of manifest.items) {
    const itemDir = getItemDir(slug, item.id);
    const existed = fs.existsSync(itemDir);
    if (!existed) created += 1;

    fs.mkdirSync(getAcquiredDir(slug, item.id), { recursive: true });
    const gitkeep = path.join(getAcquiredDir(slug, item.id), ".gitkeep");
    if (!fs.existsSync(gitkeep)) {
      fs.writeFileSync(gitkeep, "", "utf-8");
    }

    const amPath = assetManifestPath(slug, item.id);
    const shouldWriteManifest =
      !fs.existsSync(amPath) || options?.refreshManifests;
    if (shouldWriteManifest) {
      writeJsonFile(amPath, buildAssetManifest(item, sourceManifestRel));
      if (existed) updated += 1;
    } else {
      skipped += 1;
    }

    const acqPath = itemAcquisitionPath(slug, item.id);
    if (!fs.existsSync(acqPath)) {
      writeJsonFile(acqPath, itemAcquisitionFromManifest(item));
    }
  }

  return {
    project: slug,
    projectDir,
    publicBaseUrl: `/media/${slug}`,
    created,
    updated,
    skipped,
    total: manifest.items.length,
  };
}

/** Ensure one cue folder exists with asset_manifest + acquisition.json. */
export function ensureItemFolder(
  slug: string,
  item: MediaToolItem,
  sourceManifestRel: string,
): ItemAcquisition {
  fs.mkdirSync(getItemDir(slug, item.id), { recursive: true });
  fs.mkdirSync(getAcquiredDir(slug, item.id), { recursive: true });

  const amPath = assetManifestPath(slug, item.id);
  if (!fs.existsSync(amPath)) {
    writeJsonFile(amPath, buildAssetManifest(item, sourceManifestRel));
  }

  const acqPath = itemAcquisitionPath(slug, item.id);
  if (fs.existsSync(acqPath)) {
    return readJsonFile<ItemAcquisition>(acqPath);
  }

  const acq = itemAcquisitionFromManifest(item);
  writeJsonFile(acqPath, acq);
  return acq;
}

export interface FolderStatus {
  project: string;
  projectDir: string;
  publicBaseUrl: string;
  exists: boolean;
  itemFolders: number;
  totalItems: number;
  withAssetManifest: number;
  withAcquisition: number;
  acquiredFileCount: number;
}

export function getFolderStatus(
  manifest: MediaToolManifest,
): FolderStatus {
  const slug = projectSlugFromManifest(manifest);
  const projectDir = getProjectDir(slug);
  const exists = fs.existsSync(projectDir);
  let itemFolders = 0;
  let withAssetManifest = 0;
  let withAcquisition = 0;
  let acquiredFileCount = 0;

  if (exists) {
    for (const item of manifest.items) {
      const itemDir = getItemDir(slug, item.id);
      if (fs.existsSync(itemDir)) itemFolders += 1;
      if (fs.existsSync(assetManifestPath(slug, item.id))) withAssetManifest += 1;
      if (fs.existsSync(itemAcquisitionPath(slug, item.id))) {
        withAcquisition += 1;
      }
      const acqDir = getAcquiredDir(slug, item.id);
      if (fs.existsSync(acqDir)) {
        const files = fs.readdirSync(acqDir).filter((f) => f !== ".gitkeep");
        acquiredFileCount += files.length;
      }
    }
  }

  return {
    project: slug,
    projectDir,
    publicBaseUrl: `/media/${slug}`,
    exists,
    itemFolders,
    totalItems: manifest.items.length,
    withAssetManifest,
    withAcquisition,
    acquiredFileCount,
  };
}

/** Sync per-item acquisition.json + asset_manifest target status from workspace state */
export function writeItemToFolder(
  projectSlug: string,
  item: MediaToolItem,
  acquisition: ItemAcquisition,
  sourceManifestRel: string,
): void {
  const slug = projectSlug;
  fs.mkdirSync(getAcquiredDir(slug, item.id), { recursive: true });
  writeJsonFile(itemAcquisitionPath(slug, item.id), acquisition);

  const amPath = assetManifestPath(slug, item.id);
  const manifest = fs.existsSync(amPath)
    ? readJsonFile<ItemAssetManifest>(amPath)
    : buildAssetManifest(item, sourceManifestRel);

  const selectionCount = acquisition.queries.reduce(
    (n, q) => n + q.selections.length,
    0,
  );
  const acquiredFiles = fs.existsSync(getAcquiredDir(slug, item.id))
    ? fs
        .readdirSync(getAcquiredDir(slug, item.id))
        .filter((f) => f !== ".gitkeep")
    : [];

  manifest.visual_mode = acquisition.resolved_visual_mode;
  manifest.expected_media_type = acquisition.resolved_media_type;
  manifest.updated_at = new Date().toISOString();

  manifest.effects = acquisition.effects ?? [];
  manifest.transition = acquisition.transition ?? null;
  manifest.background_color = normalizeBackgroundColor(
    acquisition.background_color,
  );
  manifest.acquired_files = listAcquiredFiles(getAcquiredDir(slug, item.id));
  const libraryFiles = acquisition.queries
    .flatMap((q) => q.selections)
    .filter((s) => s.url.includes("/media/_library/"))
    .map((s) => s.url.replace(/^.*\/assets\/[^/]+\//, ""));
  if (libraryFiles.length > 0) {
    manifest.acquired_files = [
      ...new Set([...manifest.acquired_files, ...libraryFiles]),
    ];
  }
  manifest.requires_media_files = requiresAcquiredMedia(
    acquisition.resolved_visual_mode,
  );

  const layer = acquisition.text_graphic_layer;
  if (acquisition.resolved_visual_mode === "text_graphic") {
    manifest.text_graphic = acquisition.text_graphic;
    manifest.text_graphic_layer = null;
  } else {
    manifest.text_graphic = item.text_graphic;
    manifest.text_graphic_layer = layer ?? null;
  }

  if (acquisition.resolved_visual_mode === "effect_only") {
    manifest.targets = [
      {
        slot: "black_plate",
        description:
          acquisition.notes.trim() ||
          `Effect-only: no media file; effects on ${manifest.background_color}`,
        status:
          (acquisition.effects?.length ?? 0) > 0 ? "acquired" : "needed",
      },
    ];
  } else if (acquisition.resolved_visual_mode === "text_graphic") {
    manifest.targets = [
      {
        slot: "generated",
        description: acquisition.text_graphic?.text ?? item.spoken,
        status: acquisition.status === "complete" ? "acquired" : "needed",
      },
    ];
  } else if (acquiredFiles.length > 0) {
    manifest.targets = manifest.targets.map((t, i) => ({
      ...t,
      status: i === 0 ? "acquired" : t.status,
    }));
  } else if (selectionCount > 0) {
    manifest.targets = manifest.targets.map((t, i) => ({
      ...t,
      status: i === 0 ? "selected" : t.status,
    }));
  }

  if (
    layer?.text?.trim() &&
    acquisition.resolved_visual_mode !== "text_graphic" &&
    acquisition.resolved_visual_mode !== "effect_only"
  ) {
    const overlayTarget = {
      slot: "text_overlay",
      description: `Text layer: ${layer.type} — ${layer.text.slice(0, 80)}`,
      status: "acquired" as const,
    };
    const without = manifest.targets.filter((t) => t.slot !== "text_overlay");
    manifest.targets = [...without, overlayTarget];
  } else {
    manifest.targets = manifest.targets.filter((t) => t.slot !== "text_overlay");
  }

  writeJsonFile(amPath, manifest);
}
