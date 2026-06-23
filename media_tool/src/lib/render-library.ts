import fs from "fs";
import path from "path";
import { getRepoRoot } from "./paths";
import {
  parseSpanFromStem,
  type RenderLibraryEntry,
  type RenderListFilter,
} from "./render-library-shared";

export type {
  RenderLibraryEntry,
  RenderListFilter,
} from "./render-library-shared";
export {
  formatBytes,
  formatRenderList,
  renderJobFromEntry,
  resolveRenderEntry,
} from "./render-library-shared";

export function renderEpisodeDir(episodeNumber: string): string {
  return path.join(getRepoRoot(), "remotion", "out", `render_${episodeNumber}`);
}

function entryFromFile(
  remotionOut: string,
  filePath: string,
  preview: boolean,
): RenderLibraryEntry {
  const stat = fs.statSync(filePath);
  const basename = path.basename(filePath, ".mp4");
  const renderDir = path.dirname(path.dirname(filePath));
  const key = preview
    ? path.join("preview", path.basename(filePath))
    : path.basename(filePath);
  const span = parseSpanFromStem(basename);
  return {
    key: key.replace(/\\/g, "/"),
    title: basename,
    preview,
    outputPath: filePath,
    outputRelative: path.relative(remotionOut, filePath).replace(/\\/g, "/"),
    sizeBytes: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    from: span.from,
    to: span.to,
  };
}

export function listRenderLibrary(
  episodeNumber: string,
  filter: RenderListFilter = "all",
): RenderLibraryEntry[] {
  const renderDir = renderEpisodeDir(episodeNumber);
  const remotionOut = path.join(getRepoRoot(), "remotion", "out");
  if (!fs.existsSync(renderDir)) return [];

  const entries: RenderLibraryEntry[] = [];

  if (filter === "all" || filter === "final") {
    for (const name of fs.readdirSync(renderDir)) {
      if (!name.endsWith(".mp4")) continue;
      entries.push(
        entryFromFile(
          remotionOut,
          path.join(renderDir, name),
          false,
        ),
      );
    }
  }

  if (filter === "all" || filter === "preview") {
    const previewDir = path.join(renderDir, "preview");
    if (fs.existsSync(previewDir)) {
      for (const name of fs.readdirSync(previewDir)) {
        if (!name.endsWith(".mp4")) continue;
        entries.push(
          entryFromFile(
            remotionOut,
            path.join(previewDir, name),
            true,
          ),
        );
      }
    }
  }

  entries.sort(
    (a, b) =>
      new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime(),
  );
  return entries;
}

export function resolveRenderOutputPath(
  episodeNumber: string,
  key: string,
): string {
  const renderDir = renderEpisodeDir(episodeNumber);
  const resolved = path.resolve(renderDir, key);
  const resolvedRenderDir = fs.realpathSync(renderDir);
  if (
    resolved !== resolvedRenderDir &&
    !resolved.startsWith(`${resolvedRenderDir}${path.sep}`)
  ) {
    throw new Error("Invalid render path");
  }
  if (!fs.existsSync(resolved)) {
    throw new Error("Render file missing on disk");
  }
  return resolved;
}

export function deleteRenderEntry(entry: RenderLibraryEntry): void {
  fs.unlinkSync(entry.outputPath);
}

export function deleteRenderEntries(entries: RenderLibraryEntry[]): number {
  let n = 0;
  for (const entry of entries) {
    if (!fs.existsSync(entry.outputPath)) continue;
    deleteRenderEntry(entry);
    n += 1;
  }
  return n;
}
