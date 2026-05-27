#!/usr/bin/env node
/**
 * Render a contiguous span of cues from the episode timeline (overlap edits).
 *
 *   node scripts/render-cues.mjs m026 m027
 *   node scripts/render-cues.mjs m026 m027 --full
 */
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));

if (args.length < 2) {
  console.error("Usage: node scripts/render-cues.mjs <cueId> <cueId> [...] [--full]");
  console.error("Example: node scripts/render-cues.mjs m026 m027");
  process.exit(1);
}

const timelinePath = path.join(root, "src", "timeline.json");
const timeline = JSON.parse(readFileSync(timelinePath, "utf8"));
const shots = [];

for (const id of args) {
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

const scale = flags.has("--full") ? 1 : 0.5;
const label = shots.map((s) => s.id).join("-");
const out = path.join("out", `preview-${label}.mp4`);
mkdirSync(path.join(root, "out"), { recursive: true });

const sec = (durationFrames / timeline.fps).toFixed(2);
console.log(
  `Rendering ${label} · frames ${startFrame}–${endFrame} · ${sec}s · scale=${scale}`,
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

execSync(cmd, { stdio: "inherit", cwd: root });

console.log(`\nWrote ${out}`);
