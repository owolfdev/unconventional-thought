#!/usr/bin/env node
/**
 * Headless render for media_tool launcher (streams Remotion progress to job + log).
 *
 *   node scripts/render-job.mjs --episode 002 --from m001 --to m010 --preview --job /path/job.json
 */
import { spawn } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildTimeline,
  defaultMaxCue,
  expandCueTokens,
  readTimeline,
  renderPaths,
  renderSpanLabel,
  resolveEpisodeToken,
  writeActiveEpisode,
} from "./episode-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REMOTION_ROOT = path.join(__dirname, "..");

function parseProgressLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const bundling = trimmed.match(/^Bundling\s+(\d+)%/i);
  if (bundling) {
    const percent = Number(bundling[1]);
    return {
      phase: "bundling",
      percent,
      label: `Bundling ${percent}%`,
    };
  }

  const rendered = trimmed.match(
    /^Rendered\s+(\d+)\/(\d+)(?:,\s*time remaining:\s*(.+))?$/i,
  );
  if (rendered) {
    const frameCurrent = Number(rendered[1]);
    const frameTotal = Number(rendered[2]);
    const eta = rendered[3]?.trim();
    const percent =
      frameTotal > 0
        ? Math.min(100, Math.round((frameCurrent / frameTotal) * 100))
        : undefined;
    return {
      phase: "rendering",
      frameCurrent,
      frameTotal,
      percent,
      label: eta
        ? `Rendered ${frameCurrent}/${frameTotal} · ${eta} remaining`
        : `Rendered ${frameCurrent}/${frameTotal}`,
    };
  }

  const encoded = trimmed.match(/^Encoded\s+(\d+)\/(\d+)/i);
  if (encoded) {
    const frameCurrent = Number(encoded[1]);
    const frameTotal = Number(encoded[2]);
    const percent =
      frameTotal > 0
        ? Math.min(100, Math.round((frameCurrent / frameTotal) * 100))
        : undefined;
    return {
      phase: "encoding",
      frameCurrent,
      frameTotal,
      percent,
      label: `Encoded ${frameCurrent}/${frameTotal}`,
    };
  }

  if (/^Getting composition/i.test(trimmed)) {
    return { phase: "compositing", label: "Getting composition…" };
  }

  return null;
}

function parseArgs(argv) {
  /** @type {Record<string, string | boolean>} */
  const out = { preview: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--preview") {
      out.preview = true;
      continue;
    }
    if (a.startsWith("--") && argv[i + 1]) {
      out[a.slice(2)] = argv[++i];
      continue;
    }
  }
  return out;
}

function writeJob(jobPath, patch) {
  const prev = existsSync(jobPath)
    ? JSON.parse(readFileSync(jobPath, "utf8"))
    : {};
  const next = { ...prev, ...patch, updated_at: new Date().toISOString() };
  mkdirSync(path.dirname(jobPath), { recursive: true });
  writeFileSync(jobPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

function renderCueSpan(active, fromId, toId, preview, logPath, jobPath) {
  const timeline = readTimeline();
  const cueIds =
    fromId === toId ? [fromId] : expandCueTokens([`${fromId}-${toId}`]);
  const shots = [];
  for (const id of cueIds) {
    const shot = timeline.shots?.find((s) => s.id === id);
    if (!shot) throw new Error(`Unknown cue "${id}" in timeline.json`);
    shots.push(shot);
  }
  shots.sort((a, b) => a.fromFrame - b.fromFrame);

  const startFrame = shots[0].fromFrame;
  const endFrame =
    Math.max(...shots.map((s) => s.fromFrame + s.durationInFrames)) - 1;
  const scale = preview ? 0.5 : 1;
  const label = renderSpanLabel(shots.map((s) => s.id));
  const { renderDir, previewDir } = renderPaths(active);
  const out = preview
    ? path.join(previewDir, `preview-${label}.mp4`)
    : path.join(renderDir, `${label}.mp4`);

  appendFileSync(
    logPath,
    `Rendering ${label} · frames ${startFrame}–${endFrame} · scale=${scale}\n`,
  );
  writeJob(jobPath, {
    progress: {
      phase: "starting",
      label: `Rendering ${label}…`,
      frameTotal: endFrame - startFrame + 1,
    },
  });

  const args = [
    "remotion",
    "render",
    "EpisodePreview",
    out,
    `--frames=${startFrame}-${endFrame}`,
    `--scale=${scale}`,
    "--concurrency=2",
  ];

  return new Promise((resolve, reject) => {
    let lineBuf = "";
    let lastProgressWrite = 0;

    const flushLines = (chunk) => {
      appendFileSync(logPath, chunk);
      lineBuf += chunk;
      const parts = lineBuf.split("\n");
      lineBuf = parts.pop() ?? "";
      for (const line of parts) {
        const progress = parseProgressLine(line);
        if (!progress) continue;
        const now = Date.now();
        if (now - lastProgressWrite < 200) continue;
        lastProgressWrite = now;
        writeJob(jobPath, { progress });
      }
    };

    const child = spawn("npx", args, {
      cwd: REMOTION_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, FORCE_COLOR: "0" },
    });

    child.stdout.on("data", (buf) => flushLines(buf.toString()));
    child.stderr.on("data", (buf) => flushLines(buf.toString()));

    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (lineBuf.trim()) {
        const progress = parseProgressLine(lineBuf);
        if (progress) writeJob(jobPath, { progress });
      }
      if (code === 0) resolve(out);
      else reject(new Error(`remotion render failed (exit ${code ?? 1})`));
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const jobPath = args.job;
  if (!jobPath || typeof jobPath !== "string") {
    console.error("Missing --job <path>");
    process.exit(1);
  }

  const logPath =
    typeof args.log === "string" ? args.log : `${jobPath}.log`;
  mkdirSync(path.dirname(logPath), { recursive: true });
  writeFileSync(logPath, "", "utf8");

  const episodeToken = args.episode;
  const fromId = String(args.from ?? "").toLowerCase();
  const toId = String(args.to ?? fromId).toLowerCase();
  const preview = Boolean(args.preview);
  const maxCue =
    typeof args.max === "string" ? args.max : undefined;

  writeJob(jobPath, {
    status: "running",
    episodeToken,
    from: fromId,
    to: toId,
    preview,
    logPath,
    started_at: new Date().toISOString(),
    progress: { phase: "starting", label: "Starting…" },
  });

  try {
    if (!episodeToken || !fromId) {
      throw new Error("--episode and --from required");
    }
    const active = resolveEpisodeToken(String(episodeToken));
    writeActiveEpisode(active.episodeId);
    appendFileSync(logPath, `Active episode: ${active.episodeId}\n`);
    writeJob(jobPath, {
      progress: { phase: "starting", label: "Building timeline…" },
    });

    const max = maxCue ?? defaultMaxCue(active.episodeId);
    buildTimeline({ episodeId: active.episodeId, max });
    appendFileSync(logPath, `Timeline built (max ${max})\n`);

    const outputPath = await renderCueSpan(
      active,
      fromId,
      toId,
      preview,
      logPath,
      jobPath,
    );

    writeJob(jobPath, {
      status: "completed",
      episodeId: active.episodeId,
      episodeNumber: active.number,
      outputPath,
      outputRelative: path.relative(REMOTION_ROOT, outputPath),
      finished_at: new Date().toISOString(),
      exitCode: 0,
      pid: null,
      progress: { phase: "done", label: "Done", percent: 100 },
    });
    appendFileSync(logPath, `\nDone: ${outputPath}\n`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    appendFileSync(logPath, `\nERROR: ${message}\n`);
    writeJob(jobPath, {
      status: "failed",
      error: message,
      finished_at: new Date().toISOString(),
      exitCode: 1,
    });
    process.exit(1);
  }
}

main();
