import type { SearchResult } from "./types";

export async function searchYouTube(
  query: string,
  limit = 12,
): Promise<SearchResult[]> {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) return [];

  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: String(Math.min(limit, 15)),
    q: query,
    key,
  });

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params}`,
    { next: { revalidate: 0 } },
  );

  if (!res.ok) {
    throw new Error(`YouTube API error: ${res.status}`);
  }

  const data = (await res.json()) as {
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        description?: string;
        thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
      };
    }>;
  };

  return (data.items ?? [])
    .filter((item) => item.id?.videoId)
    .map((item) => {
      const videoId = item.id!.videoId!;
      return {
        id: `youtube-${videoId}`,
        title: item.snippet?.title ?? videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnail_url:
          item.snippet?.thumbnails?.medium?.url ??
          item.snippet?.thumbnails?.default?.url ??
          "",
        source_page: `https://www.youtube.com/watch?v=${videoId}`,
        license: "YouTube — verify rights before use",
        description: item.snippet?.description,
      };
    });
}
