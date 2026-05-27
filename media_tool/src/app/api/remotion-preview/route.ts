import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  readRemotionPreviewSettings,
  remotionPreviewSettingsPath,
  writeRemotionPreviewSettings,
  type ProjectIndexWithPreview,
} from "@/lib/remotion-preview";
import { getProjectDir, projectSlugFromManifest } from "@/lib/media-folders";
import {
  defaultManifestPath,
  readJsonFile,
  resolveManifestPath,
  writeJsonFile,
} from "@/lib/paths";
import type { MediaToolManifest } from "@/lib/types";

function loadManifest(manifestPath: string): MediaToolManifest {
  const manifestAbs = resolveManifestPath(manifestPath);
  if (!fs.existsSync(manifestAbs)) {
    throw new Error(`Manifest not found: ${manifestAbs}`);
  }
  return readJsonFile<MediaToolManifest>(manifestAbs);
}

function syncProjectIndex(
  manifest: MediaToolManifest,
  showCueOverlay: boolean,
): void {
  const projectDir = getProjectDir(projectSlugFromManifest(manifest));
  const indexPath = path.join(projectDir, "project.json");
  if (!fs.existsSync(indexPath)) return;
  const index = readJsonFile<ProjectIndexWithPreview>(indexPath);
  index.remotion_show_cue_overlay = showCueOverlay;
  index.updated_at = new Date().toISOString();
  writeJsonFile(indexPath, index);
}

export async function GET(request: NextRequest) {
  try {
    const manifestPath =
      request.nextUrl.searchParams.get("path") ?? defaultManifestPath();
    const manifest = loadManifest(manifestPath);
    const settings = readRemotionPreviewSettings(manifest, manifestPath);
    return NextResponse.json({
      manifestPath,
      showCueOverlay: settings.showCueOverlay,
      settingsPath: remotionPreviewSettingsPath(manifest, manifestPath),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      manifestPath?: string;
      showCueOverlay?: boolean;
    };
    const manifestPath = body.manifestPath?.trim() ?? defaultManifestPath();
    if (typeof body.showCueOverlay !== "boolean") {
      return NextResponse.json(
        { error: "showCueOverlay boolean required" },
        { status: 400 },
      );
    }
    const manifest = loadManifest(manifestPath);
    const settings = writeRemotionPreviewSettings(
      manifest,
      body.showCueOverlay,
      manifestPath,
    );
    syncProjectIndex(manifest, body.showCueOverlay);
    return NextResponse.json({
      ok: true,
      showCueOverlay: settings.showCueOverlay,
      settingsPath: remotionPreviewSettingsPath(manifest, manifestPath),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
