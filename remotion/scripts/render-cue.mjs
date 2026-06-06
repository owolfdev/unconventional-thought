#!/usr/bin/env node
/**
 * Render a single cue (CuePreview composition).
 *
 *   npm run render:cue -- m001
 *   npm run render:preview:cue -- m001
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import {
  assertTimelineEpisode,
  parseRenderCliArgs,
  RENDER_CUE_USAGE,
  readActiveEpisode,
  renderPaths,
  REMOTION_ROOT,
} from "./episode-config.mjs";

const { preview, positional } = parseRenderCliArgs();
const shotId = positional[0];

if (!shotId) {
  console.error(RENDER_CUE_USAGE);
  process.exit(1);
}

const active = readActiveEpisode();
const timeline = assertTimelineEpisode(active);
const shot = timeline.shots?.find((s) => s.id === shotId);
if (!shot) {
  console.error(`Unknown cue "${shotId}" in timeline.json`);
  console.error(
    `Available: ${(timeline.shots ?? []).map((s) => s.id).join(", ")}`,
  );
  process.exit(1);
}

const scale = preview ? 0.5 : 1;
const { renderDir, previewDir, propsDir } = renderPaths(active);
const out = preview
  ? path.join(previewDir, `preview-${shotId}.mp4`)
  : path.join(renderDir, `${shotId}.mp4`);
const propsPath = path.join(propsDir, `${shotId}.json`);
writeFileSync(propsPath, JSON.stringify({ shotId }), "utf8");
const sec = (shot.durationInFrames / timeline.fps).toFixed(2);

console.log(
  `Rendering ${active.number} ${shotId} (cue ${shot.cue}) · ${sec}s · ${preview ? "preview" : "full"} · scale=${scale}`,
);

const cmd = [
  "npx",
  "remotion",
  "render",
  "CuePreview",
  out,
  `--props=${propsPath}`,
  `--scale=${scale}`,
  "--concurrency=2",
].join(" ");

execSync(cmd, { stdio: "inherit", cwd: REMOTION_ROOT });
console.log(`\nWrote ${out}`);
