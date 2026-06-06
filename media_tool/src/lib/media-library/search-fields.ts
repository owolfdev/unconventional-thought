import type { LibrarySearchField, LibrarySearchFields } from "./types";
import { DEFAULT_LIBRARY_SEARCH_FIELDS } from "./types";

/** User-controlled fields only — usages are shown in detail but do not affect search. */
export function buildSearchHaystack(
  meta: {
    filename: string;
    original_filename?: string;
    tags: string[];
    manual_notes?: string;
  },
  fields: LibrarySearchFields = DEFAULT_LIBRARY_SEARCH_FIELDS,
): string {
  const parts: string[] = [];
  if (fields.filename) parts.push(meta.filename);
  if (fields.original_filename && meta.original_filename) {
    parts.push(meta.original_filename);
  }
  if (fields.tags) parts.push(...meta.tags);
  if (fields.notes && meta.manual_notes) parts.push(meta.manual_notes);
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function parseSearchFieldsParam(param: string | null): LibrarySearchFields {
  if (!param?.trim()) return { ...DEFAULT_LIBRARY_SEARCH_FIELDS };
  const enabled = new Set(
    param
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return {
    filename: enabled.has("filename"),
    original_filename: enabled.has("original_filename"),
    tags: enabled.has("tags"),
    notes: enabled.has("notes"),
  };
}

export function searchFieldsToParam(fields: LibrarySearchFields): string {
  return (
    Object.entries(fields) as Array<[LibrarySearchField, boolean]>
  )
    .filter(([, enabled]) => enabled)
    .map(([key]) => key)
    .join(",");
}

/** Full haystack (all fields) stored on meta/index for reference. */
export function buildSearchText(meta: {
  filename: string;
  original_filename: string;
  tags: string[];
  manual_notes: string;
}): string {
  return buildSearchHaystack(meta, {
    filename: true,
    original_filename: true,
    tags: true,
    notes: true,
  });
}
