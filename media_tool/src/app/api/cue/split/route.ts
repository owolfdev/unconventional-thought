import { NextRequest, NextResponse } from "next/server";
import { splitCueInManifest } from "@/lib/cue-split";
import { getFolderStatus } from "@/lib/media-folders";
import { readRemotionPreviewSettings } from "@/lib/remotion-preview";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      manifestPath?: string;
      itemId?: string;
      splitAfterWordIndex?: number;
      copyEditorialToSecondHalf?: boolean;
    };

    const manifestPath = body.manifestPath?.trim();
    const itemId = body.itemId?.trim();
    const splitAfterWordIndex = body.splitAfterWordIndex;

    if (!manifestPath || !itemId || splitAfterWordIndex == null) {
      return NextResponse.json(
        { error: "manifestPath, itemId, and splitAfterWordIndex required" },
        { status: 400 },
      );
    }

    if (!Number.isFinite(splitAfterWordIndex) || splitAfterWordIndex < 0) {
      return NextResponse.json(
        { error: "Invalid splitAfterWordIndex" },
        { status: 400 },
      );
    }

    const result = splitCueInManifest({
      manifestPath,
      itemId,
      splitAfterWordIndex,
      copyEditorialToSecondHalf: body.copyEditorialToSecondHalf !== false,
    });

    const mediaLibrary = getFolderStatus(result.manifest);
    const remotionPreview = readRemotionPreviewSettings(
      result.manifest,
      manifestPath,
    );

    return NextResponse.json({
      ok: true,
      manifestPath,
      manifest: result.manifest,
      acquisition: result.acquisition,
      firstId: result.firstId,
      secondId: result.secondId,
      renames: result.renames,
      mediaLibrary,
      remotionPreview,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
