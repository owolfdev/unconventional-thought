import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  assetManifestPath,
  getAcquiredDir,
  itemAcquisitionPath,
  writeItemToFolder,
  type ItemAssetManifest,
} from "@/lib/media-folders";
import {
  engineIdForAcquiredFilename,
  selectionForAcquiredFile,
  updateAcquisitionSelection,
} from "@/lib/acquisition-selection";
import { readJsonFile, resolveManifestPath, writeJsonFile } from "@/lib/paths";
import type { ItemAcquisition, MediaToolManifest } from "@/lib/types";

function safeSegment(value: string): string {
  return path.basename(value.trim());
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      project?: string;
      itemId?: string;
      filename?: string;
      selected?: boolean;
    };

    if (!body.project || !body.itemId || !body.filename) {
      return NextResponse.json(
        { error: "project, itemId, and filename required" },
        { status: 400 },
      );
    }

    const project = safeSegment(body.project);
    const itemId = safeSegment(body.itemId);
    const filename = safeSegment(body.filename);
    const acquiredDir = getAcquiredDir(project, itemId);
    const filePath = path.join(acquiredDir, filename);

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return NextResponse.json(
        { error: `Acquired file not found: ${filename}` },
        { status: 404 },
      );
    }

    const acqPath = itemAcquisitionPath(project, itemId);
    if (!fs.existsSync(acqPath)) {
      return NextResponse.json(
        { error: `Acquisition file not found for ${itemId}` },
        { status: 404 },
      );
    }

    const selection = selectionForAcquiredFile(
      project,
      itemId,
      filename,
      engineIdForAcquiredFilename(filename),
      "Local acquired files",
      "local acquired file - verify rights",
    );

    const acquisition = readJsonFile<ItemAcquisition>(acqPath);
    const updated = updateAcquisitionSelection(
      acquisition,
      selection,
      body.selected === true,
    );

    const amPath = assetManifestPath(project, itemId);
    if (fs.existsSync(amPath)) {
      const assetManifest = readJsonFile<ItemAssetManifest>(amPath);
      const manifest = readJsonFile<MediaToolManifest>(
        resolveManifestPath(assetManifest.source_media_search),
      );
      const item = manifest.items.find((manifestItem) => manifestItem.id === itemId);
      if (item) {
        writeItemToFolder(
          project,
          item,
          updated,
          assetManifest.source_media_search,
        );
      } else {
        writeJsonFile(acqPath, updated);
      }
    } else {
      writeJsonFile(acqPath, updated);
    }

    const selectedUrls = new Set(
      updated.queries.flatMap((query) =>
        query.selections.map((item) => item.url),
      ),
    );

    return NextResponse.json({
      ok: true,
      acquisition: updated,
      selected: selectedUrls.has(selection.url),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
