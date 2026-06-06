#!/usr/bin/env node
/**
 * Render full episode (EpisodePreview composition).
 *
 *   npm run render              → full res → out/render_002/m068.mp4
 *   npm run render:preview      → half res → out/render_002/preview/preview-m068.mp4
 */
import { execSync } from "node:child_process";
import path from "node:path";
import {
  assertTimelineEpisode,
  readActiveEpisode,
  renderPaths,
  REMOTION_ROOT,
} from "./episode-config.mjs";

const preview = process.argv.includes("--preview");

const active = readActiveEpisode();
const timeline = assertTimelineEpisode(active);
const { renderDir, previewDir } = renderPaths(active);
const maxId = timeline.max_id ?? timeline.shots?.at(-1)?.id ?? "m000";

const scale = preview ? 0.5 : 1;
const out = preview
  ? path.join(previewDir, `preview-${maxId}.mp4`)
  : path.join(renderDir, `${maxId}.mp4`);

console.log(
  `Rendering episode ${active.number} · max ${maxId} · ${preview ? "preview" : "full"} · scale=${scale}`,
);

const cmd = [
  "npx",
  "remotion",
  "render",
  "EpisodePreview",
  out,
  `--scale=${scale}`,
  "--concurrency=2",
].join(" ");

execSync(cmd, { stdio: "inherit", cwd: REMOTION_ROOT });
console.log(`\nWrote ${out}`);
