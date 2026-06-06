#!/usr/bin/env node
/**
 * Show or set the active Remotion episode.
 *
 *   npm run episode              → print current
 *   npm run episode 002          → set to 002_DidBonScottKnowHeWasGoingToDie
 *   npm run episode list         → list all episodes
 */
import {
  episodeCatalog,
  listEpisodeDirs,
  readActiveEpisode,
  renderPaths,
  writeActiveEpisode,
} from "./episode-config.mjs";

const arg = process.argv[2]?.trim();

if (!arg) {
  const active = readActiveEpisode();
  const paths = renderPaths(active);
  console.log(`Active episode: ${active.number} — ${active.title}`);
  console.log(`  id:     ${active.episodeId}`);
  console.log(`  full:   ${paths.renderDir}/`);
  console.log(`  preview:${paths.previewDir}/`);
  process.exit(0);
}

if (arg === "list" || arg === "ls") {
  const catalog = episodeCatalog();
  const seen = new Set();
  for (const episodeId of listEpisodeDirs()) {
    const entry = catalog.get(episodeId);
    if (!entry || seen.has(entry.episodeId)) continue;
    seen.add(entry.episodeId);
    console.log(`${entry.number}  ${entry.episodeId}`);
    console.log(`     ${entry.title}`);
  }
  process.exit(0);
}

const active = writeActiveEpisode(arg);
const paths = renderPaths(active);
console.log(`Active episode set: ${active.number} — ${active.title}`);
console.log(`  id:     ${active.episodeId}`);
console.log(`  full:   ${paths.renderDir}/`);
console.log(`  preview:${paths.previewDir}/`);
