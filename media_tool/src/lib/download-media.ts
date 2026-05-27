import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { createHash } from "crypto";

export function isYouTubeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\./, "");
    return h === "youtu.be" || h === "youtube.com" || h.endsWith(".youtube.com");
  } catch {
    return false;
  }
}

export async function ytDlpAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const p = spawn("yt-dlp", ["--version"], { stdio: ["ignore", "ignore", "ignore"] });
    p.on("error", () => resolve(false));
    p.on("close", (code) => resolve(code === 0));
  });
}

function runYtDlp(url: string, outDir: string): Promise<string> {
  const template = path.join(outDir, "%(id)s.%(ext)s");
  return new Promise((resolve, reject) => {
    const args = [
      "-f",
      "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
      "--merge-output-format",
      "mp4",
      "-o",
      template,
      "--no-playlist",
      "--no-warnings",
      url,
    ];
    const proc = spawn("yt-dlp", args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    proc.stderr?.on("data", (d) => {
      err += d.toString();
    });
    proc.on("error", () => {
      reject(
        new Error(
          "yt-dlp not found. Install: brew install yt-dlp  (or pip install yt-dlp)",
        ),
      );
    });
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(err.trim() || `yt-dlp exited with code ${code}`));
        return;
      }
      const files = fs
        .readdirSync(outDir)
        .filter((f) => f !== ".gitkeep" && !f.startsWith("."));
      if (!files.length) {
        reject(new Error("yt-dlp finished but no output file found"));
        return;
      }
      const newest = files
        .map((f) => ({
          f,
          m: fs.statSync(path.join(outDir, f)).mtimeMs,
        }))
        .sort((a, b) => b.m - a.m)[0].f;
      resolve(newest);
    });
  });
}

function guessExtension(url: string, contentType: string | null): string {
  const fromUrl = path.extname(new URL(url).pathname).split("?")[0];
  if (fromUrl && fromUrl.length <= 5) return fromUrl;
  if (contentType?.includes("jpeg")) return ".jpg";
  if (contentType?.includes("png")) return ".png";
  if (contentType?.includes("webp")) return ".webp";
  if (contentType?.includes("gif")) return ".gif";
  if (contentType?.includes("mp4")) return ".mp4";
  return ".bin";
}

async function downloadDirect(url: string, outDir: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "media_tool/1.0 (documentary acquisition tool)",
    },
  });
  if (!res.ok) {
    throw new Error(`Download failed: HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 12);
  const ext = guessExtension(url, res.headers.get("content-type"));
  const filename = `download-${hash}${ext}`;
  const dest = path.join(outDir, filename);
  fs.writeFileSync(dest, buf);
  return filename;
}

export interface DownloadResult {
  filename: string;
  absolutePath: string;
  method: "yt-dlp" | "fetch";
}

/** Download URL into cue acquired/ directory. */
export async function downloadToAcquired(
  url: string,
  acquiredDir: string,
): Promise<DownloadResult> {
  fs.mkdirSync(acquiredDir, { recursive: true });

  if (isYouTubeUrl(url)) {
    const filename = await runYtDlp(url, acquiredDir);
    return {
      filename,
      absolutePath: path.join(acquiredDir, filename),
      method: "yt-dlp",
    };
  }

  const filename = await downloadDirect(url, acquiredDir);
  return {
    filename,
    absolutePath: path.join(acquiredDir, filename),
    method: "fetch",
  };
}

export function listAcquiredFiles(acquiredDir: string): string[] {
  if (!fs.existsSync(acquiredDir)) return [];
  return fs
    .readdirSync(acquiredDir)
    .filter((f) => f !== ".gitkeep" && !f.startsWith("."));
}

const UPLOAD_MAX_BYTES = 500 * 1024 * 1024;

const BLOCKED_UPLOAD_EXTENSIONS = new Set([
  ".exe",
  ".sh",
  ".bat",
  ".cmd",
  ".app",
  ".dmg",
  ".js",
  ".html",
  ".php",
]);

export function sanitizeUploadFilename(name: string): string {
  const base = path
    .basename(name)
    .replace(/[^\w.\-()+ ]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  if (!base || base === "." || base === "..") {
    return `upload-${Date.now()}.bin`;
  }
  return base;
}

function uniqueFilenameInDir(dir: string, filename: string): string {
  const ext = path.extname(filename);
  const stem = path.basename(filename, ext) || "upload";
  let candidate = filename;
  let n = 1;
  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${stem}-${n}${ext}`;
    n += 1;
  }
  return candidate;
}

/** Copy a local file into cue acquired/ (same destination as URL download). */
export function saveUploadToAcquired(
  acquiredDir: string,
  originalName: string,
  data: Buffer,
): DownloadResult {
  if (data.length > UPLOAD_MAX_BYTES) {
    throw new Error(
      `File too large (${Math.round(data.length / 1024 / 1024)} MB). Max is 500 MB.`,
    );
  }

  fs.mkdirSync(acquiredDir, { recursive: true });

  const safe = sanitizeUploadFilename(originalName);
  const ext = path.extname(safe).toLowerCase();
  if (BLOCKED_UPLOAD_EXTENSIONS.has(ext)) {
    throw new Error(`File type not allowed: ${ext}`);
  }

  const filename = uniqueFilenameInDir(acquiredDir, safe);
  const absolutePath = path.join(acquiredDir, filename);
  fs.writeFileSync(absolutePath, data);

  return {
    filename,
    absolutePath,
    method: "fetch",
  };
}
