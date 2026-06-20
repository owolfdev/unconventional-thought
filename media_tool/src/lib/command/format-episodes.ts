import { episodeLabel, type EpisodeInfo } from "@/lib/episodes-shared";

/** Response text for @episodes — lists loadable manifests. */
export function formatEpisodesList(
  episodes: EpisodeInfo[],
  currentManifestPath?: string,
): string {
  if (episodes.length === 0) {
    return "No episodes found under episodes/.";
  }

  const lines = episodes.map((ep) => {
    const label = episodeLabel(ep);
    const loaded =
      currentManifestPath && ep.manifestPath === currentManifestPath
        ? "  ← loaded"
        : "";
    const loadHint = ep.hasManifest ? `@episode ${ep.number}` : "(no manifest)";
    return `  ${label}${loaded}\n    ${loadHint}`;
  });

  return [`Episodes (${episodes.length}):`, ...lines].join("\n");
}
