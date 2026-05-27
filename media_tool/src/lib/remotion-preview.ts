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
    };
  }
  return { ...DEFAULT_SETTINGS };
}

export function writeRemotionPreviewSettings(
  manifest: MediaToolManifest,
  showCueOverlay: boolean,
  manifestPath?: string,
): RemotionPreviewSettings {
  const settings: RemotionPreviewSettings = {
    version: 1,
    showCueOverlay,
    updated_at: new Date().toISOString(),
  };
  writeJsonFile(
    remotionPreviewSettingsPath(manifest, manifestPath),
    settings,
  );
  return settings;
}
