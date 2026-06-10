"use client";

import { useRef, type RefObject } from "react";
import { formatVideoTime, normalizeStartFromSec } from "@/lib/selection-media";

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  startFromSec?: number;
  onChange: (startFromSec: number | undefined) => void;
  disabled?: boolean;
}

export function VideoInPointControls({
  videoRef,
  startFromSec,
  onChange,
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const setFromPlayhead = () => {
    const el = videoRef.current;
    if (!el || !Number.isFinite(el.currentTime)) return;
    onChange(normalizeStartFromSec(el.currentTime));
  };

  const applyManual = () => {
    const raw = inputRef.current?.value.trim();
    if (!raw) {
      onChange(undefined);
      return;
    }
    onChange(normalizeStartFromSec(raw));
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800/80 px-3 py-2">
      <span className="text-xs text-zinc-500">Video in point</span>
      <span className="font-mono text-xs text-amber-400/90">
        {startFromSec != null ? formatVideoTime(startFromSec) : "0:00.0 (start)"}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={setFromPlayhead}
        className="rounded border border-zinc-600 px-2 py-0.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
      >
        Set from playhead
      </button>
      <button
        type="button"
        disabled={disabled || startFromSec == null}
        onClick={() => onChange(undefined)}
        className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-900 disabled:opacity-50"
      >
        Clear
      </button>
      <label className="ml-auto flex items-center gap-1.5 text-xs text-zinc-500">
        <span className="sr-only">In point seconds</span>
        <input
          ref={inputRef}
          type="number"
          min={0}
          step={0.1}
          defaultValue={startFromSec ?? ""}
          key={startFromSec ?? "none"}
          placeholder="sec"
          disabled={disabled}
          className="w-20 rounded border border-zinc-700 bg-zinc-950 px-2 py-0.5 font-mono text-xs text-zinc-300"
          onBlur={applyManual}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyManual();
            }
          }}
        />
        s
      </label>
    </div>
  );
}
