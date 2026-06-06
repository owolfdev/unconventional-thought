import { NextRequest, NextResponse } from "next/server";
import { uploadBufferToLibrary } from "@/lib/media-library";
import type { LibraryKind } from "@/lib/media-library";
import { LIBRARY_KINDS } from "@/lib/media-library";

function parseTags(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return [...new Set(raw.split(/[,;]+/).map((t) => t.trim()).filter(Boolean))];
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files").filter((f) => f instanceof File) as File[];
    const tags = parseTags(formData.get("tags") as string | null);
    const manualNotes = ((formData.get("manual_notes") as string | null) ?? "").trim();
    const kindRaw = (formData.get("kind") as string | null)?.trim() ?? "archive";
    const kind = (LIBRARY_KINDS as readonly string[]).includes(kindRaw)
      ? (kindRaw as LibraryKind)
      : "archive";

    if (files.length === 0) {
      return NextResponse.json({ error: "At least one file required" }, { status: 400 });
    }

    const results = [];
    for (const file of files) {
      if (file.size === 0) continue;
      const buffer = Buffer.from(await file.arrayBuffer());
      const ingest = uploadBufferToLibrary(buffer, file.name, {
        episode_id: "_library",
        cue_id: "_bulk_import",
        source_engine: "bulk-import",
        license: "manual import — verify rights",
        title: file.name,
        kind,
        tags,
        manual_notes: manualNotes,
      });
      results.push({
        filename: ingest.filename,
        id: ingest.id,
        deduplicated: ingest.deduplicated,
        publicUrl: ingest.publicUrl,
        kind: ingest.kind,
      });
    }

    if (results.length === 0) {
      return NextResponse.json({ error: "No valid files to import" }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      imported: results.length,
      deduplicated: results.filter((r) => r.deduplicated).length,
      results,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
