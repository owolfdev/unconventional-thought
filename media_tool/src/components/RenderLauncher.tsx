"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RenderJob, RenderQuality } from "@/lib/render-launcher";
import type { RenderProgress } from "@/lib/render-progress";

type Props = {
  manifestPath: string;
  currentCueId?: string;
  maxCueId?: string;
  showCueOverlay?: boolean;
  overlayBusy?: boolean;
  onToggleCueOverlay?: (enabled: boolean) => void | Promise<void>;
};

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

export function RenderLauncher({
  manifestPath,
  currentCueId,
  maxCueId,
  showCueOverlay = true,
  overlayBusy = false,
  onToggleCueOverlay,
}: Props) {
  const [from, setFrom] = useState(currentCueId ?? "m001");
  const [to, setTo] = useState(currentCueId ?? "m010");
  const [quality, setQuality] = useState<RenderQuality>("preview");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<RenderJob | null>(null);
  const [logTail, setLogTail] = useState("");
  const [recentJobs, setRecentJobs] = useState<RenderJob[]>([]);
  const logRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (currentCueId) {
      setFrom(currentCueId);
      setTo(currentCueId);
    }
  }, [currentCueId]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logTail]);

  const loadMeta = useCallback(async () => {
    const res = await fetch(
      `/api/render?path=${encodeURIComponent(manifestPath)}`,
    );
    if (!res.ok) return;
    const data = (await res.json()) as { jobs?: RenderJob[] };
    if (data.jobs) setRecentJobs(data.jobs);
  }, [manifestPath]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  const pollJob = useCallback(async (jobId: string) => {
    const res = await fetch(
      `/api/render?jobId=${encodeURIComponent(jobId)}&path=${encodeURIComponent(manifestPath)}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { job: RenderJob; logTail?: string };
    setJob(data.job);
    if (data.logTail != null) setLogTail(data.logTail);
    return data.job;
  }, [manifestPath]);

  const isRunning = job?.status === "running" || job?.status === "queued";

  useEffect(() => {
    if (!job || !isRunning) return;
    void pollJob(job.id);
    const id = window.setInterval(() => {
      void pollJob(job.id);
    }, 800);
    return () => window.clearInterval(id);
  }, [job, isRunning, pollJob]);

  const startRender = async () => {
    setBusy(true);
    setError(null);
    setLogTail("");
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manifestPath,
          from: from.trim(),
          to: to.trim(),
          quality,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        job?: RenderJob;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Render failed to start");
      }
      if (data.job) {
        setJob(data.job);
        void pollJob(data.job.id);
        void loadMeta();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Render failed");
    } finally {
      setBusy(false);
    }
  };

  const openOutput = async (action: "open" | "reveal" | "folder") => {
    if (!job?.outputPath) return;
    await fetch("/api/reveal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ absolutePath: job.outputPath, action }),
    });
  };

  const progress = job?.progress;
  const pct = progressPercent(progress);
  const statusColor =
    job?.status === "completed"
      ? "text-emerald-400"
      : job?.status === "failed"
        ? "text-red-400"
        : isRunning
          ? "text-amber-300"
          : "text-zinc-400";

  return (
    <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-200">Remotion render</h2>
        {maxCueId && (
          <span className="text-xs text-zinc-500">episode ends {maxCueId}</span>
        )}
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Rebuilds timeline, then renders cue span to{" "}
        <code className="text-amber-400/80">remotion/out/render_###/</code>
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs text-zinc-400">
          From
          <input
            className="mt-1 block w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="m001"
          />
        </label>
        <label className="text-xs text-zinc-400">
          To
          <input
            className="mt-1 block w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="m010"
          />
        </label>
        <label className="text-xs text-zinc-400">
          Quality
          <select
            className="mt-1 block rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
            value={quality}
            onChange={(e) => setQuality(e.target.value as RenderQuality)}
          >
            <option value="preview">Preview (½ res)</option>
            <option value="full">Full (1080p)</option>
          </select>
        </label>
        {currentCueId && (
          <button
            type="button"
            className="rounded border border-zinc-700 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900"
            onClick={() => {
              setFrom(currentCueId);
              setTo(currentCueId);
            }}
          >
            Current cue
          </button>
        )}
        {onToggleCueOverlay && (
          <button
            type="button"
            disabled={overlayBusy}
            onClick={() => void onToggleCueOverlay(!showCueOverlay)}
            title="Burn in cue number + media id (m###) on Remotion preview renders"
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition disabled:opacity-50 ${
              showCueOverlay
                ? "border-amber-600/80 bg-amber-950/80 text-amber-200 hover:bg-amber-900/60"
                : "border-zinc-600 bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            {overlayBusy
              ? "Updating…"
              : showCueOverlay
                ? "Cue labels: ON"
                : "Cue labels: OFF"}
          </button>
        )}
        <button
          type="button"
          disabled={busy || isRunning}
          onClick={() => void startRender()}
          className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
        >
          {busy ? "Starting…" : isRunning ? "Rendering…" : "Render"}
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      {job && (
        <div className="mt-3 rounded border border-zinc-800 bg-zinc-900/40 p-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className={statusColor}>{job.status}</span>
            <span className="text-zinc-500">
              {job.from}
              {job.to !== job.from ? `–${job.to}` : ""} ·{" "}
              {job.preview ? "preview" : "full"}
            </span>
            {job.outputRelative && job.status === "completed" && (
              <>
                <button
                  type="button"
                  onClick={() => void openOutput("open")}
                  className="rounded border border-amber-700/60 bg-amber-900/30 px-2 py-0.5 text-amber-200 hover:bg-amber-900/50"
                >
                  Open video
                </button>
                <button
                  type="button"
                  onClick={() => void openOutput("reveal")}
                  className="text-amber-400 hover:underline"
                >
                  Reveal in Finder
                </button>
              </>
            )}
          </div>

          {isRunning && progress?.label && (
            <p className="mt-2 font-mono text-sm text-amber-200/90">
              {progress.label}
            </p>
          )}

          {isRunning && pct != null && (
            <div className="mt-2">
              <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-amber-600 transition-[width] duration-300 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1 text-zinc-500">{pct}%</p>
            </div>
          )}

          {job.outputRelative && job.status === "completed" && (
            <p className="mt-1 font-mono text-zinc-400">{job.outputRelative}</p>
          )}
          {job.error && <p className="mt-1 text-red-400">{job.error}</p>}

          {(logTail || isRunning) && (
            <pre
              ref={logRef}
              className="mt-3 max-h-52 overflow-auto rounded border border-zinc-800 bg-black/60 p-2 font-mono text-[11px] leading-relaxed text-zinc-400"
            >
              {logTail || "Waiting for output…"}
            </pre>
          )}
        </div>
      )}

      {recentJobs.length > 0 && !job && (
        <ul className="mt-3 space-y-1 text-xs text-zinc-500">
          {recentJobs.slice(0, 3).map((j) => (
            <li key={j.id}>
              <button
                type="button"
                className="hover:text-zinc-300"
                onClick={() => {
                  setJob(j);
                  void pollJob(j.id);
                }}
              >
                {j.status} · {j.from}
                {j.to !== j.from ? `–${j.to}` : ""}{" "}
                {j.outputRelative ? `→ ${j.outputRelative}` : ""}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
