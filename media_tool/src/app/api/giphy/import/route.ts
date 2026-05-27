import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  GIPHY_STICKER_ENGINE,
  acquiredPublicUrl,
  selectionForAcquiredFile,
  updateAcquisitionSelection,
} from "@/lib/acquisition-selection";
import { withoutStickerSelections } from "@/lib/overlay-media";
import { listAcquiredFiles, saveUploadToAcquired } from "@/lib/download-media";
import {
  fetchGiphyGifBytes,
  giphyAcquiredFilename,
} from "@/lib/giphy";
import {
  getAcquiredDir,
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
  const acquiredDir = getAcquiredDir(slug, itemId);
  return { manifest, manifestPath, item, slug, acquiredDir };
}

function uniqueGiphyFilename(acquiredDir: string, giphyId: string): string {
  const base = giphyAcquiredFilename(giphyId);
  if (!fs.existsSync(path.join(acquiredDir, base))) return base;
  let n = 2;
  const stem = base.replace(/\.gif$/i, "");
  while (fs.existsSync(path.join(acquiredDir, `${stem}-${n}.gif`))) {
    n += 1;
  }
  return `${stem}-${n}.gif`;
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
    const { item, slug, acquiredDir, manifestPath: mp } = loadContext(
      manifestPath,
      body.itemId,
    );

    const bytes = await fetchGiphyGifBytes(downloadUrl);
    const filename = uniqueGiphyFilename(acquiredDir, giphyId);
    const saved = saveUploadToAcquired(acquiredDir, filename, bytes);
    const files = listAcquiredFiles(acquiredDir);

    const label = (body.title ?? giphyId).slice(0, 120);
    const selection = selectionForAcquiredFile(
      slug,
      item.id,
      saved.filename,
      GIPHY_STICKER_ENGINE,
      `GIPHY: ${label}`,
      "GIPHY — verify broadcast/editorial rights (giphy.com/terms)",
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
      filename: saved.filename,
      files,
      publicUrl: acquiredPublicUrl(slug, item.id, saved.filename),
      selection,
      acquisitionUpdated,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
