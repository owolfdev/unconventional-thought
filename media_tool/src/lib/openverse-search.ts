import type { SearchResult } from "./types";

/** Openverse — CC-licensed images from museums and the web (free API). */
export async function searchOpenverse(
  query: string,
  limit = 20,
): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    page_size: String(Math.min(limit, 20)),
    page: "1",
  });

  const res = await fetch(`https://api.openverse.org/v1/images/?${params}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`Openverse API error: ${res.status}`);
  }

  const data = (await res.json()) as {
    results?: Array<{
      id: string;
      title?: string | null;
      url?: string;
      thumbnail?: string | null;
      foreign_landing_url?: string;
      license?: string | null;
      license_version?: string | null;
      creator?: string | null;
      source?: string | null;
    }>;
  };

  return (data.results ?? [])
    .filter((item) => item.url)
    .map((item) => {
      const license = [item.license, item.license_version]
        .filter(Boolean)
        .join(" ");
      return {
        id: `openverse-${item.id}`,
        title: item.title?.trim() || item.creator || "Untitled",
        url: item.url!,
        thumbnail_url: item.thumbnail || item.url!,
        source_page: item.foreign_landing_url || item.url!,
        license: license ? `${license} (${item.source ?? "Openverse"})` : "",
        description: item.creator ? `by ${item.creator}` : undefined,
      };
    });
}
