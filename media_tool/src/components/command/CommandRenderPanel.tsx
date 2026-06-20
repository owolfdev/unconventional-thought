"use client";

import { useCallback, useEffect, useRef } from "react";
import type { PlayRequest } from "@/lib/command/types";
import type { RenderJob } from "@/lib/render-launcher";
import type { RenderProgress } from "@/lib/render-progress";
import { renderRangeLabel } from "@/lib/command/render-parse";

function progressPercent(p: RenderProgress | undefined): number | null {
  if (!p) return null;
  if (typeof p.percent === "number") return p.percent;
  if (p.frameCurrent != null && p.frameTotal != null && p.frameTotal > 0) {
    return Math.min(100, Math.round((p.frameCurrent / p.frameTotal) * 100));
  }
  if (p.phase === "done") return 100;
  if (p.phase === "bundling") return p.percent ?? 5;
  if (p.phase === "starting" || p.phase === "compositing") return 2;
  return null;
}

type Props = {
  manifestPath: string;
  job: RenderJob | null;
  playRequest: PlayRequest | null;
  onJobUpdate: (job: RenderJob | null) => void;
};

export function CommandRenderPanel({
  manifestPath,
  job,
  playRequest,
  onJobUpdate,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const pollJob = useCallback(
    async (jobId: string) => {
      const res = await fetch(
        `/api/render?jobId=${encodeURIComponent(jobId)}&path=${encodeURIComponent(manifestPath)}`,
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { job: RenderJob };
      onJobUpdate(data.job);
      return data.job;
    },
    [manifestPath, onJobUpdate],
  );

  const isRunning = job?.status === "running" || job?.status === "queued";

  useEffect(() => {
    if (!job || !isRunning) return;
    void pollJob(job.id);
    const id = window.setInterval(() => {
      void pollJob(job.id);
    }, 800);
    return () => window.clearInterval(id);
  }, [job, isRunning, pollJob]);

  useEffect(() => {
    if (job?.status === "completed" && videoRef.current) {
      videoRef.current.load();
    }
  }, [job?.status, job?.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!playRequest || !video || job?.status !== "completed") return;

    let cancelled = false;
    const infinite = playRequest.loopCount === null;
    let remaining =
      typeof playRequest.loopCount === "number" ? playRequest.loopCount : 1;

    video.loop = infinite;
    video.currentTime = 0;

    const onEnded = () => {
      if (cancelled || infinite) return;
      remaining -= 1;
      if (remaining > 0) {
        video.currentTime = 0;
        void video.play().catch(() => {});
      }
    };

    if (!infinite && remaining > 1) {
      video.addEventListener("ended", onEnded);
    }

    void video.play().catch(() => {});

    return () => {
      cancelled = true;
      video.removeEventListener("ended", onEnded);
      if (!infinite) video.loop = false;
    };
  }, [playRequest?.seq, job?.status]);

  if (!job) return null;

  const pct = progressPercent(job.progress);
  const statusColor =
    job.status === "completed"
      ? "text-emerald-400"
      : job.status === "failed"
        ? "text-red-400"
        : isRunning
          ? "text-amber-300"
          : "text-zinc-400";

  const videoUrl =
    job.status === "completed"
      ? `/api/render/file?jobId=${encodeURIComponent(job.id)}&path=${encodeURIComponent(manifestPath)}`
      : null;

  const openInFinder = async () => {
    if (!job.outputPath) return;
    await fetch("/api/reveal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ absolutePath: job.outputPath, action: "reveal" }),
    });
  };

  return (
    <div className="border-t border-zinc-800 px-3 py-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="font-mono text-[11px] uppercase tracking-wide text-zinc-500">
          render
        </p>
        <span className={`font-mono text-xs ${statusColor}`}>{job.status}</span>
      </div>

      <p className="font-mono text-[11px] text-zinc-400">
        {renderRangeLabel(job.from, job.to)}
        {job.preview ? " · preview" : " · full"}
      </p>

      {isRunning && job.progress?.label && (
        <p className="mt-2 font-mono text-xs text-amber-200/90">
          {job.progress.label}
        </p>
      )}

      {isRunning && pct != null && (
        <div className="mt-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-amber-600 transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {job.error && (
        <p className="mt-2 text-xs text-red-400">{job.error}</p>
      )}

      {videoUrl && (
        <video
          ref={videoRef}
          key={videoUrl}
          className="mt-2 w-full rounded border border-zinc-800 bg-black"
          controls
          autoPlay
          playsInline
          src={videoUrl}
        />
      )}

      {job.status === "completed" && job.outputRelative && (
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="font-mono text-zinc-500">{job.outputRelative}</span>
          {job.outputPath && (
            <button
              type="button"
              onClick={() => void openInFinder()}
              className="text-amber-400 hover:underline"
            >
              Finder
            </button>
          )}
        </div>
      )}
    </div>
  );
}
