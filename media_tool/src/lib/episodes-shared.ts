/** Client-safe episode types + formatting (no Node fs). */

export interface EpisodeInfo {
  episodeId: string;
  number: string;
  title: string;
  manifestPath: string;
  hasManifest: boolean;
  cueCount: number | null;
}

export function episodeLabel(ep: EpisodeInfo): string {
  const cues = ep.cueCount != null ? ` · ${ep.cueCount} cues` : "";
  const missing = ep.hasManifest ? "" : " (no manifest)";
  return `${ep.number} — ${ep.title}${cues}${missing}`;
}
