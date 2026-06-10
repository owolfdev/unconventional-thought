import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { getAcquiredDir } from "@/lib/media-folders";
import { getAssetDir } from "@/lib/media-library/paths";
import { readAssetMeta } from "@/lib/media-library/ingest";

const execFileAsync = promisify(execFile);

const LIBRARY_ASSET_ID = /^[a-f0-9]{16}$/i;

function resolveInsideAcquired(
  acquiredDir: string,
  filename?: string,
): string {
  const resolvedDir = fs.realpathSync(acquiredDir);
  if (!filename) return resolvedDir;

  const safe = path.basename(filename);
  const target = path.join(resolvedDir, safe);
  if (!fs.existsSync(target)) {
    throw new Error(`File not found: ${safe}`);
  }
  const resolvedTarget = fs.realpathSync(target);
  if (
    resolvedTarget !== resolvedDir &&
    !resolvedTarget.startsWith(`${resolvedDir}${path.sep}`)
  ) {
    throw new Error("Invalid path");
  }
  return resolvedTarget;
}

function resolveInsideLibraryAsset(
  assetId: string,
  filename?: string,
): string {
  const safeId = path.basename(assetId.trim());
  if (!LIBRARY_ASSET_ID.test(safeId)) {
    throw new Error("Invalid library asset id");
  }

  const assetDir = getAssetDir(safeId);
  if (!fs.existsSync(assetDir)) {
    throw new Error("Library asset folder not found");
  }

  const resolvedDir = fs.realpathSync(assetDir);
  if (!filename) return resolvedDir;

  const safe = path.basename(filename.trim());
  let target = path.join(resolvedDir, safe);
  if (!fs.existsSync(target)) {
    const meta = readAssetMeta(safeId);
    if (meta?.filename) {
      target = path.join(resolvedDir, path.basename(meta.filename));
    }
  }
  if (!fs.existsSync(target)) {
    throw new Error(`File not found: ${safe}`);
  }

  const resolvedTarget = fs.realpathSync(target);
  if (
    resolvedTarget !== resolvedDir &&
    !resolvedTarget.startsWith(`${resolvedDir}${path.sep}`)
  ) {
    throw new Error("Invalid path");
  }
  return resolvedTarget;
}

async function revealPath(absolutePath: string, revealFile: boolean) {
  if (process.platform === "darwin") {
    const args = revealFile ? ["-R", absolutePath] : [absolutePath];
    await execFileAsync("open", args);
    return;
  }
  if (process.platform === "win32") {
    if (revealFile) {
      await execFileAsync("explorer", ["/select,", absolutePath]);
    } else {
      await execFileAsync("explorer", [absolutePath]);
    }
    return;
  }
  await execFileAsync("xdg-open", [absolutePath]);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      project?: string;
      itemId?: string;
      libraryId?: string;
      filename?: string;
    };

    const filename = body.filename?.trim();

    let target: string;
    if (body.libraryId?.trim()) {
      target = resolveInsideLibraryAsset(body.libraryId, filename || undefined);
    } else if (body.project?.trim() && body.itemId?.trim()) {
      const project = path.basename(body.project.trim());
      const itemId = path.basename(body.itemId.trim());
      const acquiredDir = getAcquiredDir(project, itemId);

      if (!fs.existsSync(acquiredDir)) {
        return NextResponse.json(
          { error: "acquired/ folder not found" },
          { status: 404 },
        );
      }

      target = resolveInsideAcquired(acquiredDir, filename || undefined);
    } else {
      return NextResponse.json(
        { error: "libraryId or project+itemId required" },
        { status: 400 },
      );
    }

    await revealPath(target, Boolean(filename));

    return NextResponse.json({
      ok: true,
      path: target,
      revealed: Boolean(filename),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
