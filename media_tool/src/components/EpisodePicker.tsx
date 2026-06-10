"use client";

import type { EpisodeInfo } from "@/lib/episodes";

interface Props {
  episodes: EpisodeInfo[];
  value: string;
  loading?: boolean;
  disabled?: boolean;
  onChange: (manifestPath: string) => void;
}

export function episodeSelectLabel(ep: EpisodeInfo): string {
  const cues = ep.cueCount != null ? ` · ${ep.cueCount} cues` : "";
  const missing = ep.hasManifest ? "" : " (no manifest)";
  return `${ep.number} — ${ep.title}${cues}${missing}`;
}

export function EpisodePicker({
  episodes,
  value,
  loading = false,
  disabled = false,
  onChange,
}: Props) {
  const inList = episodes.some((ep) => ep.manifestPath === value);

  return (
    <div className="flex min-w-[280px] flex-1 flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="episode-picker">
        Episode
      </label>
      <select
        id="episode-picker"
        className="min-w-[280px] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm disabled:opacity-50"
        value={inList ? value : ""}
        disabled={disabled || loading || episodes.length === 0}
        onChange={(e) => {
          const next = e.target.value;
          if (next) onChange(next);
        }}
      >
        {loading ? (
          <option value="">Loading episodes…</option>
        ) : episodes.length === 0 ? (
          <option value="">No episodes found</option>
        ) : (
          <>
            {!inList && value ? (
              <option value="" disabled>
                Custom manifest loaded
              </option>
            ) : null}
            {episodes.map((ep) => (
              <option
                key={ep.episodeId}
                value={ep.manifestPath}
                disabled={!ep.hasManifest}
              >
                {episodeSelectLabel(ep)}
              </option>
            ))}
          </>
        )}
      </select>
    </div>
  );
}
