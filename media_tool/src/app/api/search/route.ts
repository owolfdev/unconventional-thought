import { NextRequest, NextResponse } from "next/server";
import { searchCommons } from "@/lib/commons-search";
import { searchGoogleImages } from "@/lib/google-images-search";
import { searchOpenverse } from "@/lib/openverse-search";
import { searchYouTube } from "@/lib/youtube-search";
import { buildSearchUrl, getEngine } from "@/lib/search-engines";
import type { SearchResult } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      engineId: string;
      query: string;
      engineUrl?: string;
      limit?: number;
    };

    const query = body.query?.trim();
    if (!query) {
      return NextResponse.json({ error: "query required" }, { status: 400 });
    }

    const engine = getEngine(body.engineId ?? "commons");
    const searchUrl = buildSearchUrl(
      body.engineUrl?.trim() || engine.urlTemplate,
      query,
    );
    const limit = body.limit ?? 20;

    let results: SearchResult[] = [];
    let gallerySource = engine.label;
    let apiNote: string | undefined;

    switch (engine.id) {
      case "commons":
        results = await searchCommons(query, limit);
        gallerySource = "Wikimedia Commons";
        break;

      case "openverse":
        results = await searchOpenverse(query, limit);
        gallerySource = "Openverse";
        break;

      case "google_images": {
        const google = await searchGoogleImages(query, limit);
        if (google.length > 0) {
          results = google;
          gallerySource = "Google Custom Search";
        } else {
          results = await searchOpenverse(query, limit);
          gallerySource = "Openverse";
          if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID) {
            apiNote = "Google returned no images; showing Openverse results.";
          } else {
            apiNote =
              "In-app gallery uses Openverse (not Google scrape). For true Google Images, set GOOGLE_API_KEY and GOOGLE_CSE_ID in .env.local.";
          }
        }
        break;
      }

      case "youtube":
        results = await searchYouTube(query, limit);
        gallerySource = "YouTube";
        if (results.length === 0 && !process.env.YOUTUBE_API_KEY) {
          apiNote =
            "No in-app video results — set YOUTUBE_API_KEY or use Open in browser + Add URL.";
        }
        break;

      default:
        apiNote =
          "No in-app gallery for this engine. Use Open in browser, then Add URL below.";
    }

    if (results.length === 0 && !apiNote) {
      apiNote = "No results — try different keywords or another engine.";
    }

    return NextResponse.json({
      engineId: engine.id,
      searchUrl,
      results,
      gallerySource,
      supportsGallery: engine.supportsGallery,
      apiNote,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
