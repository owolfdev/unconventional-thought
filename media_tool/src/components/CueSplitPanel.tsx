"use client";

import { useCallback, useEffect, useState } from "react";
import type { MediaToolItem } from "@/lib/types";

interface AlignedWord {
  index: number;
  display: string;
  start: number;
  end: number;
}

interface SplitHalfPreview {
  id: string;
  cue: number;
  t_start: number;
  t_end: number;
  duration_sec: number;
  spoken: string;
}

interface WordsResponse {
  alignedWords: AlignedWord[];
  canSplit: boolean;
  reason?: string;
  splitPreview?: {
    first: SplitHalfPreview;
    second: SplitHalfPreview;
    splitTimeSec: number;
    renames: Array<{ from: string; to: string }>;
  };
  error?: string;
}

interface Props {
  manifestPath: string;
  item: MediaToolItem;
  onSplitComplete: (result: {
    firstId: string;
    secondId: string;
    manifest: unknown;
    acquisition: unknown;
    mediaLibrary: unknown;
  }) => void;
}

export function CueSplitPanel({
  manifestPath,
  item,
  onSplitComplete,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [alignedWords, setAlignedWords] = useState<AlignedWord[]>([]);
  const [canSplit, setCanSplit] = useState(false);
  const [splitReason, setSplitReason] = useState<string | undefined>();
  const [splitAfter, setSplitAfter] = useState<number | null>(null);
  const [splitPreview, setSplitPreview] = useState<
    WordsResponse["splitPreview"] | null
  >(null);
  const [copyEditorial, setCopyEditorial] = useState(true);

  const loadWords = useCallback(
    async (afterIndex: number | null) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          path: manifestPath,
          itemId: item.id,
        });
        if (afterIndex != null) {
          params.set("splitAfter", String(afterIndex));
        }
        const res = await fetch(`/api/cue/words?${params.toString()}`);
        const data = (await res.json()) as WordsResponse;
        if (!res.ok) throw new Error(data.error ?? "Failed to load words");
        setAlignedWords(data.alignedWords ?? []);
        setCanSplit(data.canSplit);
        setSplitReason(data.reason);
        setSplitPreview(data.splitPreview ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load words");
        setAlignedWords([]);
        setCanSplit(false);
        setSplitPreview(null);
      } finally {
        setLoading(false);
      }
    },
    [manifestPath, item.id],
  );

  useEffect(() => {
    if (!open) return;
    setSplitAfter(null);
    setSplitPreview(null);
    setMessage(null);
    void loadWords(null);
  }, [open, loadWords, item.id]);

  useEffect(() => {
    if (!open || splitAfter == null) {
      setSplitPreview(null);
      return;
    }
    void loadWords(splitAfter);
  }, [open, splitAfter, loadWords]);

  const runSplit = async () => {
    if (splitAfter == null) return;
    setSplitting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/cue/split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manifestPath,
          itemId: item.id,
          splitAfterWordIndex: splitAfter,
          copyEditorialToSecondHalf: copyEditorial,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Split failed");

      setMessage(
        `Split ${item.id} → ${data.firstId} + ${data.secondId}` +
          (data.renames?.length
            ? ` · renumbered ${data.renames.length} folder(s)`
            : ""),
      );
      onSplitComplete({
        firstId: data.firstId,
        secondId: data.secondId,
        manifest: data.manifest,
        acquisition: data.acquisition,
        mediaLibrary: data.mediaLibrary,
      });
      setOpen(false);
      setSplitAfter(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Split failed");
    } finally {
      setSplitting(false);
    }
  };

  if (item.id === "m000") {
    return null;
  }

  return (
    <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-zinc-200">Split cue</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            Break this cue into two at a word boundary (updates{" "}
            <code className="text-zinc-400">media_search.json</code> and renumbers
            folders).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
        >
          {open ? "Close" : "Split at word…"}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-4">
          {loading && (
            <p className="text-sm text-zinc-500">Loading transcript alignment…</p>
          )}

          {!loading && !canSplit && (
            <p className="text-sm text-amber-400/90">
              {splitReason ?? "Cannot split this cue."}
            </p>
          )}

          {!loading && canSplit && (
            <>
              <p className="text-xs text-zinc-500">
                Click the gap <strong className="text-zinc-400">between</strong>{" "}
                words where the new cue should start:
              </p>
              <div className="flex flex-wrap gap-1 rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 text-base leading-relaxed text-zinc-100">
                {alignedWords.map((word, i) => (
                  <span
                    key={`${word.index}-${word.display}`}
                    className="inline-flex items-center"
                  >
                    {i > 0 ? (
                      <button
                        type="button"
                        onClick={() => setSplitAfter(i - 1)}
                        className={`mx-1 inline-flex h-7 min-w-[6px] items-center justify-center rounded-full px-0.5 transition ${
                          splitAfter === i - 1
                            ? "bg-amber-500"
                            : "bg-zinc-700/80 hover:bg-amber-600/70"
                        }`}
                        title={`Split after “${alignedWords[i - 1].display}”`}
                        aria-label={`Split after ${alignedWords[i - 1].display}`}
                      />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        if (i < alignedWords.length - 1) setSplitAfter(i);
                      }}
                      disabled={i >= alignedWords.length - 1}
                      className={`rounded px-1 py-0.5 transition hover:bg-zinc-800 disabled:cursor-default disabled:opacity-60 ${
                        splitAfter === i ? "bg-amber-950 text-amber-200" : ""
                      }`}
                      title={
                        i < alignedWords.length - 1
                          ? `Split after “${word.display}” (${word.start.toFixed(2)}s)`
                          : `${word.display} (end)`
                      }
                    >
                      {word.display}
                    </button>
                  </span>
                ))}
              </div>

              {splitPreview && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-zinc-800 p-3 text-xs">
                    <p className="font-mono text-amber-400/90">
                      {splitPreview.first.id}
                    </p>
                    <p className="mt-1 text-zinc-500">
                      {splitPreview.first.t_start.toFixed(2)}s –{" "}
                      {splitPreview.first.t_end.toFixed(2)}s (
                      {splitPreview.first.duration_sec.toFixed(2)}s)
                    </p>
                    <p className="mt-2 text-zinc-300">
                      &ldquo;{splitPreview.first.spoken}&rdquo;
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 p-3 text-xs">
                    <p className="font-mono text-amber-400/90">
                      {splitPreview.second.id}
                    </p>
                    <p className="mt-1 text-zinc-500">
                      {splitPreview.second.t_start.toFixed(2)}s –{" "}
                      {splitPreview.second.t_end.toFixed(2)}s (
                      {splitPreview.second.duration_sec.toFixed(2)}s)
                    </p>
                    <p className="mt-2 text-zinc-300">
                      &ldquo;{splitPreview.second.spoken}&rdquo;
                    </p>
                  </div>
                </div>
              )}

              {splitPreview && splitPreview.renames.length > 0 && (
                <p className="text-xs text-zinc-500">
                  Renames {splitPreview.renames.length} media folder(s) (e.g.{" "}
                  {splitPreview.renames[0].from} → {splitPreview.renames[0].to}
                  …).
                </p>
              )}

              <label className="flex items-center gap-2 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={copyEditorial}
                  onChange={(e) => setCopyEditorial(e.target.checked)}
                  className="accent-amber-500"
                />
                Copy search queries & editorial intent to second half
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={splitting || splitAfter == null}
                  onClick={() => void runSplit()}
                  className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {splitting ? "Splitting…" : "Split cue"}
                </button>
                <button
                  type="button"
                  disabled={splitting}
                  onClick={() => setSplitAfter(null)}
                  className="rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900"
                >
                  Clear split point
                </button>
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
          {message && <p className="text-sm text-emerald-300/90">{message}</p>}
        </div>
      )}
    </div>
  );
}
