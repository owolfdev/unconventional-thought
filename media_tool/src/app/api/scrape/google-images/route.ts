import { NextRequest, NextResponse } from "next/server";
import { SCRAPE_LIMIT_DEFAULT } from "@/lib/scrape/browser";
import { scrapeGoogleImages } from "@/lib/scrape/google-images";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { query?: string; limit?: number };
    const query = body.query?.trim();
    if (!query) {
      return NextResponse.json({ error: "query required" }, { status: 400 });
    }

    const limit = Math.min(
      Math.max(1, body.limit ?? SCRAPE_LIMIT_DEFAULT),
      SCRAPE_LIMIT_DEFAULT,
    );

    const outcome = await scrapeGoogleImages(query, limit);

    return NextResponse.json({
      query,
      count: outcome.results.length,
      gallerySource: outcome.gallerySource,
      results: outcome.results,
      apiNote: outcome.apiNote,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Scrape failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
