import { describe, expect, it } from "vitest";
import { scrapeResultId } from "./ids";
import {
  mapGoogleImageHits,
  parseGoogleImageHrefs,
} from "./parse-google-images";
import {
  mapYouTubeHits,
  mergeYouTubeHits,
  parseYouTubeWatchHref,
} from "./parse-youtube";

describe("scrapeResultId", () => {
  it("is stable for the same key", () => {
    expect(scrapeResultId("google", "https://example.com/a.jpg")).toBe(
      scrapeResultId("google", "https://example.com/a.jpg"),
    );
  });
});

describe("parseGoogleImageHrefs", () => {
  it("extracts imgurl and imgrefurl from imgres links", () => {
    const href =
      "/imgres?imgurl=https%3A%2F%2Fcdn.example.com%2Fphoto.jpg&imgrefurl=https%3A%2F%2Fexample.com%2Fpage";
    const hits = parseGoogleImageHrefs([href]);
    expect(hits).toHaveLength(1);
    expect(hits[0].imgUrl).toBe("https://cdn.example.com/photo.jpg");
    expect(hits[0].sourcePage).toBe("https://example.com/page");
  });

  it("dedupes by image url", () => {
    const href =
      "/imgres?imgurl=https%3A%2F%2Fcdn.example.com%2Fphoto.jpg&imgrefurl=https%3A%2F%2Fa.com";
    const hits = parseGoogleImageHrefs([href, href]);
    expect(hits).toHaveLength(1);
  });
});

describe("mapGoogleImageHits", () => {
  it("maps to SearchResult shape", () => {
    const [result] = mapGoogleImageHits(
      [
        {
          imgUrl: "https://cdn.example.com/x.jpg",
          thumb: "https://thumb.example.com/x.jpg",
          sourcePage: "https://example.com",
          title: "Example",
        },
      ],
      5,
    );
    expect(result.id).toMatch(/^google-[a-f0-9]{12}$/);
    expect(result.license).toContain("Google");
    expect(result.url).toBe("https://cdn.example.com/x.jpg");
  });
});

describe("parseYouTubeWatchHref", () => {
  it("extracts 11-char video id", () => {
    expect(parseYouTubeWatchHref("/watch?v=dQw4w9WgXcQ&pp=0")).toBe(
      "dQw4w9WgXcQ",
    );
  });
});

describe("mergeYouTubeHits", () => {
  it("dedupes watch links", () => {
    const hits = mergeYouTubeHits([
      { href: "/watch?v=abc12345678", title: "First" },
      { href: "/watch?v=abc12345678", title: "Dup" },
      { href: "/watch?v=xyz98765432", title: "Second" },
    ]);
    expect(hits.map((h) => h.videoId)).toEqual(["abc12345678", "xyz98765432"]);
  });
});

describe("mapYouTubeHits", () => {
  it("builds watch url and hqdefault thumbnail", () => {
    const [result] = mapYouTubeHits(
      [{ videoId: "dQw4w9WgXcQ", title: "Never Gonna Give You Up" }],
      10,
    );
    expect(result.url).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result.thumbnail_url).toContain("dQw4w9WgXcQ");
    expect(result.id).toMatch(/^youtube-[a-f0-9]{12}$/);
  });
});
