import fs from "fs";
import path from "path";

export function getRepoRoot(): string {
  const env = process.env.MEDIA_REPO_ROOT?.trim();
  if (env) {
    return path.isAbsolute(env) ? env : path.resolve(process.cwd(), env);
  }
  return path.resolve(process.cwd(), "..");
}

export function resolveManifestPath(manifestPath: string): string {
  const trimmed = manifestPath.trim();
  if (path.isAbsolute(trimmed)) return trimmed;
  return path.join(getRepoRoot(), trimmed);
}

/** media_search.json → media_acquisition.json in the same folder */
export function acquisitionPathForManifest(manifestPath: string): string {
  const resolved = resolveManifestPath(manifestPath);
  const dir = path.dirname(resolved);
  const base = path.basename(resolved, ".json");
  const acqBase = base.includes("media_search")
    ? base.replace("media_search", "media_acquisition")
    : `${base}_acquisition`;
  return path.join(dir, `${acqBase}.json`);
}

export function readJsonFile<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

export function writeJsonFile(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

export function defaultManifestPath(): string {
  return (
    process.env.DEFAULT_MANIFEST_PATH?.trim() ||
    "episodes/001_WhoWroteBackInBlack/timeline/media_search.json"
  );
}
