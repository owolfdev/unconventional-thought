export interface SearchEngine {
  id: string;
  label: string;
  /** Base URL; `{query}` is replaced with encoded search text */
  urlTemplate: string;
  /** Returns thumbnails in the in-app gallery */
  supportsGallery: boolean;
  galleryHint?: string;
}

export const SEARCH_ENGINES: SearchEngine[] = [
  {
    id: "library",
    label: "Repo library",
    urlTemplate: "",
    supportsGallery: true,
    galleryHint:
      "Search assets already in public/media/_library/ (archive photos & video)",
  },
  {
    id: "commons",
    label: "Wikimedia Commons",
    urlTemplate: "https://commons.wikimedia.org/w/index.php?search={query}",
    supportsGallery: true,
    galleryHint: "In-app gallery · historical / editorial",
  },
  {
    id: "openverse",
    label: "Openverse (CC web images)",
    urlTemplate: "https://openverse.org/search?q={query}",
    supportsGallery: true,
    galleryHint: "In-app gallery · CC-licensed images",
  },
  {
    id: "google_images",
    label: "Google Images",
    urlTemplate: "https://www.google.com/search?tbm=isch&q={query}",
    supportsGallery: true,
    galleryHint:
      "In-app gallery via Custom Search JSON API — unavailable on new GCP projects (403); falls back to Openverse",
  },
  {
    id: "youtube",
    label: "YouTube",
    urlTemplate: "https://www.youtube.com/results?search_query={query}",
    supportsGallery: true,
    galleryHint: "In-app gallery if YOUTUBE_API_KEY set, else open in browser",
  },
  {
    id: "google",
    label: "Google (web)",
    urlTemplate: "https://www.google.com/search?q={query}",
    supportsGallery: false,
    galleryHint: "Opens in browser — use Add URL or switch to an image engine",
  },
];

export function getEngine(id: string): SearchEngine {
  return SEARCH_ENGINES.find((e) => e.id === id) ?? SEARCH_ENGINES[0];
}

export function buildSearchUrl(template: string, query: string): string {
  return template.replace("{query}", encodeURIComponent(query.trim()));
}
