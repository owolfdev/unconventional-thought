import type { LegacyVisualMode, VisualMode } from "./visual-modes";

export type { VisualMode, LegacyVisualMode };

export type ResolvedMediaType = "photo" | "video" | "generated";

export type AcquisitionStatus =
  | "pending"
  | "in_progress"
  | "complete"
  | "skipped"
  | "text_graphic";

export interface PersonRef {
  name: string;
  role: string;
  date_died?: string;
}

export interface TextGraphic {
  type: string;
  text: string;
  style: string;
  optional_texture?: string;
}

export interface ArtifactRef {
  object: string;
  story_link: string;
  media_preference: string;
}

export interface MediaToolItem {
  id: string;
  cue: number;
  t_start: number;
  t_end: number;
  duration_sec: number;
  spoken: string;
  /** From media_search; may be legacy `historical_photo` until normalized. */
  visual_mode: import("./visual-modes").VisualMode | import("./visual-modes").LegacyVisualMode;
  text_graphic: TextGraphic | null;
  artifact: ArtifactRef | null;
  editorial_intent: string;
  people: PersonRef[];
  situation: string;
  date_from: string;
  date_to: string;
  location: string;
  search_queries: string[];
  avoid: string[];
  media_type: string;
  reuse_id: string;
  priority: string;
}

export interface MediaToolManifest {
  version: number;
  episode: string;
  style: string;
  source_transcript: string;
  source_audio: string;
  cue_count: number;
  historical_count?: number;
  /** @deprecated use historical_count */
  historical_photo_count?: number;
  artifact_count?: number;
  text_graphic_count?: number;
  notes?: string;
  items: MediaToolItem[];
}

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  thumbnail_url: string;
  source_page: string;
  license: string;
  description?: string;
}

export interface SelectedMedia {
  result_id: string;
  url: string;
  thumbnail_url: string;
  title: string;
  source_page: string;
  license: string;
  engine_id: string;
  query: string;
  selected_at: string;
  /** Video only: seconds into source file where cue playback begins. */
  start_from_sec?: number;
}

export interface QueryAcquisition {
  query_index: number;
  query: string;
  engine_id: string;
  engine_url: string;
  selections: SelectedMedia[];
}

export interface ItemAcquisition {
  id: string;
  cue: number;
  source_visual_mode: VisualMode;
  resolved_visual_mode: VisualMode;
  resolved_media_type: ResolvedMediaType;
  status: AcquisitionStatus;
  /** Human edit direction (mood, framing, legal). */
  notes: string;
  /** voicecut-style stack — use for effect-only or layered looks */
  effects: string[];
  /** voicecut transition into this cue */
  transition: string | null;
  /** Full-cue typography when visual_mode is text_graphic. */
  text_graphic: TextGraphic | null;
  /** Optional overlay on top of photo/video (historical, stock, artifact). */
  text_graphic_layer: TextGraphic | null;
  /** Plate / letterbox fill (hex, default #000000). */
  background_color: string;
  /** When false, Remotion omits sticker/GIF overlay (openai_sticker / giphy_sticker). */
  sticker_overlay_enabled?: boolean;
  /** Sticker/GIF max dimension vs frame — small 40%, medium 62%, large 90% height. */
  sticker_overlay_size?: "small" | "medium" | "large";
  /** When false, Remotion omits title overlay (openai_title). */
  title_overlay_enabled?: boolean;
  queries: QueryAcquisition[];
  completed_at: string | null;
  updated_at: string;
}

export interface MediaAcquisitionDocument {
  version: 1;
  source_manifest: string;
  episode: string;
  created_at: string;
  updated_at: string;
  item_count: number;
  completed_count: number;
  items: Record<string, ItemAcquisition>;
}
