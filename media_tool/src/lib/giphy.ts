const GIPHY_API = "https://api.giphy.com/v1/gifs";

export type GiphyStickerHit = {
  id: string;
  title: string;
  /** Static thumb for the grid (still frame). */
  stillPreviewUrl: string;
  /** Looped GIF for hover preview in the gallery. */
  animatedPreviewUrl: string;
  downloadUrl: string;
  width: number;
  height: number;
};

type GiphyImageRendition = {
  url?: string;
  width?: string;
  height?: string;
};

type GiphyGif = {
  id: string;
  title?: string;
  images?: Record<string, GiphyImageRendition>;
};

function apiKey(): string {
  const key = process.env.GIPHY_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "GIPHY_API_KEY is not set. Add it to media_tool/.env.local to search GIPHY.",
    );
  }
  return key;
}

function pickRendition(images: GiphyGif["images"]): GiphyImageRendition | null {
  if (!images) return null;
  return (
    images.downsized_medium ??
    images.fixed_height ??
    images.downsized ??
    images.original ??
    null
  );
}

function toHit(gif: GiphyGif): GiphyStickerHit | null {
  const rendition = pickRendition(gif.images);
  const downloadUrl = rendition?.url?.trim();
  if (!downloadUrl) return null;

  const still =
    gif.images?.fixed_height_still?.url?.trim() ??
    gif.images?.fixed_width_still?.url?.trim() ??
    gif.images?.fixed_height?.url?.trim() ??
    downloadUrl;

  const animated =
    gif.images?.preview_gif?.url?.trim() ??
    gif.images?.downsized?.url?.trim() ??
    downloadUrl;

  return {
    id: gif.id,
    title: (gif.title ?? "").trim() || gif.id,
    stillPreviewUrl: still,
    animatedPreviewUrl: animated,
    downloadUrl,
    width: Number(rendition?.width) || 0,
    height: Number(rendition?.height) || 0,
  };
}

export async function searchGiphyStickers(
  query: string,
  limit = 12,
  offset = 0,
): Promise<GiphyStickerHit[]> {
  const params = new URLSearchParams({
    api_key: apiKey(),
    q: query,
    limit: String(Math.min(Math.max(limit, 1), 25)),
    offset: String(Math.max(offset, 0)),
    rating: "pg",
    lang: "en",
  });

  const res = await fetch(`${GIPHY_API}/search?${params}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      text.trim() || `GIPHY search failed (HTTP ${res.status})`,
    );
  }

  const body = (await res.json()) as { data?: GiphyGif[] };
  const hits: GiphyStickerHit[] = [];
  for (const gif of body.data ?? []) {
    const hit = toHit(gif);
    if (hit) hits.push(hit);
  }
  return hits;
}

export async function fetchGiphyGifBytes(downloadUrl: string): Promise<Buffer> {
  const res = await fetch(downloadUrl, {
    headers: { "User-Agent": "media_tool/1.0 (documentary acquisition tool)" },
  });
  if (!res.ok) {
    throw new Error(`GIPHY download failed: HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 32) {
    throw new Error("GIPHY download returned an empty file");
  }
  return buf;
}

export function giphyAcquiredFilename(giphyId: string): string {
  const safe = giphyId.replace(/[^\w-]/g, "").slice(0, 40) || "gif";
  return `giphy-${safe}.gif`;
}
