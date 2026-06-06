import type { SearchResult } from "./types";

const CSE_ENDPOINT = "https://www.googleapis.com/customsearch/v1";

let cseAccessCache: "unknown" | "ok" | "blocked" = "unknown";

export type GoogleCseStatus = "not_configured" | "ok" | "blocked";

export const GOOGLE_CSE_BLOCKED_HINT =
  "Google Custom Search JSON API is not available for new Google Cloud projects (403). " +
  "Use Repo library, Wikimedia Commons, or Openverse — or paste image URLs manually. " +
  "Legacy GCP projects may still work.";

export function isGoogleCseConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_API_KEY?.trim() && process.env.GOOGLE_CSE_ID?.trim(),
  );
}

export function isGoogleCseAccessError(message: string): boolean {
  return /403|does not have the access|Custom Search JSON API/i.test(message);
}

export function googleCseSetupHint(): string {
  return (
    "Set GOOGLE_API_KEY and GOOGLE_CSE_ID in media_tool/.env.local " +
    "(Programmable Search Engine with Image search enabled). Restart npm run dev."
  );
}

type CseItem = {
  title?: string;
  link?: string;
  image?: { thumbnailLink?: string; contextLink?: string };
  displayLink?: string;
};

function mapCseItems(items: CseItem[], startIndex: number): SearchResult[] {
  return items
    .filter((item) => item.link)
    .map((item, i) => ({
      id: `google-${startIndex + i}-${encodeURIComponent(item.link!.slice(0, 40))}`,
      title: item.title ?? item.displayLink ?? "Image",
      url: item.link!,
      thumbnail_url: item.image?.thumbnailLink ?? item.link!,
      source_page: item.image?.contextLink ?? item.link!,
      license: "Google — verify rights before use",
      description: item.displayLink,
    }));
}

async function fetchGoogleImagesPage(
  query: string,
  start: number,
  num: number,
): Promise<SearchResult[]> {
  const key = process.env.GOOGLE_API_KEY!.trim();
  const cx = process.env.GOOGLE_CSE_ID!.trim();

  const params = new URLSearchParams({
    key,
    cx,
    q: query,
    searchType: "image",
    num: String(Math.min(num, 10)),
    start: String(start),
    safe: "active",
  });

  const res = await fetch(`${CSE_ENDPOINT}?${params}`, {
    next: { revalidate: 0 },
  });

  const data = (await res.json()) as {
    items?: CseItem[];
    error?: { message?: string; code?: number };
  };

  if (!res.ok) {
    const detail = data.error?.message ?? res.statusText;
    throw new Error(`Google Custom Search error (${res.status}): ${detail}`);
  }

  return mapCseItems(data.items ?? [], start - 1);
}

/** Probe once per dev-server process whether CSE JSON API accepts requests. */
export async function getGoogleCseStatus(): Promise<GoogleCseStatus> {
  if (!isGoogleCseConfigured()) return "not_configured";
  if (cseAccessCache === "ok") return "ok";
  if (cseAccessCache === "blocked") return "blocked";

  try {
    await fetchGoogleImagesPage("ac dc", 1, 1);
    cseAccessCache = "ok";
    return "ok";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isGoogleCseAccessError(msg)) {
      cseAccessCache = "blocked";
      return "blocked";
    }
    cseAccessCache = "blocked";
    return "blocked";
  }
}

/** Google Programmable Search — returns direct image URLs (not HTML). */
export async function searchGoogleImages(
  query: string,
  limit = 20,
): Promise<SearchResult[]> {
  if (!isGoogleCseConfigured()) return [];

  const capped = Math.min(Math.max(limit, 1), 20);
  const out: SearchResult[] = [];

  for (let start = 1; start <= 91 && out.length < capped; start += 10) {
    const pageSize = Math.min(10, capped - out.length);
    const page = await fetchGoogleImagesPage(query, start, pageSize);
    out.push(...page);
    if (page.length < pageSize) break;
  }

  return out.slice(0, capped);
}
