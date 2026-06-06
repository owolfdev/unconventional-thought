#!/usr/bin/env node
/**
 * Render a contiguous span of cues (EpisodePreview frame range).
 *
 *   npm run render:cues -- m026 m027
 *   npm run render:cues -- m026-m028
 *   npm run render:preview:cues -- m001-m002
 */
import { execSync } from "node:child_process";
import path from "node:path";
import {
  assertTimelineEpisode,
  expandCueTokens,
  parseRenderCliArgs,
  RENDER_CUES_USAGE,
  readActiveEpisode,
  renderPaths,
  REMOTION_ROOT,
} from "./episode-config.mjs";

const { preview, positional } = parseRenderCliArgs();

if (positional.length < 1) {
  console.error(RENDER_CUES_USAGE);
  process.exit(1);
}

const active = readActiveEpisode();
const timeline = assertTimelineEpisode(active);
const cueIds = expandCueTokens(positional);
const shots = [];

for (const id of cueIds) {
  const shot = timeline.shots?.find((s) => s.id === id);
  if (!shot) {
    console.error(`Unknown cue "${id}" in timeline.json`);
    process.exit(1);
  }
  shots.push(shot);
}

shots.sort((a, b) => a.fromFrame - b.fromFrame);

const startFrame = shots[0].fromFrame;
const endFrame =
  Math.max(...shots.map((s) => s.fromFrame + s.durationInFrames)) - 1;
const durationFrames = endFrame - startFrame + 1;

const scale = preview ? 0.5 : 1;
const label = shots.map((s) => s.id).join("-");
const { renderDir, previewDir } = renderPaths(active);
const out = preview
  ? path.join(previewDir, `preview-${label}.mp4`)
  : path.join(renderDir, `${label}.mp4`);

const sec = (durationFrames / timeline.fps).toFixed(2);
console.log(
  `Rendering ${active.number} ${label} · frames ${startFrame}–${endFrame} · ${sec}s · ${preview ? "preview" : "full"} · scale=${scale}`,
);
for (const s of shots) {
  console.log(
    `  ${s.id} cue ${s.cue}: from ${s.fromFrame}, ${s.durationInFrames} frames`,
  );
}

const cmd = [
  "npx",
  "remotion",
  "render",
  "EpisodePreview",
  out,
  `--frames=${startFrame}-${endFrame}`,
  `--scale=${scale}`,
  "--concurrency=2",
].join(" ");

execSync(cmd, { stdio: "inherit", cwd: REMOTION_ROOT });
console.log(`\nWrote ${out}`);
