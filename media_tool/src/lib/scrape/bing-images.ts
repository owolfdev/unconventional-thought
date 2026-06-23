import { withScrapePage, SCRAPE_LIMIT_DEFAULT } from "./browser";
import {
  mapBingImageHits,
  parseBingImageMetadata,
} from "./parse-bing-images";
import type { SearchResult } from "@/lib/types";

const BING_IMAGES_URL = "https://www.bing.com/images/search?q=";

export interface BingScrapeOutcome {
  results: SearchResult[];
  gallerySource: string;
  apiNote?: string;
}

async function isBingBlockedPage(page: import("puppeteer").Page): Promise<boolean> {
  const text = await page.evaluate(() => document.body?.innerText ?? "");
  return /captcha|verify you are human|unusual traffic|automated queries/i.test(
    text,
  );
}

async function collectBingImageHits(
  page: import("puppeteer").Page,
): Promise<ReturnType<typeof parseBingImageMetadata>> {
  if (await isBingBlockedPage(page)) {
    throw new Error("BING_BLOCKED");
  }

  await page
    .waitForSelector("a.iusc, .iusc, img.mimg", { timeout: 15_000 })
    .catch(() => undefined);

  await page.evaluate(() => window.scrollBy(0, 1200));
  await new Promise((resolve) => setTimeout(resolve, 500));

  const metadata = await page.evaluate(() => {
    const blobs: string[] = [];
    document.querySelectorAll("a.iusc, .iusc").forEach((el) => {
      const m = el.getAttribute("m");
      if (m) blobs.push(m);
    });
    return blobs;
  });

  const fromMeta = parseBingImageMetadata(metadata);
  if (fromMeta.length > 0) return fromMeta;

  return page.evaluate(() => {
    const fallback: Array<{
      imgUrl: string;
      thumb: string;
      sourcePage: string;
      title: string;
    }> = [];
    const seen = new Set<string>();

    document.querySelectorAll("img.mimg, a.iusc img").forEach((img) => {
      const src = img.getAttribute("src") ?? "";
      const dataSrc = img.getAttribute("data-src") ?? "";
      const imgUrl = dataSrc.startsWith("http")
        ? dataSrc
        : src.startsWith("http")
          ? src
          : "";
      if (!imgUrl || seen.has(imgUrl)) return;
      seen.add(imgUrl);
      fallback.push({
        imgUrl,
        thumb: src.startsWith("http") ? src : imgUrl,
        sourcePage: imgUrl,
        title: img.getAttribute("alt")?.trim() || "Image",
      });
    });

    return fallback;
  });
}

export async function scrapeBingImages(
  query: string,
  limit = SCRAPE_LIMIT_DEFAULT,
): Promise<BingScrapeOutcome> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { results: [], gallerySource: "Bing Images (scrape)" };
  }

  const url = `${BING_IMAGES_URL}${encodeURIComponent(trimmed)}`;

  try {
    const hits = await withScrapePage({ url, waitForIdleMs: 800 }, (page) =>
      collectBingImageHits(page),
    );
    const results = mapBingImageHits(hits, limit);
    if (results.length > 0) {
      return { results, gallerySource: "Bing Images (scrape)" };
    }
    return {
      results: [],
      gallerySource: "Bing Images (scrape)",
      apiNote:
        "No image URLs extracted. Bing may have changed their page layout — try @search library or a different query.",
    };
  } catch (e) {
    if (e instanceof Error && e.message === "BING_BLOCKED") {
      return {
        results: [],
        gallerySource: "Bing Images (scrape)",
        apiNote:
          "Bing blocked automated access (CAPTCHA). Wait a few minutes or use @search library.",
      };
    }
    throw e;
  }
}
