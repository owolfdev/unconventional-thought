#!/usr/bin/env node
/**
 * Shared episode config for Remotion scripts.
 * Resolves shorthand (002) → full folder id, output paths, default max cue.
 */
import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REMOTION_ROOT = path.join(__dirname, "..");
export const REPO_ROOT = path.join(REMOTION_ROOT, "..");
export const EPISODES_DIR = path.join(REPO_ROOT, "episodes");
export const ACTIVE_EPISODE_PATH = path.join(REMOTION_ROOT, "active-episode.json");

/** @typedef {{ number: string, episodeId: string, title?: string }} ActiveEpisode */

export function listEpisodeDirs() {
  if (!existsSync(EPISODES_DIR)) return [];
  return readdirSync(EPISODES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name)
    .sort();
}

export function readEpisodeJson(episodeDir) {
  const p = path.join(EPISODES_DIR, episodeDir, "episode.json");
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8"));
}

/** @returns {Map<string, { episodeId: string, number: string, title: string }>} */
export function episodeCatalog() {
  /** @type {Map<string, { episodeId: string, number: string, title: string }>} */
  const map = new Map();
  for (const episodeId of listEpisodeDirs()) {
    const cfg = readEpisodeJson(episodeId);
    const number =
      cfg?.number ??
      episodeId.match(/^(\d{3})_/)?.[1] ??
      episodeId.slice(0, 3);
    const title = cfg?.title ?? episodeId;
    const entry = { episodeId, number, title };
    map.set(episodeId, entry);
    map.set(number, entry);
    const unpadded = number.replace(/^0+/, "");
    if (unpadded) map.set(unpadded, entry);
  }
  return map;
}

/**
 * @param {string} token — 002, 001, or full 002_DidBonScottKnowHeWasGoingToDie
 */
export function resolveEpisodeToken(token) {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new Error("Episode token required (e.g. 002 or 001_WhoWroteBackInBlack)");
  }
  const catalog = episodeCatalog();
  if (catalog.has(trimmed)) {
    return catalog.get(trimmed);
  }
  const padded = trimmed.match(/^\d{1,3}$/)
    ? trimmed.padStart(3, "0")
    : trimmed;
  if (catalog.has(padded)) {
    return catalog.get(padded);
  }
  const byPrefix = listEpisodeDirs().find(
    (id) => id === trimmed || id.startsWith(`${padded}_`),
  );
  if (byPrefix) {
    return catalog.get(byPrefix);
  }
  throw new Error(
    `Unknown episode ${JSON.stringify(token)}. Available: ${listEpisodeDirs().join(", ")}`,
  );
}

/** @returns {ActiveEpisode} */
export function readActiveEpisode() {
  if (!existsSync(ACTIVE_EPISODE_PATH)) {
    const fallback = resolveEpisodeToken("001");
    return {
      number: fallback.number,
      episodeId: fallback.episodeId,
      title: fallback.title,
    };
  }
  const data = JSON.parse(readFileSync(ACTIVE_EPISODE_PATH, "utf8"));
  const resolved = resolveEpisodeToken(data.episodeId ?? data.number ?? "001");
  return {
    number: resolved.number,
    episodeId: resolved.episodeId,
    title: resolved.title,
  };
}

/** @param {string} token */
export function writeActiveEpisode(token) {
  const resolved = resolveEpisodeToken(token);
  const payload = {
    number: resolved.number,
    episodeId: resolved.episodeId,
    title: resolved.title,
    updated_at: new Date().toISOString(),
  };
  writeFileSync(ACTIVE_EPISODE_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return payload;
}

export function manifestPath(episodeId) {
  const cfg = readEpisodeJson(episodeId);
  const rel = cfg?.timeline_manifest ?? "timeline/media_search.json";
  return path.join(EPISODES_DIR, episodeId, rel);
}

export function defaultMaxCue(episodeId) {
  const manifestPath_ = manifestPath(episodeId);
  if (!existsSync(manifestPath_)) {
    throw new Error(`Manifest not found: ${manifestPath_}`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath_, "utf8"));
  const items = manifest.items ?? [];
  if (items.length === 0) throw new Error(`No items in ${manifestPath_}`);
  return items[items.length - 1].id;
}

/** @param {ActiveEpisode} active */
export function renderPaths(active) {
  const renderDir = path.join(REMOTION_ROOT, "out", `render_${active.number}`);
  const previewDir = path.join(renderDir, "preview");
  const propsDir = path.join(renderDir, ".props");
  mkdirSync(previewDir, { recursive: true });
  mkdirSync(propsDir, { recursive: true });
  return { renderDir, previewDir, propsDir };
}

/**
 * @param {{ max?: string, episodeId?: string }} [opts]
 */
export function buildTimeline(opts = {}) {
  const active = opts.episodeId
    ? resolveEpisodeToken(opts.episodeId)
    : readActiveEpisode();
  const max = opts.max ?? defaultMaxCue(active.episodeId);
  console.log(
    `Building timeline · episode ${active.number} (${active.episodeId}) · max ${max}`,
  );
  execSync(
    `python3 ../tools/build_remotion_timeline.py --episode ${active.episodeId} --max ${max}`,
    { stdio: "inherit", cwd: REMOTION_ROOT },
  );
  return { ...active, max };
}

/**
 * Parse CLI args for render scripts.
 * Accepts `--m001`, `m001`, `m001-m002` after npm's `--` separator.
 * @param {string[]} [argv]
 */
export function parseRenderCliArgs(argv = process.argv.slice(2)) {
  const flags = new Set();
  /** @type {string[]} */
  const positional = [];

  for (const raw of argv) {
    if (raw === "--preview") {
      flags.add("--preview");
      continue;
    }
    if (/^--m\d/i.test(raw)) {
      positional.push(raw.slice(2).toLowerCase());
      continue;
    }
    if (raw.startsWith("--")) continue;
    positional.push(raw.trim().toLowerCase());
  }

  return { flags, positional, preview: flags.has("--preview") };
}

export const RENDER_CUES_USAGE = `Usage:
  npm run render:cues -- m026 m027
  npm run render:cues -- m026-m028
  npm run render:preview:cues -- m001-m002

Note the space after -- (npm requires it to pass cue ids to the script).`;

export const RENDER_CUE_USAGE = `Usage:
  npm run render:cue -- m001
  npm run render:preview:cue -- m001

Note the space after -- (npm requires it to pass cue ids to the script).`;

/**
 * Expand m026-m028 into [m026, m027, m028]
 * @param {string[]} tokens
 */
export function expandCueTokens(tokens) {
  /** @type {string[]} */
  const out = [];
  for (const token of tokens) {
    const range = token.match(/^m(\d{3})-m(\d{3})$/i);
    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      if (b < a) throw new Error(`Invalid cue range: ${token}`);
      for (let n = a; n <= b; n += 1) {
        out.push(`m${String(n).padStart(3, "0")}`);
      }
      continue;
    }
    out.push(token.toLowerCase());
  }
  return out;
}

export function readTimeline() {
  const timelinePath = path.join(REMOTION_ROOT, "src", "timeline.json");
  if (!existsSync(timelinePath)) {
    throw new Error(
      "timeline.json missing — run npm run build:timeline first",
    );
  }
  return JSON.parse(readFileSync(timelinePath, "utf8"));
}

export function assertTimelineEpisode(active) {
  const timeline = readTimeline();
  if (timeline.episode && timeline.episode !== active.episodeId) {
    console.warn(
      `Warning: timeline.json is for ${timeline.episode}, active episode is ${active.episodeId}. Run npm run build:timeline.`,
    );
  }
  return timeline;
}
