import type { SearchResult } from "./types";

const API = "https://commons.wikimedia.org/w/api.php";

function userAgent(): string {
  const contact = process.env.WIKIMEDIA_CONTACT?.trim();
  if (contact) {
    return `media_tool/1.0 (${contact})`;
  }
  return "media_tool/1.0 (local acquisition tool; set WIKIMEDIA_CONTACT)";
}

export async function searchCommons(
  query: string,
  limit = 12,
): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6",
    gsrlimit: String(Math.min(limit, 20)),
    prop: "imageinfo",
    iiprop: "url|thumburl|extmetadata",
    iiurlwidth: "320",
    format: "json",
    origin: "*",
  });

  const res = await fetch(`${API}?${params}`, {
    headers: { "User-Agent": userAgent() },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`Commons API error: ${res.status}`);
  }

  const data = (await res.json()) as {
    query?: { pages?: Record<string, CommonsPage> };
  };

  const pages = data.query?.pages ?? {};
  const results: SearchResult[] = [];

  for (const page of Object.values(pages)) {
    const info = page.imageinfo?.[0];
    if (!info?.url) continue;

    const license =
      info.extmetadata?.LicenseShortName?.value?.replace(/<[^>]+>/g, "") ||
      info.extmetadata?.UsageTerms?.value?.replace(/<[^>]+>/g, "") ||
      "";

    results.push({
      id: `commons-${page.pageid}`,
      title: page.title?.replace(/^File:/, "") ?? "Untitled",
      url: info.url,
      thumbnail_url: info.thumburl ?? info.url,
      source_page: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title ?? "")}`,
      license,
      description: page.title,
    });
  }

  return results;
}

interface CommonsPage {
  pageid: number;
  title?: string;
  imageinfo?: Array<{
    url?: string;
    thumburl?: string;
    extmetadata?: Record<string, { value?: string }>;
  }>;
}
