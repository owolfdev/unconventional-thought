import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import {
  acquisitionPathForManifest,
  defaultManifestPath,
  readJsonFile,
  resolveManifestPath,
} from "@/lib/paths";
import type {
  ItemAcquisition,
  MediaAcquisitionDocument,
  MediaToolManifest,
} from "@/lib/types";
import { itemAcquisitionFromManifest, mergeAcquisition } from "@/lib/acquisition";
import {
  getFolderStatus,
  itemAcquisitionPath,
  projectSlugFromManifest,
} from "@/lib/media-folders";
import { readRemotionPreviewSettings } from "@/lib/remotion-preview";

export async function GET(request: NextRequest) {
  const manifestParam =
    request.nextUrl.searchParams.get("path") ?? defaultManifestPath();

  try {
    const manifestAbs = resolveManifestPath(manifestParam);
    if (!fs.existsSync(manifestAbs)) {
      return NextResponse.json(
        { error: `Manifest not found: ${manifestAbs}` },
        { status: 404 },
      );
    }

    const manifest = readJsonFile<MediaToolManifest>(manifestAbs);
    const acqAbs = acquisitionPathForManifest(manifestParam);
    let acquisition: MediaAcquisitionDocument | null = null;

    if (fs.existsSync(acqAbs)) {
      acquisition = readJsonFile<MediaAcquisitionDocument>(acqAbs);
    }

    const merged = mergeAcquisition(manifest, acquisition, manifestParam);

    const projectSlug = projectSlugFromManifest(manifest);
    for (const item of manifest.items) {
      const itemAcqPath = itemAcquisitionPath(projectSlug, item.id);
      if (fs.existsSync(itemAcqPath)) {
        merged.items[item.id] = itemAcquisitionFromManifest(
          item,
          readJsonFile<ItemAcquisition>(itemAcqPath),
        );
      }
    }

    const folderStatus = getFolderStatus(manifest);
    const remotionPreview = readRemotionPreviewSettings(
      manifest,
      manifestParam,
    );

    return NextResponse.json({
      manifestPath: manifestParam,
      manifestAbs,
      acquisitionPath: acqAbs,
      manifest,
      acquisition: merged,
      mediaLibrary: folderStatus,
      remotionPreview: {
        showCueOverlay: remotionPreview.showCueOverlay,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
