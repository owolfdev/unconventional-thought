#!/usr/bin/env node
/**
 * Render a single cue (m001–m035) for fast preview.
 *
 *   node scripts/render-cue.mjs m022
 *   node scripts/render-cue.mjs m009 --full
 */
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));

const shotId = args[0]?.trim();
if (!shotId) {
  console.error("Usage: npm run render:cue -- <cueId> [--full]");
  console.error("Example: npm run render:cue -- m022");
  process.exit(1);
}

const timelinePath = path.join(root, "src", "timeline.json");
const timeline = JSON.parse(readFileSync(timelinePath, "utf8"));
const shot = timeline.shots?.find((s) => s.id === shotId);
if (!shot) {
  console.error(`Unknown cue "${shotId}" in timeline.json`);
  console.error(
    `Available: ${(timeline.shots ?? []).map((s) => s.id).join(", ")}`,
  );
  process.exit(1);
}

const scale = flags.has("--full") ? 1 : 0.5;
const out = path.join("out", `preview-${shotId}.mp4`);
mkdirSync(path.join(root, "out"), { recursive: true });
const propsPath = path.join(root, "out", `.props-${shotId}.json`);
writeFileSync(propsPath, JSON.stringify({ shotId }), "utf8");
const sec = (shot.durationInFrames / timeline.fps).toFixed(2);

console.log(
  `Rendering ${shotId} (cue ${shot.cue}) · ${sec}s · ${shot.durationInFrames} frames @ ${timeline.fps}fps · scale=${scale}`,
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

execSync(cmd, { stdio: "inherit", cwd: root });

console.log(`\nWrote ${out}`);
