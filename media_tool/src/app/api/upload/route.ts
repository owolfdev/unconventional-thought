import { NextRequest, NextResponse } from "next/server";
import {
  applyLibrarySelectionToCue,
  ingestContextFromCue,
} from "@/lib/cue-library-ingest";
import { LIBRARY_ENGINE } from "@/lib/acquisition-selection";
import { listAcquiredFiles } from "@/lib/download-media";
import { uploadBufferToLibrary } from "@/lib/media-library";
import {
  getAcquiredDir,
  projectSlugFromManifest,
} from "@/lib/media-folders";
import {
  defaultManifestPath,
  readJsonFile,
  resolveManifestPath,
} from "@/lib/paths";
import type { MediaToolManifest } from "@/lib/types";

function loadContext(manifestPath: string, itemId: string) {
  const manifestAbs = resolveManifestPath(manifestPath);
  const manifest = readJsonFile<MediaToolManifest>(manifestAbs);
  const item = manifest.items.find((i) => i.id === itemId);
  if (!item) throw new Error(`Unknown item id: ${itemId}`);
  const slug = projectSlugFromManifest(manifest);
  const acquiredDir = getAcquiredDir(slug, itemId);
  return { manifest, manifestPath, item, slug, acquiredDir };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const itemId = formData.get("itemId");
    const manifestPath =
      (formData.get("manifestPath") as string | null)?.trim() ||
      defaultManifestPath();
    const syncAcquisition = formData.get("syncAcquisition") !== "false";

    if (!itemId || typeof itemId !== "string") {
      return NextResponse.json({ error: "itemId required" }, { status: 400 });
    }

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }

    const { manifest, item, slug, acquiredDir } = loadContext(manifestPath, itemId);
    const buffer = Buffer.from(await file.arrayBuffer());
    const ingest = uploadBufferToLibrary(
      buffer,
      file.name,
      ingestContextFromCue(manifest, item, {
        source_engine: "upload",
        license: "manual upload — verify rights",
        title: file.name,
        kind: "archive",
      }),
    );

    let acquisitionUpdated = false;
    if (syncAcquisition) {
      acquisitionUpdated = applyLibrarySelectionToCue(
        slug,
        item,
        manifestPath,
        ingest,
        {
          engineId: LIBRARY_ENGINE,
          query: `Upload: ${file.name}`,
          license: "manual upload — verify rights",
          title: ingest.filename,
        },
      );
    }

    const files = listAcquiredFiles(acquiredDir);

    return NextResponse.json({
      ok: true,
      filename: ingest.filename,
      libraryId: ingest.id,
      deduplicated: ingest.deduplicated,
      publicUrl: ingest.publicUrl,
      files,
      acquisitionUpdated,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
