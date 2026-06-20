import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  episodeNumberFromManifest,
  listRecentRenderJobs,
  refreshRenderJob,
} from "@/lib/render-launcher";
import { getRepoRoot, defaultManifestPath, readJsonFile, resolveManifestPath } from "@/lib/paths";
import type { MediaToolManifest } from "@/lib/types";

function resolveOutputPath(
  jobId: string,
  manifestPath: string,
): { outputPath: string; outputRelative: string } {
  const manifest = readJsonFile<MediaToolManifest>(
    resolveManifestPath(manifestPath),
  );
  const episodeNumber = episodeNumberFromManifest(manifest);
  const jobs = listRecentRenderJobs(episodeNumber, 30);
  const job = jobs.find((j) => j.id === jobId);
  if (!job) {
    throw new Error("Render job not found");
  }
  const fresh = refreshRenderJob(job);
  if (fresh.status !== "completed" || !fresh.outputPath) {
    throw new Error("Render output not ready");
  }
  if (!fs.existsSync(fresh.outputPath)) {
    throw new Error("Render file missing on disk");
  }

  const remotionOut = path.join(getRepoRoot(), "remotion", "out");
  const resolved = fs.realpathSync(fresh.outputPath);
  const resolvedOut = fs.realpathSync(remotionOut);
  if (
    resolved !== resolvedOut &&
    !resolved.startsWith(`${resolvedOut}${path.sep}`)
  ) {
    throw new Error("Invalid output path");
  }

  return {
    outputPath: resolved,
    outputRelative: fresh.outputRelative ?? path.relative(resolvedOut, resolved),
  };
}

/** Stream a completed render mp4 for inline <video> preview. */
export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get("jobId");
    if (!jobId) {
      return NextResponse.json({ error: "jobId required" }, { status: 400 });
    }
    const manifestPath =
      request.nextUrl.searchParams.get("path") ?? defaultManifestPath();

    const { outputPath } = resolveOutputPath(jobId, manifestPath);
    const stat = fs.statSync(outputPath);
    const stream = fs.createReadStream(outputPath);

    return new NextResponse(stream as unknown as BodyInit, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(stat.size),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("not found") || message.includes("missing")
      ? 404
      : message.includes("not ready")
        ? 409
        : 500;
    return NextResponse.json({ error: message }, { status: status });
  }
}
