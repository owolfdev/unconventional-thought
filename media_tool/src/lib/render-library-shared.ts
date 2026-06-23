import type { RenderJob } from "./render-launcher";
import { renderRangeLabel } from "./command/render-parse";

export type RenderListFilter = "all" | "preview" | "final";

export interface RenderLibraryEntry {
  /** Path relative to `render_<NNN>/` e.g. `preview/preview-m000.mp4` */
  key: string;
  title: string;
  preview: boolean;
  outputPath: string;
  /** Relative to `remotion/out/` */
  outputRelative: string;
  sizeBytes: number;
  modifiedAt: string;
  from: string;
  to: string;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatRenderList(
  entries: RenderLibraryEntry[],
  filter: RenderListFilter,
): string {
  if (entries.length === 0) {
    const label =
      filter === "preview"
        ? "preview renders"
        : filter === "final"
          ? "full renders"
          : "renders";
    return `No ${label} on disk. Run @render <cue> to create a preview.`;
  }

  const heading =
    filter === "preview"
      ? "Preview renders"
      : filter === "final"
        ? "Full renders"
        : "Renders";

  const lines = [`${heading} (${entries.length}):`];
  entries.forEach((entry, i) => {
    const when = new Date(entry.modifiedAt).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const quality = entry.preview ? "preview" : "full";
    const span = renderRangeLabel(entry.from, entry.to);
    lines.push(
      `  ${i + 1}  ${entry.title}.mp4  ${span}  ${quality}  ${formatBytes(entry.sizeBytes)}  ${when}`,
    );
  });
  lines.push("", "Load: @render load <# or title>");
  return lines.join("\n");
}

export function resolveRenderEntry(
  entries: RenderLibraryEntry[],
  ref: string,
): { entry: RenderLibraryEntry } | { error: string } {
  const trimmed = ref.trim();
  if (!trimmed) {
    return { error: "Usage: @render load <# or title>" };
  }

  if (/^\d+$/.test(trimmed)) {
    const idx = Number.parseInt(trimmed, 10);
    if (idx < 1 || idx > entries.length) {
      return {
        error: `List index out of range: ${idx} (1–${entries.length})`,
      };
    }
    return { entry: entries[idx - 1]! };
  }

  const needle = trimmed.toLowerCase().replace(/\.mp4$/i, "");
  const matches = entries.filter((entry) => {
    const title = entry.title.toLowerCase();
    return (
      title === needle ||
      title === `preview-${needle}` ||
      title.includes(needle) ||
      entry.key.toLowerCase().includes(needle)
    );
  });

  if (matches.length === 1) return { entry: matches[0]! };
  if (matches.length > 1) {
    return {
      error: `Ambiguous title "${ref}" — use list number instead.`,
    };
  }
  return { error: `Render not found: ${ref}` };
}

export function renderJobFromEntry(
  entry: RenderLibraryEntry,
  manifestPath: string,
  episodeId: string,
  episodeNumber: string,
): RenderJob {
  return {
    id: `library:${entry.key}`,
    status: "completed",
    from: entry.from,
    to: entry.to,
    preview: entry.preview,
    manifestPath,
    jobPath: "",
    logPath: "",
    episodeId,
    episodeNumber,
    outputPath: entry.outputPath,
    outputRelative: entry.outputRelative,
    finished_at: entry.modifiedAt,
  };
}

export function parseSpanFromStem(stem: string): { from: string; to: string } {
  let base = stem;
  if (base.startsWith("preview-")) base = base.slice("preview-".length);

  const range = base.match(/^(m\d{3})-(m\d{3})(?:-\d+cues)?$/i);
  if (range) {
    return { from: range[1].toLowerCase(), to: range[2].toLowerCase() };
  }
  const single = base.match(/^(m\d{3})$/i);
  if (single) {
    const id = single[1].toLowerCase();
    return { from: id, to: id };
  }
  return { from: "m000", to: "m000" };
}
