import { scrapeResultId } from "./ids";
import type { SearchResult } from "@/lib/types";

export interface GoogleImageHit {
  imgUrl: string;
  thumb: string;
  sourcePage: string;
  title: string;
}

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

/** Parse imgurl/imgrefurl pairs from Google Images result links. */
export function parseGoogleImageHrefs(hrefs: string[]): GoogleImageHit[] {
  const hits: GoogleImageHit[] = [];
  const seen = new Set<string>();

  for (const raw of hrefs) {
    const href = raw.startsWith("http") ? raw : `https://www.google.com${raw}`;
    const imgMatch = href.match(/[?&]imgurl=([^&]+)/i);
    if (!imgMatch) continue;

    const imgUrl = decodeParam(imgMatch[1]);
    if (!imgUrl.startsWith("http") || seen.has(imgUrl)) continue;
    seen.add(imgUrl);

    const refMatch = href.match(/[?&]imgrefurl=([^&]+)/i);
    const sourcePage = refMatch ? decodeParam(refMatch[1]) : href;

    hits.push({
      imgUrl,
      thumb: imgUrl,
      sourcePage,
      title: sourcePage,
    });
  }

  return hits;
}

export function mapGoogleImageHits(
  hits: GoogleImageHit[],
  limit: number,
): SearchResult[] {
  return hits.slice(0, limit).map((hit) => ({
    id: scrapeResultId("google", hit.imgUrl),
    title: hit.title || "Image",
    url: hit.imgUrl,
    thumbnail_url: hit.thumb || hit.imgUrl,
    source_page: hit.sourcePage || hit.imgUrl,
    license: "Google — verify rights before use",
    description: hit.sourcePage,
  }));
}
