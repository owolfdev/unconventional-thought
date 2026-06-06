import type { PersonRef } from "@/lib/types";

export const LIBRARY_KINDS = [
  "archive",
  "effect",
  "overlay",
  "generated",
] as const;

export type LibraryKind = (typeof LIBRARY_KINDS)[number];

export type LibraryMediaType = "photo" | "video";

export interface LibraryUsage {
  episode_id: string;
  cue_id: string;
  spoken: string;
  search_queries: string[];
  people: PersonRef[];
  situation: string;
  editorial_intent: string;
  attached_at: string;
}

export interface LibraryAssetMeta {
  version: 1;
  id: string;
  filename: string;
  original_filename: string;
  kind: LibraryKind;
  media_type: LibraryMediaType;
  source_url: string | null;
  source_engine: string | null;
  license: string;
  tags: string[];
  manual_notes: string;
  usages: LibraryUsage[];
  archived: boolean;
  created_at: string;
  updated_at: string;
  search_text: string;
}

export type LibrarySearchField =
  | "filename"
  | "original_filename"
  | "tags"
  | "notes";

export interface LibrarySearchFields {
  filename: boolean;
  original_filename: boolean;
  tags: boolean;
  notes: boolean;
}

export const DEFAULT_LIBRARY_SEARCH_FIELDS: LibrarySearchFields = {
  filename: true,
  original_filename: false,
  tags: true,
  notes: true,
};

export interface LibraryIndexEntry {
  id: string;
  filename: string;
  original_filename: string;
  kind: LibraryKind;
  media_type: LibraryMediaType;
  thumbnail_url: string;
  public_url: string;
  tags: string[];
  manual_notes: string;
  search_text: string;
  usage_count: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface LibraryIndex {
  version: 1;
  updated_at: string;
  asset_count: number;
  assets: LibraryIndexEntry[];
}

export interface IngestContext {
  episode_id: string;
  cue_id: string;
  spoken?: string;
  search_queries?: string[];
  people?: PersonRef[];
  situation?: string;
  editorial_intent?: string;
  source_url?: string | null;
  source_engine?: string | null;
  license?: string;
  /** Human title for filename suggestion */
  title?: string;
  kind?: LibraryKind;
  tags?: string[];
  manual_notes?: string;
}

export interface IngestResult {
  id: string;
  filename: string;
  publicUrl: string;
  deduplicated: boolean;
  media_type: LibraryMediaType;
  kind: LibraryKind;
}
