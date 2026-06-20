import {
  isGoogleBlockedPage,
  withScrapePage,
  SCRAPE_LIMIT_DEFAULT,
} from "./browser";
import {
  GOOGLE_CSE_BLOCKED_HINT,
  getGoogleCseStatus,
  isGoogleCseAccessError,
  isGoogleCseConfigured,
  searchGoogleImages,
} from "@/lib/google-images-search";
import {
  mapGoogleImageHits,
  parseGoogleImageHrefs,
  type GoogleImageHit,
} from "./parse-google-images";
import type { SearchResult } from "@/lib/types";

const GOOGLE_IMAGES_URL =
  "https://www.google.com/search?tbm=isch&hl=en&safe=active&q=";

export interface GoogleScrapeOutcome {
  results: SearchResult[];
  gallerySource: string;
  apiNote?: string;
}

async function collectGoogleImageHits(
  page: import("puppeteer").Page,
): Promise<GoogleImageHit[]> {
  if (await isGoogleBlockedPage(page)) {
    throw new Error("GOOGLE_BLOCKED");
  }

  await page
    .waitForSelector('a[href*="imgres"], a[href*="imgurl="], img[src^="http"]', {
      timeout: 15_000,
    })
    .catch(() => undefined);

  await page.evaluate(() => window.scrollBy(0, 1200));
  await new Promise((resolve) => setTimeout(resolve, 400));

  const hrefs = await page.evaluate(() => {
    const links: string[] = [];
    document
      .querySelectorAll('a[href*="imgres"], a[href*="imgurl="]')
      .forEach((anchor) => {
        const href = anchor.getAttribute("href");
        if (href) links.push(href);
      });
    return links;
  });

  const fromLinks = parseGoogleImageHrefs(hrefs);
  if (fromLinks.length > 0) return fromLinks;

  return page.evaluate(() => {
    const fallback: GoogleImageHit[] = [];
    const seen = new Set<string>();

    document.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src") ?? "";
      if (
        !src.startsWith("http") ||
        src.includes("gstatic.com/images") ||
        src.includes("google.com/images/branding")
      ) {
        return;
      }
      if (seen.has(src)) return;
      seen.add(src);
      fallback.push({
        imgUrl: src,
        thumb: src,
        sourcePage: src,
        title: img.alt?.trim() || "Image",
      });
    });

    return fallback;
  });
}

async function scrapeViaBrowser(
  query: string,
  limit: number,
): Promise<SearchResult[]> {
  const url = `${GOOGLE_IMAGES_URL}${encodeURIComponent(query)}`;
  const hits = await withScrapePage({ url, waitForIdleMs: 800 }, (page) =>
    collectGoogleImageHits(page),
  );
  return mapGoogleImageHits(hits, limit);
}

const CAPTCHA_NOTE =
  "Google blocked automated image search (CAPTCHA). Try again later, use @search library, or paste a direct image URL in legacy UI.";

async function tryCseFallback(
  query: string,
  limit: number,
  scrapeNote: string,
): Promise<GoogleScrapeOutcome | null> {
  if (!isGoogleCseConfigured()) return null;

  const status = await getGoogleCseStatus();
  if (status === "blocked") {
    return {
      results: [],
      gallerySource: "Google Images (scrape)",
      apiNote: `${scrapeNote} ${GOOGLE_CSE_BLOCKED_HINT}`,
    };
  }
  if (status !== "ok") return null;

  try {
    const fallback = await searchGoogleImages(query, limit);
    if (fallback.length > 0) {
      return {
        results: fallback,
        gallerySource: "Google Custom Search (fallback)",
        apiNote: `${scrapeNote} Showing Custom Search API results.`,
      };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isGoogleCseAccessError(msg)) {
      return {
        results: [],
        gallerySource: "Google Images (scrape)",
        apiNote: `${scrapeNote} ${GOOGLE_CSE_BLOCKED_HINT}`,
      };
    }
    throw e;
  }

  return null;
}

export async function scrapeGoogleImages(
  query: string,
  limit = SCRAPE_LIMIT_DEFAULT,
): Promise<GoogleScrapeOutcome> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { results: [], gallerySource: "Google Images (scrape)" };
  }

  try {
    const results = await scrapeViaBrowser(trimmed, limit);
    if (results.length > 0) {
      return {
        results,
        gallerySource: "Google Images (scrape)",
      };
    }
  } catch (e) {
    const blocked = e instanceof Error && e.message === "GOOGLE_BLOCKED";
    if (blocked) {
      const fallback = await tryCseFallback(
        trimmed,
        limit,
        "Scraper hit CAPTCHA.",
      );
      if (fallback) return fallback;
      return {
        results: [],
        gallerySource: "Google Images (scrape)",
        apiNote: CAPTCHA_NOTE,
      };
    }

    throw e;
  }

  const emptyFallback = await tryCseFallback(
    trimmed,
    limit,
    "Scraper returned no image URLs.",
  );
  if (emptyFallback) return emptyFallback;

  return {
    results: [],
    gallerySource: "Google Images (scrape)",
    apiNote:
      "No image URLs extracted. Google may have changed their page layout — try @search library or a different query.",
  };
}
