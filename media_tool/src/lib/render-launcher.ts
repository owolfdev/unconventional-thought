import { spawn } from "child_process";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import type { MediaToolManifest } from "./types";
import { normalizeCueId as normalizeCueIdInput } from "./cue-id";
import { getRepoRoot, resolveManifestPath } from "./paths";
import {
  latestProgressFromLog,
  tailLogLines,
  type RenderProgress,
} from "./render-progress";

export type RenderQuality = "preview" | "full";

export type RenderJobStatus = "queued" | "running" | "completed" | "failed";

export interface RenderJob {
  id: string;
  status: RenderJobStatus;
  episodeId?: string;
  episodeNumber?: string;
  from: string;
  to: string;
  preview: boolean;
  manifestPath: string;
  jobPath: string;
  logPath: string;
  outputPath?: string;
  outputRelative?: string;
  error?: string;
  pid?: number;
  started_at?: string;
  finished_at?: string;
  exitCode?: number;
  progress?: RenderProgress;
}

const CUE_ID_RE = /^m\d{3}$/i;

export function normalizeCueId(raw: string): string {
  const normalized = normalizeCueIdInput(raw);
  if (!CUE_ID_RE.test(normalized)) {
    throw new Error(`Invalid cue id: ${raw} (expected digits or m###)`);
  }
  return normalized;
}

export function parseCueNumber(id: string): number {
  const m = normalizeCueId(id).match(/^m(\d{3})$/);
  if (!m) throw new Error(`Invalid cue id: ${id}`);
  return Number(m[1]);
}

export function expandCueRange(from: string, to: string): string[] {
  const a = parseCueNumber(from);
  const b = parseCueNumber(to);
  if (b < a) {
    throw new Error(`End cue ${to} is before start cue ${from}`);
  }
  const out: string[] = [];
  for (let n = a; n <= b; n += 1) {
    out.push(`m${String(n).padStart(3, "0")}`);
  }
  return out;
}

export function episodeNumberFromManifest(manifest: MediaToolManifest): string {
  const episodeId = manifest.episode;
  const fromJson = episodeId.match(/^(\d{3})_/)?.[1];
  if (fromJson) return fromJson;
  const cfgPath = path.join(
    getRepoRoot(),
    "episodes",
    episodeId,
    "episode.json",
  );
  if (fs.existsSync(cfgPath)) {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8")) as {
      number?: string;
    };
    if (cfg.number) return cfg.number.padStart(3, "0");
  }
  throw new Error(`Cannot resolve episode number for ${episodeId}`);
}

export function defaultMaxCueForManifest(manifest: MediaToolManifest): string {
  const items = manifest.items ?? [];
  if (!items.length) throw new Error("Manifest has no cues");
  return items[items.length - 1].id;
}

export function validateCueRange(
  manifest: MediaToolManifest,
  from: string,
  to: string,
): { from: string; to: string; cueIds: string[] } {
  const fromId = normalizeCueId(from);
  const toId = normalizeCueId(to);
  const manifestIds = new Set(manifest.items.map((i) => i.id.toLowerCase()));
  const cueIds = expandCueRange(fromId, toId);
  for (const id of cueIds) {
    if (!manifestIds.has(id)) {
      throw new Error(`Cue ${id} not in manifest`);
    }
  }
  return { from: fromId, to: toId, cueIds };
}

export function renderJobsDir(episodeNumber: string): string {
  return path.join(
    getRepoRoot(),
    "remotion",
    "out",
    `render_${episodeNumber}`,
    ".render-jobs",
  );
}

export function readRenderJob(jobPath: string): RenderJob | null {
  if (!fs.existsSync(jobPath)) return null;
  return JSON.parse(fs.readFileSync(jobPath, "utf8")) as RenderJob;
}

export function listRecentRenderJobs(
  episodeNumber: string,
  limit = 5,
): RenderJob[] {
  const dir = renderJobsDir(episodeNumber);
  if (!fs.existsSync(dir)) return [];
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !f.endsWith(".json.log"))
    .map((f) => path.join(dir, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  const jobs: RenderJob[] = [];
  for (const file of files.slice(0, limit)) {
    const job = readRenderJob(file);
    if (job) jobs.push(job);
  }
  return jobs;
}

export interface StartRenderInput {
  manifestPath: string;
  from: string;
  to: string;
  quality: RenderQuality;
  rebuildTimeline?: boolean;
}

export function startRenderJob(input: StartRenderInput): RenderJob {
  const manifestAbs = resolveManifestPath(input.manifestPath);
  const manifest = JSON.parse(
    fs.readFileSync(manifestAbs, "utf8"),
  ) as MediaToolManifest;
  const { from, to } = validateCueRange(manifest, input.from, input.to);
  const episodeNumber = episodeNumberFromManifest(manifest);
  const maxCue = defaultMaxCueForManifest(manifest);
  const preview = input.quality === "preview";

  const jobId = randomUUID();
  const jobsDir = renderJobsDir(episodeNumber);
  fs.mkdirSync(jobsDir, { recursive: true });
  const jobPath = path.join(jobsDir, `${jobId}.json`);
  const logPath = `${jobPath}.log`;

  const job: RenderJob = {
    id: jobId,
    status: "queued",
    from,
    to,
    preview,
    manifestPath: input.manifestPath,
    jobPath,
    logPath,
    episodeId: manifest.episode,
    episodeNumber,
    started_at: new Date().toISOString(),
  };
  fs.writeFileSync(jobPath, `${JSON.stringify(job, null, 2)}\n`, "utf8");

  const remotionRoot = path.join(getRepoRoot(), "remotion");
  const scriptPath = path.join(remotionRoot, "scripts", "render-job.mjs");
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Render script not found: ${scriptPath}`);
  }

  const child = spawn(
    process.execPath,
    [
      scriptPath,
      "--episode",
      episodeNumber,
      "--from",
      from,
      "--to",
      to,
      "--max",
      maxCue,
      ...(preview ? ["--preview"] : []),
      "--job",
      jobPath,
      "--log",
      logPath,
    ],
    {
      cwd: remotionRoot,
      detached: true,
      stdio: "ignore",
    },
  );
  child.unref();

  job.status = "running";
  job.pid = child.pid;
  fs.writeFileSync(jobPath, `${JSON.stringify(job, null, 2)}\n`, "utf8");
  return job;
}

export function refreshRenderJob(job: RenderJob): RenderJob {
  const onDisk = readRenderJob(job.jobPath);
  if (!onDisk) return job;
  if (onDisk.status === "running" && onDisk.pid) {
    try {
      process.kill(onDisk.pid, 0);
    } catch {
      if (!onDisk.finished_at) {
        onDisk.status = "failed";
        onDisk.error = onDisk.error ?? "Render process ended unexpectedly";
      }
    }
  }
  return onDisk;
}

export function readLogFull(logPath: string): string {
  if (!fs.existsSync(logPath)) return "";
  return fs.readFileSync(logPath, "utf8");
}

export function tailLog(logPath: string, maxLines = 48): string {
  return tailLogLines(readLogFull(logPath), maxLines);
}

export function jobWithLiveProgress(job: RenderJob): RenderJob {
  const log = readLogFull(job.logPath);
  const progress =
    job.progress ?? (log ? latestProgressFromLog(log) : undefined) ?? undefined;
  return progress ? { ...job, progress } : job;
}
