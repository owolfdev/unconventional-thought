import { NextRequest, NextResponse } from "next/server";
import {
  deleteRenderEntries,
  listRenderLibrary,
  type RenderListFilter,
} from "@/lib/render-library";
import { episodeNumberFromManifest } from "@/lib/render-launcher";
import { defaultManifestPath, readJsonFile, resolveManifestPath } from "@/lib/paths";
import type { MediaToolManifest } from "@/lib/types";

function readEpisodeNumber(manifestPath: string): string {
  const manifest = readJsonFile<MediaToolManifest>(
    resolveManifestPath(manifestPath),
  );
  return episodeNumberFromManifest(manifest);
}

export async function GET(request: NextRequest) {
  try {
    const manifestPath =
      request.nextUrl.searchParams.get("path") ?? defaultManifestPath();
    const filter = (request.nextUrl.searchParams.get("filter") ??
      "all") as RenderListFilter;
    if (filter !== "all" && filter !== "preview" && filter !== "final") {
      return NextResponse.json({ error: "Invalid filter" }, { status: 400 });
    }

    const episodeNumber = readEpisodeNumber(manifestPath);
    const entries = listRenderLibrary(episodeNumber, filter);
    return NextResponse.json({
      manifestPath,
      episodeNumber,
      filter,
      entries,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      manifestPath?: string;
      filter?: RenderListFilter;
      keys?: string[];
    };

    const manifestPath = body.manifestPath?.trim() || defaultManifestPath();
    const filter = body.filter ?? "all";
    const keys = body.keys ?? [];

    if (keys.length === 0) {
      return NextResponse.json({ error: "No render keys to delete" }, { status: 400 });
    }

    const episodeNumber = readEpisodeNumber(manifestPath);
    const library = listRenderLibrary(episodeNumber, filter);
    const keySet = new Set(keys);
    const toDelete = library.filter((entry) => keySet.has(entry.key));

    if (toDelete.length === 0) {
      return NextResponse.json({ error: "No matching renders" }, { status: 404 });
    }

    const deleted = deleteRenderEntries(toDelete);
    return NextResponse.json({ ok: true, deleted, keys: toDelete.map((e) => e.key) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
