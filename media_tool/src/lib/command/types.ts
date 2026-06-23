import type { SearchResult } from "@/lib/types";
import type { GiphyStickerHit } from "@/lib/giphy";
import type { RenderLibraryEntry, RenderListFilter } from "@/lib/render-library-shared";
import type { HelpTopic } from "./help-topics";
import type { RenderCommand } from "./render-command-parse";
import type { GallerySize } from "./gallery-size";

export type { GallerySize };

export type GallerySource = "library" | "google" | "bing" | "gif" | "video";

export interface GalleryState {
  source: GallerySource;
  sourceLabel: string;
  query: string;
  results: SearchResult[];
  /** Present when source === "gif" — needed for import API. */
  giphyHits?: GiphyStickerHit[];
  /** Optional scrape/API note (empty results, layout issues). */
  apiNote?: string;
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
  | { kind: "helpTopic"; topic: HelpTopic }
  | { kind: "mode"; set?: string }
  | { kind: "generate"; variant: "sticker" | "image"; prompt: string }
  | {
      kind: "text";
      action: "add" | "animate" | "size" | "clear";
      value?: string;
    }
  | {
      kind: "sticker";
      action: "add" | "clear" | "place";
      value?: string;
    }
  | { kind: "info" }
  | { kind: "layers" }
  | { kind: "effects" }
  | { kind: "effect"; action: "add" | "remove"; id: string; scope: EffectScope }
  | { kind: "render"; command: RenderCommand }
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
  | { kind: "clear" }
  | { kind: "inpoint"; arg?: string }
  | { kind: "complete" }
  | { kind: "split"; lines: string[] }
  | { kind: "merge"; firstId: string; secondId: string }
  | { kind: "use"; cueId: string }
  | { kind: "confirm" }
  | { kind: "cancel" }
  | { kind: "unknown"; raw: string };
