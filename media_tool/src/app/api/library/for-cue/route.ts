import { NextRequest, NextResponse } from "next/server";
import { listLibraryAssetsForCue } from "@/lib/media-library";

export async function GET(request: NextRequest) {
  try {
    const episodeId = request.nextUrl.searchParams.get("episodeId")?.trim();
    const cueId = request.nextUrl.searchParams.get("cueId")?.trim();
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "12");

    if (!episodeId || !cueId) {
      return NextResponse.json(
        { error: "episodeId and cueId required" },
        { status: 400 },
      );
    }

    const assets = listLibraryAssetsForCue(
      episodeId,
      cueId,
      Number.isFinite(limit) ? limit : 12,
    );

    return NextResponse.json({
      episodeId,
      cueId,
      count: assets.length,
      assets,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
