import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  downloadToAcquired,
  isYouTubeUrl,
  listAcquiredFiles,
  ytDlpAvailable,
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
import type {
  ItemAcquisition,
  MediaToolManifest,
} from "@/lib/types";

function loadContext(manifestPath: string, itemId: string) {
  const manifestAbs = resolveManifestPath(manifestPath);
  const manifest = readJsonFile<MediaToolManifest>(manifestAbs);
  const item = manifest.items.find((i) => i.id === itemId);
  if (!item) throw new Error(`Unknown item id: ${itemId}`);
  const slug = projectSlugFromManifest(manifest);
  const acquiredDir = getAcquiredDir(slug, itemId);
  const itemDir = getItemDir(slug, itemId);
  return { manifest, manifestPath, item, slug, acquiredDir, itemDir };
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
    return NextResponse.json({ files, acquiredDir, ytDlpAvailable: ytdlp });
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
    };

    if (!body.itemId || !body.url?.trim()) {
      return NextResponse.json(
        { error: "itemId and url required" },
        { status: 400 },
      );
    }

    const manifestPath = body.manifestPath?.trim() || defaultManifestPath();
    const { item, slug, acquiredDir } = loadContext(
      manifestPath,
      body.itemId,
    );

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

    const result = await downloadToAcquired(url, acquiredDir);
    const files = listAcquiredFiles(acquiredDir);

    if (body.syncAcquisition !== false) {
      const acqPath = path.join(
        getItemDir(slug, item.id),
        "acquisition.json",
      );
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
