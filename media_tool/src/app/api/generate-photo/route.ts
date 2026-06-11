import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { OPENAI_PHOTO_ENGINE } from "@/lib/acquisition-selection";
import {
  applyLibrarySelectionToCue,
  ingestContextFromCue,
} from "@/lib/cue-library-ingest";
import { generatePhotorealImage } from "@/lib/openai-image";
import { uploadBufferToLibrary } from "@/lib/media-library";
import { projectSlugFromManifest } from "@/lib/media-folders";
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
  return { manifest, manifestPath, item, slug };
}

function generatedPhotoFilename(prompt: string): string {
  const hash = createHash("sha256").update(prompt).digest("hex").slice(0, 8);
  return `genphoto-${hash}.jpg`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      manifestPath?: string;
      itemId?: string;
      prompt?: string;
      autoSelect?: boolean;
    };

    const prompt = body.prompt?.trim();
    if (!prompt) {
      return NextResponse.json({ error: "prompt required" }, { status: 400 });
    }
    if (!body.itemId) {
      return NextResponse.json({ error: "itemId required" }, { status: 400 });
    }

    const manifestPath = body.manifestPath?.trim() || defaultManifestPath();
    const { manifest, item, slug, manifestPath: mp } = loadContext(
      manifestPath,
      body.itemId,
    );

    const jpeg = await generatePhotorealImage(prompt);
    const filename = generatedPhotoFilename(prompt);

    const ingest = uploadBufferToLibrary(
      jpeg,
      filename,
      ingestContextFromCue(manifest, item, {
        source_engine: OPENAI_PHOTO_ENGINE,
        license: "OpenAI generated — verify editorial use",
        title: prompt.slice(0, 120),
        kind: "generated",
        tags: ["openai", "photo", "generated"],
        manual_notes: prompt,
      }),
    );

    let acquisitionUpdated = false;
    if (body.autoSelect !== false) {
      acquisitionUpdated = applyLibrarySelectionToCue(
        slug,
        item,
        mp,
        ingest,
        {
          engineId: OPENAI_PHOTO_ENGINE,
          query: `OpenAI photo: ${prompt.slice(0, 120)}`,
          license: "OpenAI generated — verify editorial use",
          title: prompt.slice(0, 120),
        },
      );
    }

    return NextResponse.json({
      ok: true,
      filename: ingest.filename,
      libraryId: ingest.id,
      publicUrl: ingest.publicUrl,
      acquisitionUpdated,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
