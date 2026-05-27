import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import {
  ensureProjectFolders,
  getFolderStatus,
} from "@/lib/media-folders";
import {
  defaultManifestPath,
  readJsonFile,
  resolveManifestPath,
} from "@/lib/paths";
import type { MediaToolManifest } from "@/lib/types";

function loadManifest(pathParam: string | null): {
  manifestPath: string;
  manifest: MediaToolManifest;
} {
  const manifestPath = pathParam?.trim() || defaultManifestPath();
  const manifestAbs = resolveManifestPath(manifestPath);
  if (!fs.existsSync(manifestAbs)) {
    throw new Error(`Manifest not found: ${manifestAbs}`);
  }
  return {
    manifestPath,
    manifest: readJsonFile<MediaToolManifest>(manifestAbs),
  };
}

export async function GET(request: NextRequest) {
  try {
    const pathParam = request.nextUrl.searchParams.get("path");
    const { manifest } = loadManifest(pathParam);
    const status = getFolderStatus(manifest);
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Create public/media/<project>/<itemId>/ with asset_manifest.json + acquired/ */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      manifestPath?: string;
      refreshManifests?: boolean;
    };
    const { manifestPath, manifest } = loadManifest(
      body.manifestPath ?? null,
    );
    const result = ensureProjectFolders(manifest, manifestPath, {
      refreshManifests: body.refreshManifests ?? false,
    });
    const status = getFolderStatus(manifest);
    return NextResponse.json({ ok: true, result, status });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
