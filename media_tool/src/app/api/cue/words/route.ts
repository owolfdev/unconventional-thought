import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import {
  getCueSplitPreview,
  loadTranscriptWords,
  previewCueSplit,
  wordsInCueRange,
} from "@/lib/cue-split";
import { readJsonFile, resolveManifestPath } from "@/lib/paths";
import type { MediaToolManifest } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const manifestPath = request.nextUrl.searchParams.get("path")?.trim();
    const itemId = request.nextUrl.searchParams.get("itemId")?.trim();
    const splitAfter = request.nextUrl.searchParams.get("splitAfter");

    if (!manifestPath || !itemId) {
      return NextResponse.json(
        { error: "path and itemId required" },
        { status: 400 },
      );
    }

    const manifestAbs = resolveManifestPath(manifestPath);
    if (!fs.existsSync(manifestAbs)) {
      return NextResponse.json({ error: "Manifest not found" }, { status: 404 });
    }

    const manifest = readJsonFile<MediaToolManifest>(manifestAbs);
    const itemIndex = manifest.items.findIndex((it) => it.id === itemId);
    if (itemIndex < 0) {
      return NextResponse.json({ error: `Cue not found: ${itemId}` }, { status: 404 });
    }

    const item = manifest.items[itemIndex];
    const words = loadTranscriptWords(manifestPath, manifest);
    const preview = getCueSplitPreview(item, words);

    let splitPreview = null;
    if (splitAfter != null && splitAfter !== "") {
      const idx = Number.parseInt(splitAfter, 10);
      if (Number.isFinite(idx)) {
        splitPreview = previewCueSplit(item, words, idx, itemIndex);
        splitPreview.renames = [
          ...buildRenamesForPreview(manifest.items, itemIndex),
        ];
      }
    }

    return NextResponse.json({
      itemId,
      itemIndex,
      t_start: item.t_start,
      t_end: item.t_end,
      spoken: item.spoken,
      cueWords: wordsInCueRange(words, item.t_start, item.t_end),
      alignedWords: preview.alignedWords,
      canSplit: preview.canSplit,
      reason: preview.reason,
      splitPreview,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildRenamesForPreview(
  items: MediaToolManifest["items"],
  itemIndex: number,
): Array<{ from: string; to: string }> {
  const renames: Array<{ from: string; to: string }> = [];
  for (let oldIdx = itemIndex + 1; oldIdx < items.length; oldIdx += 1) {
    const oldId = items[oldIdx].id;
    const newId = `m${String(oldIdx + 1).padStart(3, "0")}`;
    if (oldId !== newId) renames.push({ from: oldId, to: newId });
  }
  return renames;
}
