import { NextRequest, NextResponse } from "next/server";
import {
  episodeNumberFromManifest,
  listRecentRenderJobs,
  readRenderJob,
  jobWithLiveProgress,
  refreshRenderJob,
  startRenderJob,
  tailLog,
  type RenderQuality,
} from "@/lib/render-launcher";
import { defaultManifestPath, readJsonFile, resolveManifestPath } from "@/lib/paths";
import type { MediaToolManifest } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get("jobId");
    const manifestPath =
      request.nextUrl.searchParams.get("path") ?? defaultManifestPath();

    if (jobId) {
      const episodeNumber = episodeNumberFromManifest(
        readJsonFile<MediaToolManifest>(resolveManifestPath(manifestPath)),
      );
      const jobsDir = listRecentRenderJobs(episodeNumber, 20);
      const job = jobsDir.find((j) => j.id === jobId);
      if (!job) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      }
      const fresh = jobWithLiveProgress(refreshRenderJob(job));
      return NextResponse.json({
        job: fresh,
        logTail: tailLog(fresh.logPath, 56),
      });
    }

    const manifest = readJsonFile<MediaToolManifest>(
      resolveManifestPath(manifestPath),
    );
    const episodeNumber = episodeNumberFromManifest(manifest);
    const jobs = listRecentRenderJobs(episodeNumber, 5).map(refreshRenderJob);
    return NextResponse.json({
      manifestPath,
      episodeNumber,
      maxCue: manifest.items[manifest.items.length - 1]?.id,
      jobs,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      manifestPath?: string;
      from?: string;
      to?: string;
      quality?: RenderQuality;
    };

    const from = body.from?.trim();
    const to = (body.to ?? body.from)?.trim();
    if (!from || !to) {
      return NextResponse.json(
        { error: "from and to cue ids required (e.g. m001)" },
        { status: 400 },
      );
    }

    const quality: RenderQuality =
      body.quality === "full" ? "full" : "preview";

    const job = startRenderJob({
      manifestPath: body.manifestPath?.trim() || defaultManifestPath(),
      from,
      to,
      quality,
    });

    return NextResponse.json({
      ok: true,
      job,
      message: `Render started: ${job.from}${job.to !== job.from ? `–${job.to}` : ""} (${quality})`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
