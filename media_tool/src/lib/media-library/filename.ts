import fs from "fs";
import path from "path";

const UGLY_PATTERNS = [
  /^download-[a-f0-9]{8,}\.[a-z0-9]+$/i,
  /^upload-\d+\.[a-z0-9]+$/i,
  /^[A-Za-z0-9_-]{11}\.(mp4|webm|mkv)$/i,
  /^giphy-[a-z0-9]+\.gif$/i,
  /^sticker-[a-f0-9-]+\.png$/i,
  /^title-[a-f0-9-]+\.png$/i,
];

export function slugifyFilename(text: string, maxLen = 80): string {
  const slug = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLen);
  return slug || "asset";
}

export function isUglyFilename(name: string): boolean {
  const base = path.basename(name);
  if (base.length <= 4) return true;
  return UGLY_PATTERNS.some((re) => re.test(base));
}

export function sanitizeFilename(name: string): string {
  const base = path
    .basename(name)
    .replace(/[^\w.\-()+ ]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  if (!base || base === "." || base === "..") {
    return "asset.bin";
  }
  return base;
}

export function suggestLibraryFilename(
  originalName: string,
  opts?: { title?: string; query?: string },
): string {
  const ext = path.extname(originalName) || ".bin";
  if (!isUglyFilename(originalName)) {
    return sanitizeFilename(originalName);
  }
  const stem =
    slugifyFilename(opts?.title ?? "") ||
    slugifyFilename(opts?.query ?? "") ||
    slugifyFilename(path.basename(originalName, ext));
  return `${stem}${ext.toLowerCase()}`;
}

export function uniqueFilenameInDir(dir: string, filename: string): string {
  const ext = path.extname(filename);
  const stem = path.basename(filename, ext) || "asset";
  let candidate = filename;
  let n = 1;
  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${stem}-${n}${ext}`;
    n += 1;
  }
  return candidate;
}
