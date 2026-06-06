import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import {
  OPENAI_STICKER_ENGINE,
  OPENAI_TITLE_ENGINE,
  selectionForLibraryAsset,
  updateAcquisitionSelection,
} from "@/lib/acquisition-selection";
import { ingestContextFromCue } from "@/lib/cue-library-ingest";
import { withoutStickerSelections } from "@/lib/overlay-media";
import { generateTransparentPng, type GenerateVariant } from "@/lib/openai-image";
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

function generatedFilename(variant: GenerateVariant, prompt: string): string {
  const hash = createHash("sha256")
    .update(prompt)
    .digest("hex")
    .slice(0, 8);
  const prefix = variant === "title" ? "title" : "sticker";
  return `${prefix}-${hash}.png`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      manifestPath?: string;
      itemId?: string;
      prompt?: string;
      variant?: GenerateVariant;
      autoSelect?: boolean;
    };

    const prompt = body.prompt?.trim();
    if (!prompt) {
      return NextResponse.json({ error: "prompt required" }, { status: 400 });
    }
    if (!body.itemId) {
      return NextResponse.json({ error: "itemId required" }, { status: 400 });
    }

    const variant: GenerateVariant =
      body.variant === "title" ? "title" : "sticker";
    const manifestPath = body.manifestPath?.trim() || defaultManifestPath();
    const { manifest, item, slug, manifestPath: mp } = loadContext(
      manifestPath,
      body.itemId,
    );

    const png = await generateTransparentPng(prompt, variant);
    const filename = generatedFilename(variant, prompt);
    const engineId =
      variant === "title" ? OPENAI_TITLE_ENGINE : OPENAI_STICKER_ENGINE;

    const ingest = uploadBufferToLibrary(
      png,
      filename,
      ingestContextFromCue(manifest, item, {
        source_engine: engineId,
        license: "OpenAI generated — verify editorial use",
        title: prompt.slice(0, 120),
        kind: "overlay",
        tags: [variant, "openai"],
        manual_notes: prompt,
      }),
    );

    const selection = selectionForLibraryAsset(
      ingest.id,
      ingest.filename,
      ingest.publicUrl,
      engineId,
      `OpenAI ${variant}: ${prompt.slice(0, 120)}`,
      "OpenAI generated — verify editorial use",
      prompt.slice(0, 120),
    );

    let acquisitionUpdated = false;
    if (body.autoSelect !== false) {
      const acqPath = path.join(getItemDir(slug, item.id), "acquisition.json");
      if (fs.existsSync(acqPath)) {
        const acq = readJsonFile<ItemAcquisition>(acqPath);
        const base =
          variant === "sticker" ? withoutStickerSelections(acq) : acq;
        const updated = updateAcquisitionSelection(base, selection, true);
        writeItemToFolder(slug, item, updated, mp);
        acquisitionUpdated = true;
      }
    }

    return NextResponse.json({
      ok: true,
      variant,
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
