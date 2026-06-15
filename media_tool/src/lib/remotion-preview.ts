import fs from "fs";
import path from "path";
import type { MediaToolManifest } from "./types";
import {
  getRepoRoot,
  readJsonFile,
  resolveManifestPath,
  writeJsonFile,
} from "./paths";
import { projectSlugFromManifest } from "./media-folders";

export interface RemotionPreviewSettings {
  version: 1;
  showCueOverlay: boolean;
  /** OpenAI/GIPHY sticker + title PNG overlays on plates. */
  showStickerOverlays: boolean;
  updated_at: string;
}

export interface ProjectIndexWithPreview {
  version: 1;
  project: string;
  source_media_search: string;
  item_count: number;
  created_at: string;
  updated_at: string;
  remotion_show_cue_overlay?: boolean;
}

const DEFAULT_SETTINGS: RemotionPreviewSettings = {
  version: 1,
  showCueOverlay: true,
  showStickerOverlays: true,
  updated_at: new Date().toISOString(),
};

export function remotionPreviewSettingsPath(
  manifest: MediaToolManifest,
  manifestPath?: string,
): string {
  if (manifestPath?.trim()) {
    const resolved = resolveManifestPath(manifestPath);
    const episodeDir = path.dirname(path.dirname(resolved));
    return path.join(episodeDir, "preview-settings.json");
  }
  return path.join(
    getRepoRoot(),
    "episodes",
    projectSlugFromManifest(manifest),
    "preview-settings.json",
  );
}

export function readRemotionPreviewSettings(
  manifest: MediaToolManifest,
  manifestPath?: string,
): RemotionPreviewSettings {
  const settingsPath = remotionPreviewSettingsPath(manifest, manifestPath);
  if (fs.existsSync(settingsPath)) {
    const doc = readJsonFile<Partial<RemotionPreviewSettings>>(settingsPath);
    return {
      ...DEFAULT_SETTINGS,
      ...doc,
      showCueOverlay: doc.showCueOverlay !== false,
      showStickerOverlays: doc.showStickerOverlays !== false,
    };
  }
  return { ...DEFAULT_SETTINGS };
}

export type RemotionPreviewPatch = Partial<
  Pick<RemotionPreviewSettings, "showCueOverlay" | "showStickerOverlays">
>;

export function patchRemotionPreviewSettings(
  manifest: MediaToolManifest,
  patch: RemotionPreviewPatch,
  manifestPath?: string,
): RemotionPreviewSettings {
  const current = readRemotionPreviewSettings(manifest, manifestPath);
  const settings: RemotionPreviewSettings = {
    ...current,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  writeJsonFile(
    remotionPreviewSettingsPath(manifest, manifestPath),
    settings,
  );
  return settings;
}

/** @deprecated use patchRemotionPreviewSettings */
export function writeRemotionPreviewSettings(
  manifest: MediaToolManifest,
  showCueOverlay: boolean,
  manifestPath?: string,
): RemotionPreviewSettings {
  return patchRemotionPreviewSettings(
    manifest,
    { showCueOverlay },
    manifestPath,
  );
}
