import { buildSearchHaystack } from "./search-fields";
import { readLibraryIndex } from "./ingest";
import type { LibraryIndexEntry, LibraryKind, LibrarySearchFields } from "./types";
import { DEFAULT_LIBRARY_SEARCH_FIELDS } from "./types";

export interface ListLibraryOptions {
  query?: string;
  kinds?: LibraryKind[];
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
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

export function listLibraryAssets(opts: ListLibraryOptions = {}): {
  assets: LibraryIndexEntry[];
  total: number;
  asset_count: number;
} {
  const q = opts.query?.trim().toLowerCase() ?? "";
  const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
  const kinds = opts.kinds;
  const includeArchived = opts.includeArchived ?? false;
  const limit = opts.limit ?? 48;
  const offset = opts.offset ?? 0;
  const searchFields = opts.searchFields ?? DEFAULT_LIBRARY_SEARCH_FIELDS;

  const index = readLibraryIndex();
  let rows = index.assets.filter(
    (a) => includeArchived || !a.archived,
  );

  if (kinds && kinds.length > 0) {
    rows = rows.filter((a) => kinds.includes(a.kind));
  }

  if (tokens.length > 0) {
    rows = rows
      .map((entry) => ({
        entry,
        score: scoreMatch(entryHaystack(entry, searchFields), tokens),
      }))
      .filter((row) => row.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.entry.updated_at.localeCompare(a.entry.updated_at),
      )
      .map((row) => row.entry);
  } else {
    rows = [...rows].sort((a, b) =>
      b.updated_at.localeCompare(a.updated_at),
    );
  }

  const total = rows.length;
  const assets = rows.slice(offset, offset + limit);

  return {
    assets,
    total,
    asset_count: index.asset_count,
  };
}
