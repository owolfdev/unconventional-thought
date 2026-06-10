import fs from "fs";
import path from "path";
import { getRepoRoot, resolveManifestPath } from "./paths";

export interface EpisodeInfo {
  episodeId: string;
  number: string;
  title: string;
  manifestPath: string;
  hasManifest: boolean;
  cueCount: number | null;
}

function readEpisodeJson(episodeDir: string): Record<string, string> {
  const cfgPath = path.join(episodeDir, "episode.json");
  if (!fs.existsSync(cfgPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(cfgPath, "utf-8")) as Record<string, string>;
  } catch {
    return {};
  }
}

/** Episodes under repo episodes/ with manifest paths for media_tool. */
export function listEpisodes(): EpisodeInfo[] {
  const episodesDir = path.join(getRepoRoot(), "episodes");
  if (!fs.existsSync(episodesDir)) return [];

  return fs
    .readdirSync(episodesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name)
    .sort()
    .map((episodeId) => {
      const epDir = path.join(episodesDir, episodeId);
      const cfg = readEpisodeJson(epDir);
      const number =
        cfg.number ?? episodeId.match(/^(\d{3})_/)?.[1] ?? episodeId.slice(0, 3);
      const title = cfg.title ?? episodeId;
      const timelineRel = cfg.timeline_manifest ?? "timeline/media_search.json";
      const manifestPath = path
        .join("episodes", episodeId, timelineRel)
        .replace(/\\/g, "/");
      const manifestAbs = resolveManifestPath(manifestPath);
      const hasManifest = fs.existsSync(manifestAbs);
      let cueCount: number | null = null;
      if (hasManifest) {
        try {
          const manifest = JSON.parse(
            fs.readFileSync(manifestAbs, "utf-8"),
          ) as { items?: unknown[]; cue_count?: number };
          cueCount =
            manifest.items?.length ?? manifest.cue_count ?? null;
        } catch {
          cueCount = null;
        }
      }
      return {
        episodeId,
        number,
        title,
        manifestPath,
        hasManifest,
        cueCount,
      };
    });
}

export function episodeLabel(ep: EpisodeInfo): string {
  const cues =
    ep.cueCount != null ? ` · ${ep.cueCount} cues` : "";
  const missing = ep.hasManifest ? "" : " (no manifest)";
  return `${ep.number} — ${ep.title}${cues}${missing}`;
}
