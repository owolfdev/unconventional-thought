import fs from "fs";
import path from "path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AcquiredMediaGrid } from "@/components/AcquiredMediaGrid";
import { OpenInFinderButton } from "@/components/OpenInFinderButton";
import {
  assetManifestPath,
  getMediaPublicRoot,
  itemAcquisitionPath,
  type ItemAssetManifest,
} from "@/lib/media-folders";
import { readJsonFile, resolveManifestPath } from "@/lib/paths";
import type { ItemAcquisition, MediaToolManifest } from "@/lib/types";

export const dynamic = "force-dynamic";

interface AcquiredFile {
  name: string;
  href: string;
  kind: "image" | "video" | "other";
  size: string;
  selected: boolean;
}

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".m4v", ".webm"]);

function safeSegment(value: string): string {
  return path.basename(value);
}

function fileKind(filename: string): AcquiredFile["kind"] {
  const ext = path.extname(filename).toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  return "other";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

function projectItemIds(project: string, sourceManifest?: string): string[] {
  if (sourceManifest) {
    const manifestPath = resolveManifestPath(sourceManifest);
    if (fs.existsSync(manifestPath)) {
      const manifest = readJsonFile<MediaToolManifest>(manifestPath);
      return manifest.items.map((item) => item.id);
    }
  }

  const projectDir = path.join(getMediaPublicRoot(), project);
  if (!fs.existsSync(projectDir)) return [];

  return fs
    .readdirSync(projectDir)
    .filter((name) => fs.statSync(path.join(projectDir, name)).isDirectory())
    .sort((a, b) => a.localeCompare(b));
}

export default async function AcquiredPage({
  params,
}: {
  params: Promise<{ project: string; itemId: string }>;
}) {
  const { project: rawProject, itemId: rawItemId } = await params;
  const project = safeSegment(rawProject);
  const itemId = safeSegment(rawItemId);
  const acquiredDir = path.join(
    getMediaPublicRoot(),
    project,
    itemId,
    "acquired",
  );

  if (!fs.existsSync(acquiredDir)) {
    notFound();
  }

  const amPath = assetManifestPath(project, itemId);
  const sourceManifest = fs.existsSync(amPath)
    ? readJsonFile<ItemAssetManifest>(amPath).source_media_search
    : undefined;
  const itemIds = projectItemIds(project, sourceManifest);
  const currentIndex = itemIds.indexOf(itemId);
  const prevItemId = currentIndex > 0 ? itemIds[currentIndex - 1] : null;
  const nextItemId =
    currentIndex >= 0 && currentIndex < itemIds.length - 1
      ? itemIds[currentIndex + 1]
      : null;
  const backHref = sourceManifest
    ? `/?path=${encodeURIComponent(sourceManifest)}&itemId=${encodeURIComponent(itemId)}`
    : `/?itemId=${encodeURIComponent(itemId)}`;

  const acquisitionPath = itemAcquisitionPath(project, itemId);
  const selectedUrls = new Set<string>();
  if (fs.existsSync(acquisitionPath)) {
    const acquisition = readJsonFile<ItemAcquisition>(acquisitionPath);
    for (const query of acquisition.queries) {
      for (const selection of query.selections) {
        selectedUrls.add(selection.url);
        selectedUrls.add(selection.result_id);
      }
    }
  }

  const files: AcquiredFile[] = fs
    .readdirSync(acquiredDir)
    .filter((name) => !name.startsWith("."))
    .map((name) => {
      const absolutePath = path.join(acquiredDir, name);
      const stat = fs.statSync(absolutePath);
      return {
        name,
        href: `/media/${project}/${itemId}/acquired/${encodeURIComponent(name)}`,
        kind: fileKind(name),
        size: formatBytes(stat.size),
        selected:
          selectedUrls.has(
            `/media/${project}/${itemId}/acquired/${encodeURIComponent(name)}`,
          ) || selectedUrls.has(`local-acquired:${name}`),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-3xl font-bold text-emerald-300">
            {itemId}
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            Acquired Media
          </h1>
          <p className="mt-1 font-mono text-xs text-zinc-500">
            public/media/{project}/{itemId}/acquired/
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OpenInFinderButton project={project} itemId={itemId} />
          <Link
            href={backHref}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            Back to Media Search
          </Link>
        </div>
      </header>

      <nav className="mb-6 flex flex-wrap items-center justify-between gap-3 border-y border-zinc-800 py-3">
        {prevItemId ? (
          <Link
            href={`/acquired/${encodeURIComponent(project)}/${encodeURIComponent(prevItemId)}`}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            Previous: {prevItemId}
          </Link>
        ) : (
          <span className="rounded-lg border border-zinc-800 px-3 py-1.5 text-sm text-zinc-600">
            Previous
          </span>
        )}

        <p className="font-mono text-xs text-zinc-500">
          {currentIndex >= 0 ? currentIndex + 1 : "-"} / {itemIds.length || "-"}
        </p>

        {nextItemId ? (
          <Link
            href={`/acquired/${encodeURIComponent(project)}/${encodeURIComponent(nextItemId)}`}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            Next: {nextItemId}
          </Link>
        ) : (
          <span className="rounded-lg border border-zinc-800 px-3 py-1.5 text-sm text-zinc-600">
            Next
          </span>
        )}
      </nav>

      {files.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 text-sm text-zinc-500">
          No acquired files yet.
        </div>
      ) : (
        <AcquiredMediaGrid project={project} itemId={itemId} files={files} />
      )}
    </main>
  );
}
