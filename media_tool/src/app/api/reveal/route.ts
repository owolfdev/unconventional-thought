import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { getAcquiredDir } from "@/lib/media-folders";

const execFileAsync = promisify(execFile);

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
      filename?: string;
    };

    if (!body.project?.trim() || !body.itemId?.trim()) {
      return NextResponse.json(
        { error: "project and itemId required" },
        { status: 400 },
      );
    }

    const project = path.basename(body.project.trim());
    const itemId = path.basename(body.itemId.trim());
    const acquiredDir = getAcquiredDir(project, itemId);

    if (!fs.existsSync(acquiredDir)) {
      return NextResponse.json(
        { error: "acquired/ folder not found" },
        { status: 404 },
      );
    }

    const filename = body.filename?.trim();
    const target = resolveInsideAcquired(acquiredDir, filename || undefined);
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
