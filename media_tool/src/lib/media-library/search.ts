import type { SearchResult } from "@/lib/types";
import { buildSearchHaystack } from "./search-fields";
import { readLibraryIndex } from "./ingest";
import type { LibraryIndexEntry, LibraryKind, LibrarySearchFields } from "./types";
import { DEFAULT_LIBRARY_SEARCH_FIELDS } from "./types";

export interface LibrarySearchOptions {
  query: string;
  limit?: number;
  kinds?: LibraryKind[];
  includeArchived?: boolean;
  searchFields?: LibrarySearchFields;
}

function scoreMatch(searchText: string, tokens: string[]): number {
  let score = 0;
  for (const token of tokens) {
    if (searchText.includes(token)) score += 1;
  }
  return score;
}

function entryHaystack(
  entry: LibraryIndexEntry,
  fields: LibrarySearchFields,
): string {
  return buildSearchHaystack(
    {
      filename: entry.filename,
      original_filename: entry.original_filename ?? "",
      tags: entry.tags ?? [],
      manual_notes: entry.manual_notes ?? "",
    },
    fields,
  );
}

export function searchLibrary(opts: LibrarySearchOptions): SearchResult[] {
  const q = opts.query.trim().toLowerCase();
  if (!q) return [];

  const tokens = q.split(/\s+/).filter(Boolean);
  const limit = opts.limit ?? 20;
  const kinds = opts.kinds ?? ["archive"];
  const includeArchived = opts.includeArchived ?? false;
  const searchFields = opts.searchFields ?? DEFAULT_LIBRARY_SEARCH_FIELDS;

  const index = readLibraryIndex();
  const scored = index.assets
    .filter((a) => !a.archived || includeArchived)
    .filter((a) => kinds.includes(a.kind))
    .map((a) => ({
      entry: a,
      score: scoreMatch(entryHaystack(a, searchFields), tokens),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || b.entry.updated_at.localeCompare(a.entry.updated_at))
    .slice(0, limit);

  return scored.map(({ entry }) => ({
    id: `library-${entry.id}`,
    title: entry.filename,
    url: entry.public_url,
    thumbnail_url: entry.thumbnail_url,
    source_page: entry.public_url,
    license: "Library asset — verify rights before use",
    description: entry.tags.length ? entry.tags.join(", ") : `Used ${entry.usage_count}×`,
  }));
}

export function libraryAssetToSearchResult(meta: {
  id: string;
  filename: string;
  tags: string[];
  usages: { length: number };
}): SearchResult {
  const publicUrl = `/media/_library/assets/${meta.id}/${encodeURIComponent(meta.filename)}`;
  return {
    id: `library-${meta.id}`,
    title: meta.filename,
    url: publicUrl,
    thumbnail_url: publicUrl,
    source_page: publicUrl,
    license: "Library asset — verify rights before use",
    description: meta.tags.join(", ") || `Used ${meta.usages.length}×`,
  };
}
