import { NextResponse } from "next/server";
import { ytDlpAvailable } from "@/lib/download-media";
import { getGoogleCseStatus, isGoogleCseConfigured } from "@/lib/google-images-search";
import { readLibraryIndex } from "@/lib/media-library";

export async function GET() {
  const library = readLibraryIndex();
  const googleCseStatus = await getGoogleCseStatus();
  return NextResponse.json({
    googleCseConfigured: isGoogleCseConfigured(),
    googleCseStatus,
    ytDlpAvailable: await ytDlpAvailable(),
    libraryAssetCount: library.asset_count,
  });
}
