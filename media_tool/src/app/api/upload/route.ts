import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  listAcquiredFiles,
  saveUploadToAcquired,
} from "@/lib/download-media";
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

    const { item, slug, acquiredDir } = loadContext(manifestPath, itemId);
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = saveUploadToAcquired(acquiredDir, file.name, buffer);
    const files = listAcquiredFiles(acquiredDir);

    if (syncAcquisition) {
      const acqPath = path.join(getItemDir(slug, item.id), "acquisition.json");
      if (fs.existsSync(acqPath)) {
        const acq = readJsonFile<ItemAcquisition>(acqPath);
        writeItemToFolder(slug, item, acq, manifestPath);
      }
    }

    return NextResponse.json({
      ok: true,
      ...result,
      files,
      publicUrl: `/media/${slug}/${item.id}/acquired/${result.filename}`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
