import { NextRequest, NextResponse } from "next/server";
import { searchCommons } from "@/lib/commons-search";
import {
  GOOGLE_CSE_BLOCKED_HINT,
  getGoogleCseStatus,
  googleCseSetupHint,
  isGoogleCseAccessError,
  isGoogleCseConfigured,
  searchGoogleImages,
} from "@/lib/google-images-search";
import { searchOpenverse } from "@/lib/openverse-search";
import { searchYouTube } from "@/lib/youtube-search";
import { readLibraryIndex, searchLibrary } from "@/lib/media-library";
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
      case "library": {
        results = searchLibrary({ query, limit });
        gallerySource = "Repo library";
        const total = readLibraryIndex().asset_count;
        if (results.length === 0) {
          apiNote =
            total === 0
              ? "Library is empty. New downloads save to _library/. Episode 001 files are still in per-cue acquired/ until migration (Phase 2)."
              : `No library matches (${total} asset${total === 1 ? "" : "s"} indexed). Try different keywords.`;
        }
        break;
      }

      case "commons":
        results = await searchCommons(query, limit);
        gallerySource = "Wikimedia Commons";
        break;

      case "openverse":
        results = await searchOpenverse(query, limit);
        gallerySource = "Openverse";
        break;

      case "google_images": {
        gallerySource = "Google Custom Search";
        if (!isGoogleCseConfigured()) {
          apiNote = googleCseSetupHint();
          break;
        }
        try {
          results = await searchGoogleImages(query, limit);
          if (results.length === 0) {
            apiNote =
              "Google returned no image URLs for this query. Try different keywords or Open in browser ↗.";
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (isGoogleCseAccessError(msg)) {
            results = await searchOpenverse(query, limit);
            gallerySource =
              results.length > 0
                ? "Openverse (Google Images API blocked)"
                : "Google Images (API blocked)";
            apiNote = GOOGLE_CSE_BLOCKED_HINT;
            if (results.length > 0) {
              apiNote += ` Showing ${results.length} Openverse result${results.length === 1 ? "" : "s"} instead.`;
            }
          } else {
            throw e;
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
