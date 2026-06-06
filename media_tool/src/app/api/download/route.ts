import { NextRequest, NextResponse } from "next/server";
import { isYouTubeUrl, listAcquiredFiles, ytDlpAvailable } from "@/lib/download-media";
import {
  applyLibrarySelectionToCue,
  ingestContextFromCue,
} from "@/lib/cue-library-ingest";
import { LIBRARY_ENGINE } from "@/lib/acquisition-selection";
import { downloadUrlToLibrary } from "@/lib/media-library";
import {
  getAcquiredDir,
  projectSlugFromManifest,
} from "@/lib/media-folders";
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
  const acquiredDir = getAcquiredDir(slug, itemId);
  return { manifest, manifestPath, item, slug, acquiredDir };
}

export async function GET(request: NextRequest) {
  try {
    const manifestPath =
      request.nextUrl.searchParams.get("path") ?? defaultManifestPath();
    const itemId = request.nextUrl.searchParams.get("itemId");
    if (!itemId) {
      return NextResponse.json({ error: "itemId required" }, { status: 400 });
    }
    const { acquiredDir } = loadContext(manifestPath, itemId);
    const files = listAcquiredFiles(acquiredDir);
    const ytdlp = await ytDlpAvailable();
    return NextResponse.json({
      files,
      acquiredDir,
      ytDlpAvailable: ytdlp,
      libraryEnabled: true,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      manifestPath?: string;
      itemId: string;
      url: string;
      syncAcquisition?: boolean;
      title?: string;
      license?: string;
      sourceEngine?: string;
      searchQuery?: string;
      queryIndex?: number;
    };

    if (!body.itemId || !body.url?.trim()) {
      return NextResponse.json(
        { error: "itemId and url required" },
        { status: 400 },
      );
    }

    const manifestPath = body.manifestPath?.trim() || defaultManifestPath();
    const { manifest, item, slug } = loadContext(manifestPath, body.itemId);

    const url = body.url.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    if (isYouTubeUrl(url) && !(await ytDlpAvailable())) {
      return NextResponse.json(
        {
          error:
            "yt-dlp is not installed. Run: brew install yt-dlp  (or pip install yt-dlp), then retry.",
        },
        { status: 503 },
      );
    }

    const ingest = await downloadUrlToLibrary(
      url,
      ingestContextFromCue(manifest, item, {
        source_url: url,
        source_engine: body.sourceEngine ?? "download",
        license: body.license ?? "verify rights before use",
        title: body.title,
        search_queries: body.searchQuery
          ? [body.searchQuery]
          : item.search_queries,
        kind: "archive",
      }),
    );

    let acquisitionUpdated = false;
    if (body.syncAcquisition !== false) {
      acquisitionUpdated = applyLibrarySelectionToCue(
        slug,
        item,
        manifestPath,
        ingest,
        {
          engineId: body.sourceEngine ?? LIBRARY_ENGINE,
          query: body.searchQuery ?? body.title ?? url,
          license: body.license ?? "verify rights before use",
          title: body.title ?? ingest.filename,
          queryIndex:
            typeof body.queryIndex === "number" ? body.queryIndex : 0,
        },
      );
    }

    return NextResponse.json({
      ok: true,
      filename: ingest.filename,
      libraryId: ingest.id,
      deduplicated: ingest.deduplicated,
      publicUrl: ingest.publicUrl,
      acquisitionUpdated,
      selected: acquisitionUpdated,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
