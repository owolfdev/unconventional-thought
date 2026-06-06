import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  GIPHY_STICKER_ENGINE,
  selectionForLibraryAsset,
  updateAcquisitionSelection,
} from "@/lib/acquisition-selection";
import { ingestContextFromCue } from "@/lib/cue-library-ingest";
import { withoutStickerSelections } from "@/lib/overlay-media";
import {
  fetchGiphyGifBytes,
  giphyAcquiredFilename,
} from "@/lib/giphy";
import { uploadBufferToLibrary } from "@/lib/media-library";
import {
  getItemDir,
  projectSlugFromManifest,
  writeItemToFolder,
} from "@/lib/media-folders";
import {
  defaultManifestPath,
  readJsonFile,
  resolveManifestPath,
} from "@/lib/paths";
import type { ItemAcquisition, MediaToolManifest } from "@/lib/types";

function loadContext(manifestPath: string, itemId: string) {
  const manifestAbs = resolveManifestPath(manifestPath);
  const manifest = readJsonFile<MediaToolManifest>(manifestAbs);
  const item = manifest.items.find((i) => i.id === itemId);
  if (!item) throw new Error(`Unknown item id: ${itemId}`);
  const slug = projectSlugFromManifest(manifest);
  return { manifest, manifestPath, item, slug };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      manifestPath?: string;
      itemId?: string;
      giphyId?: string;
      downloadUrl?: string;
      title?: string;
      autoSelect?: boolean;
    };

    const giphyId = body.giphyId?.trim();
    const downloadUrl = body.downloadUrl?.trim();
    if (!giphyId || !downloadUrl) {
      return NextResponse.json(
        { error: "giphyId and downloadUrl required" },
        { status: 400 },
      );
    }
    if (!body.itemId) {
      return NextResponse.json({ error: "itemId required" }, { status: 400 });
    }

    const manifestPath = body.manifestPath?.trim() || defaultManifestPath();
    const { manifest, item, slug, manifestPath: mp } = loadContext(
      manifestPath,
      body.itemId,
    );

    const bytes = await fetchGiphyGifBytes(downloadUrl);
    const filename = giphyAcquiredFilename(giphyId);
    const label = (body.title ?? giphyId).slice(0, 120);
    const ingest = uploadBufferToLibrary(
      bytes,
      filename,
      ingestContextFromCue(manifest, item, {
        source_url: downloadUrl,
        source_engine: GIPHY_STICKER_ENGINE,
        license: "GIPHY — verify broadcast/editorial rights (giphy.com/terms)",
        title: label,
        kind: "overlay",
        tags: ["giphy", giphyId],
      }),
    );

    const selection = selectionForLibraryAsset(
      ingest.id,
      ingest.filename,
      ingest.publicUrl,
      GIPHY_STICKER_ENGINE,
      `GIPHY: ${label}`,
      "GIPHY — verify broadcast/editorial rights (giphy.com/terms)",
      label,
    );

    let acquisitionUpdated = false;
    if (body.autoSelect !== false) {
      const acqPath = path.join(getItemDir(slug, item.id), "acquisition.json");
      if (fs.existsSync(acqPath)) {
        const acq = readJsonFile<ItemAcquisition>(acqPath);
        const cleared = withoutStickerSelections(acq);
        const updated = updateAcquisitionSelection(cleared, selection, true);
        writeItemToFolder(slug, item, updated, mp);
        acquisitionUpdated = true;
      }
    }

    return NextResponse.json({
      ok: true,
      giphyId,
      filename: ingest.filename,
      libraryId: ingest.id,
      publicUrl: ingest.publicUrl,
      selection,
      acquisitionUpdated,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
