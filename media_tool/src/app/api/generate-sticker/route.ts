import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import {
  OPENAI_STICKER_ENGINE,
  OPENAI_TITLE_ENGINE,
  acquiredPublicUrl,
  selectionForAcquiredFile,
  updateAcquisitionSelection,
} from "@/lib/acquisition-selection";
import { withoutStickerSelections } from "@/lib/overlay-media";
import { listAcquiredFiles, saveUploadToAcquired } from "@/lib/download-media";
import { generateTransparentPng, type GenerateVariant } from "@/lib/openai-image";
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

function uniqueGeneratedName(
  acquiredDir: string,
  variant: GenerateVariant,
  prompt: string,
): string {
  const hash = createHash("sha256")
    .update(prompt)
    .digest("hex")
    .slice(0, 8);
  const prefix = variant === "title" ? "title" : "sticker";
  const base = `${prefix}-${hash}.png`;
  if (!fs.existsSync(path.join(acquiredDir, base))) return base;
  let n = 2;
  while (fs.existsSync(path.join(acquiredDir, `${prefix}-${hash}-${n}.png`))) {
    n += 1;
  }
  return `${prefix}-${hash}-${n}.png`;
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
    const { item, slug, acquiredDir, manifestPath: mp } = loadContext(
      manifestPath,
      body.itemId,
    );

    const png = await generateTransparentPng(prompt, variant);
    const filename = uniqueGeneratedName(acquiredDir, variant, prompt);
    const saved = saveUploadToAcquired(acquiredDir, filename, png);
    const files = listAcquiredFiles(acquiredDir);

    const engineId =
      variant === "title" ? OPENAI_TITLE_ENGINE : OPENAI_STICKER_ENGINE;
    const selection = selectionForAcquiredFile(
      slug,
      item.id,
      saved.filename,
      engineId,
      `OpenAI ${variant}: ${prompt.slice(0, 120)}`,
      "OpenAI generated — verify editorial use",
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
