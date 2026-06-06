import { NextRequest, NextResponse } from "next/server";
import { stageLibraryAssetOnCue } from "@/lib/cue-library-ingest";
import { projectSlugFromManifest } from "@/lib/media-folders";
import {
  defaultManifestPath,
  readJsonFile,
  resolveManifestPath,
} from "@/lib/paths";
import type { MediaToolManifest } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      manifestPath?: string;
      itemId?: string;
      libraryId?: string;
      queryIndex?: number;
      searchQuery?: string;
      selected?: boolean;
    };

    if (!body.itemId?.trim() || !body.libraryId?.trim()) {
      return NextResponse.json(
        { error: "itemId and libraryId required" },
        { status: 400 },
      );
    }

    const manifestPath = body.manifestPath?.trim() || defaultManifestPath();
    const manifestAbs = resolveManifestPath(manifestPath);
    const manifest = readJsonFile<MediaToolManifest>(manifestAbs);
    const item = manifest.items.find((i) => i.id === body.itemId);
    if (!item) {
      return NextResponse.json(
        { error: `Unknown item id: ${body.itemId}` },
        { status: 404 },
      );
    }

    const slug = projectSlugFromManifest(manifest);
    const updated = stageLibraryAssetOnCue(
      slug,
      item,
      manifestPath,
      body.libraryId.trim(),
      {
        queryIndex:
          typeof body.queryIndex === "number" ? body.queryIndex : 0,
        query: body.searchQuery,
        selected: body.selected !== false,
      },
    );

    if (!updated) {
      return NextResponse.json(
        { error: `Library asset not found: ${body.libraryId}` },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      selected: body.selected !== false,
      acquisition: updated,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
