"use client";

import { useState, type ReactNode } from "react";

type Props = {
  /** When set, reveals this file in Finder; otherwise opens the folder. */
  filename?: string;
  className?: string;
  children?: ReactNode;
} & (
  | { project: string; itemId: string; libraryId?: never }
  | { libraryId: string; project?: never; itemId?: never }
);

export function OpenInFinderButton({
  project,
  itemId,
  libraryId,
  filename,
  className = "",
  children,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label =
    children ??
    (filename ? "Open in Finder" : "Open folder in Finder");

  const reveal = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          libraryId ? { libraryId, filename } : { project, itemId, filename },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not open Finder");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open Finder");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => void reveal()}
        className={
          className ||
          "rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
        }
      >
        {busy ? "Opening…" : label}
      </button>
      {error && (
        <span className="text-xs text-red-400" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
