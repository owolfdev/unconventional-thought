import { scrapeResultId } from "./ids";
import type { SearchResult } from "@/lib/types";

export interface BingImageHit {
  imgUrl: string;
  thumb: string;
  sourcePage: string;
  title: string;
}

/** Parse Bing `a.iusc` metadata JSON blobs (m attribute). */
export function parseBingImageMetadata(rawEntries: string[]): BingImageHit[] {
  const hits: BingImageHit[] = [];
  const seen = new Set<string>();

  for (const raw of rawEntries) {
    try {
      const data = JSON.parse(raw) as {
        murl?: string;
        turl?: string;
        purl?: string;
        t?: string;
        desc?: string;
      };
      const imgUrl = data.murl?.trim();
      if (!imgUrl?.startsWith("http") || seen.has(imgUrl)) continue;
      seen.add(imgUrl);

      hits.push({
        imgUrl,
        thumb: data.turl?.trim() || imgUrl,
        sourcePage: data.purl?.trim() || imgUrl,
        title: (data.t || data.desc || data.purl || "Image").trim(),
      });
    } catch {
      // skip malformed blob
    }
  }

  return hits;
}

export function mapBingImageHits(
  hits: BingImageHit[],
  limit: number,
): SearchResult[] {
  return hits.slice(0, limit).map((hit) => ({
    id: scrapeResultId("bing", hit.imgUrl),
    title: hit.title || "Image",
    url: hit.imgUrl,
    thumbnail_url: hit.thumb || hit.imgUrl,
    source_page: hit.sourcePage || hit.imgUrl,
    license: "Bing — verify rights before use",
    description: hit.sourcePage,
  }));
}
