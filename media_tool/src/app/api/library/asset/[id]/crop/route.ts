import { NextRequest, NextResponse } from "next/server";
import { canCropLibraryAsset } from "@/lib/media-library/crop-shared";
import { readAssetMeta } from "@/lib/media-library/ingest";
import { replaceLibraryAssetImage } from "@/lib/media-library/crop";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const meta = readAssetMeta(id);
    if (!meta) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }
    if (!canCropLibraryAsset(meta)) {
      return NextResponse.json(
        { error: "Only static photos can be cropped (not GIF or video)" },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const updated = replaceLibraryAssetImage(id, buffer);

    return NextResponse.json({
      ok: true,
      meta: updated,
      publicUrl: `/media/_library/assets/${updated.id}/${encodeURIComponent(updated.filename)}`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
