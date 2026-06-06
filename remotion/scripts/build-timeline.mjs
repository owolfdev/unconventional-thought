#!/usr/bin/env node
/** Build timeline.json for the active episode (or --episode 002). */
import { buildTimeline, readActiveEpisode } from "./episode-config.mjs";

const args = process.argv.slice(2);
let episodeId;
let max;
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--episode" && args[i + 1]) {
    episodeId = args[++i];
  } else if (args[i] === "--max" && args[i + 1]) {
    max = args[++i];
  }
}

if (episodeId) {
  buildTimeline({ episodeId, max });
} else {
  const active = readActiveEpisode();
  buildTimeline({ episodeId: active.episodeId, max });
}
