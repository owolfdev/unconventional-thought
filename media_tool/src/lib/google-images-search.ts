import type { SearchResult } from "./types";

/** Google Programmable Search — image search (requires API key + search engine ID). */
export async function searchGoogleImages(
  query: string,
  limit = 10,
): Promise<SearchResult[]> {
  const key = process.env.GOOGLE_API_KEY?.trim();
  const cx = process.env.GOOGLE_CSE_ID?.trim();
  if (!key || !cx) return [];

  const params = new URLSearchParams({
    key,
    cx,
    q: query,
    searchType: "image",
    num: String(Math.min(limit, 10)),
    safe: "active",
  });

  const res = await fetch(
    `https://www.googleapis.com/customsearch/v1?${params}`,
    { next: { revalidate: 0 } },
  );

  if (!res.ok) {
    throw new Error(`Google Custom Search error: ${res.status}`);
  }

  const data = (await res.json()) as {
    items?: Array<{
      title?: string;
      link?: string;
      image?: { thumbnailLink?: string; contextLink?: string };
      displayLink?: string;
    }>;
  };

  return (data.items ?? [])
    .filter((item) => item.link)
    .map((item, i) => ({
      id: `google-${i}-${encodeURIComponent(item.link!.slice(0, 40))}`,
      title: item.title ?? item.displayLink ?? "Image",
      url: item.link!,
      thumbnail_url: item.image?.thumbnailLink ?? item.link!,
      source_page: item.image?.contextLink ?? item.link!,
      license: "Google — verify rights before use",
      description: item.displayLink,
    }));
}
