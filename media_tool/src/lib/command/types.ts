import type { SearchResult } from "@/lib/types";
import type { GiphyStickerHit } from "@/lib/giphy";
import type { GallerySize } from "./gallery-size";

export type { GallerySize };

export type GallerySource = "library" | "google" | "gif" | "video";

export interface GalleryState {
  source: GallerySource;
  sourceLabel: string;
  query: string;
  results: SearchResult[];
  /** Present when source === "gif" — needed for import API. */
  giphyHits?: GiphyStickerHit[];
}

export type ResponseLine = {
  text: string;
  tone?: "info" | "error" | "success" | "warn";
};

/** Drives CommandRenderPanel playback without mouse (from @play). */
export type PlayRequest = {
  seq: number;
  /** omitted = once; null = infinite loop; number = play N times total */
  loopCount?: number | null;
};

export type ParsedDirective =
  | { kind: "help" }
  | { kind: "helpTopic"; topic: "effects" | "modes" }
  | { kind: "mode"; set?: string }
  | { kind: "info" }
  | { kind: "layers" }
  | { kind: "effects" }
  | { kind: "effect"; action: "add" | "remove"; id: string }
  | { kind: "render"; args: string[] }
  | { kind: "play"; loopCount?: number | null }
  | { kind: "status" }
  | {
      kind: "navigate";
      target: "next" | "prev" | "next_incomplete" | "cue";
      cueId?: string;
    }
  | { kind: "episode"; ref: string }
  | { kind: "episodes" }
  | { kind: "search"; engine: GallerySource; query: string }
  | { kind: "add"; index: number }
  | { kind: "preview"; index: number }
  | { kind: "gallery"; size?: GallerySize }
  | { kind: "save" }
  | { kind: "complete" }
  | { kind: "split"; lines: string[] }
  | { kind: "merge"; firstId: string; secondId: string }
  | { kind: "use"; cueId: string }
  | { kind: "confirm" }
  | { kind: "cancel" }
  | { kind: "unknown"; raw: string };
