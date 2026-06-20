import { withScrapePage, SCRAPE_LIMIT_DEFAULT } from "./browser";
import { mapYouTubeHits, mergeYouTubeHits } from "./parse-youtube";
import type { SearchResult } from "@/lib/types";

const YOUTUBE_SEARCH_URL = "https://www.youtube.com/results?search_query=";

export async function scrapeYouTube(
  query: string,
  limit = SCRAPE_LIMIT_DEFAULT,
): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = `${YOUTUBE_SEARCH_URL}${encodeURIComponent(trimmed)}`;

  const entries = await withScrapePage({ url, waitForIdleMs: 1200 }, async (page) => {
    await page
      .waitForSelector('a[href*="/watch?v="], ytd-video-renderer', {
        timeout: 30_000,
      })
      .catch(() => undefined);

    await page.evaluate(() => window.scrollBy(0, 800));
    await new Promise((resolve) => setTimeout(resolve, 400));

    return page.evaluate(() => {
      const rows: Array<{ href: string; title: string }> = [];

      document
        .querySelectorAll('a[href*="/watch?v="]')
        .forEach((anchor) => {
          const href = anchor.getAttribute("href") ?? "";
          if (!href.includes("watch?v=")) return;

          const titleEl =
            anchor.querySelector("#video-title") ??
            anchor.closest("ytd-video-renderer")?.querySelector("#video-title") ??
            anchor;

          rows.push({
            href,
            title: titleEl.textContent?.trim() ?? "",
          });
        });

      return rows;
    });
  });

  return mapYouTubeHits(mergeYouTubeHits(entries), limit);
}
