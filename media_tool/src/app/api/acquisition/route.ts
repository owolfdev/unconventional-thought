import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import {
  acquisitionPathForManifest,
  readJsonFile,
  resolveManifestPath,
  writeJsonFile,
} from "@/lib/paths";
import type { MediaAcquisitionDocument, MediaToolManifest } from "@/lib/types";
import { countCompleted, mergeAcquisition } from "@/lib/acquisition";
import { normalizeAcquisitionDocument } from "@/lib/visual-modes";
import {
  projectSlugFromManifest,
  writeItemToFolder,
} from "@/lib/media-folders";

export async function GET(request: NextRequest) {
  const manifestParam = request.nextUrl.searchParams.get("path");
  if (!manifestParam) {
    return NextResponse.json({ error: "path query required" }, { status: 400 });
  }

  try {
    const acqAbs = acquisitionPathForManifest(manifestParam);
    if (!fs.existsSync(acqAbs)) {
      return NextResponse.json({ exists: false, path: acqAbs });
    }
    const doc = readJsonFile<MediaAcquisitionDocument>(acqAbs);
    return NextResponse.json({ exists: true, path: acqAbs, acquisition: doc });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      manifestPath: string;
      acquisition: MediaAcquisitionDocument;
    };

    if (!body.manifestPath || !body.acquisition) {
      return NextResponse.json(
        { error: "manifestPath and acquisition required" },
        { status: 400 },
      );
    }

    const manifestAbs = resolveManifestPath(body.manifestPath);
    if (!fs.existsSync(manifestAbs)) {
      return NextResponse.json({ error: "Manifest not found" }, { status: 404 });
    }

    const manifest = readJsonFile<MediaToolManifest>(manifestAbs);
    const acqAbs = acquisitionPathForManifest(body.manifestPath);
    const now = new Date().toISOString();

    const doc: MediaAcquisitionDocument = normalizeAcquisitionDocument({
      ...body.acquisition,
      version: 1,
      source_manifest: body.manifestPath,
      episode: manifest.episode,
      updated_at: now,
      item_count: manifest.items.length,
      completed_count: countCompleted(body.acquisition),
    });

    writeJsonFile(acqAbs, doc);

    const projectSlug = projectSlugFromManifest(manifest);
    for (const item of manifest.items) {
      const itemAcq = doc.items[item.id];
      if (itemAcq) {
        writeItemToFolder(
          projectSlug,
          item,
          itemAcq,
          body.manifestPath,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      path: acqAbs,
      acquisition: doc,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Initialize acquisition file from manifest without overwriting existing selections */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { manifestPath: string };
    if (!body.manifestPath) {
      return NextResponse.json({ error: "manifestPath required" }, { status: 400 });
    }

    const manifestAbs = resolveManifestPath(body.manifestPath);
    const manifest = readJsonFile<MediaToolManifest>(manifestAbs);
    const acqAbs = acquisitionPathForManifest(body.manifestPath);

    let existing: MediaAcquisitionDocument | null = null;
    if (fs.existsSync(acqAbs)) {
      existing = readJsonFile<MediaAcquisitionDocument>(acqAbs);
    }

    const doc = mergeAcquisition(manifest, existing, body.manifestPath);
    writeJsonFile(acqAbs, doc);

    return NextResponse.json({ ok: true, path: acqAbs, acquisition: doc });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
