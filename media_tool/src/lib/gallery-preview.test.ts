import { describe, expect, it } from "vitest";
import {
  galleryResultPreviewKind,
  parseYouTubeVideoId,
  youtubeEmbedUrl,
} from "./gallery-preview";

describe("parseYouTubeVideoId", () => {
  it("extracts id from watch url", () => {
    expect(parseYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });
});

describe("galleryResultPreviewKind", () => {
  it("detects youtube from video search", () => {
    expect(
      galleryResultPreviewKind(
        {
          id: "x",
          title: "t",
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          thumbnail_url: "",
          source_page: "",
          license: "",
        },
        "video",
      ),
    ).toBe("youtube");
  });

  it("treats bing as image", () => {
    expect(
      galleryResultPreviewKind(
        {
          id: "x",
          title: "t",
          url: "https://cdn.example.com/a.jpg",
          thumbnail_url: "",
          source_page: "",
          license: "",
        },
        "bing",
      ),
    ).toBe("image");
  });
});

describe("youtubeEmbedUrl", () => {
  it("builds embed url", () => {
    expect(youtubeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toContain(
      "embed/dQw4w9WgXcQ",
    );
  });
});
