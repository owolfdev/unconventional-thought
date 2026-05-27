"use client";

import { useState } from "react";
import { OpenInFinderButton } from "./OpenInFinderButton";

export interface AcquiredGridFile {
  name: string;
  href: string;
  kind: "image" | "video" | "other";
  size: string;
  selected: boolean;
}

interface Props {
  project: string;
  itemId: string;
  files: AcquiredGridFile[];
}

export function AcquiredMediaGrid({ project, itemId, files }: Props) {
  const [items, setItems] = useState(files);
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const toggleSelected = async (filename: string) => {
    const current = items.find((item) => item.name === filename);
    if (!current) return;

    const nextSelected = !current.selected;
    setBusyFile(filename);
    setMessage(null);
    try {
      const res = await fetch("/api/acquired-selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project,
          itemId,
          filename,
          selected: nextSelected,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Selection update failed");

      setItems((prev) =>
        prev.map((item) =>
          item.name === filename
            ? { ...item, selected: data.selected ?? nextSelected }
            : item,
        ),
      );
      setMessage(
        nextSelected
          ? `Selected ${filename} for ${itemId}`
          : `Removed ${filename} from ${itemId}`,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Selection update failed");
    } finally {
      setBusyFile(null);
    }
  };

  return (
    <>
      {message && (
        <p className="mb-4 rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-300">
          {message}
        </p>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((file) => (
          <li
            key={file.name}
            className={`overflow-hidden rounded-xl border bg-zinc-900/40 ${
              file.selected
                ? "border-emerald-500 ring-2 ring-emerald-500/30"
                : "border-zinc-800"
            }`}
          >
            <div className="relative">
              <a href={file.href} target="_blank" rel="noopener noreferrer">
                <div className="flex aspect-video items-center justify-center bg-zinc-950">
                  {file.kind === "image" && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={file.href}
                      alt={file.name}
                      className="h-full w-full object-contain"
                    />
                  )}
                  {file.kind === "video" && (
                    <video
                      src={file.href}
                      className="h-full w-full object-contain"
                      controls
                      preload="metadata"
                    />
                  )}
                  {file.kind === "other" && (
                    <span className="text-xs uppercase tracking-wide text-zinc-600">
                      File
                    </span>
                  )}
                </div>
              </a>
              <button
                type="button"
                disabled={busyFile === file.name}
                onClick={() => void toggleSelected(file.name)}
                className={`absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-md border text-sm font-bold backdrop-blur ${
                  file.selected
                    ? "border-emerald-400 bg-emerald-600 text-white"
                    : "border-zinc-600 bg-black/70 text-zinc-400 hover:text-white"
                } disabled:opacity-60`}
                aria-label={
                  file.selected
                    ? `Remove ${file.name} from selected media`
                    : `Select ${file.name} for this shot`
                }
              >
                {busyFile === file.name ? "..." : file.selected ? "✓" : ""}
              </button>
            </div>
            <div className="space-y-1 p-3">
              <a
                href={file.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate font-mono text-xs text-emerald-300 hover:underline"
                title={file.name}
              >
                {file.name}
              </a>
              <p className="text-xs text-zinc-500">
                {file.kind} - {file.size}
                {file.selected ? " - selected" : ""}
              </p>
              <OpenInFinderButton
                project={project}
                itemId={itemId}
                filename={file.name}
                className="mt-2 w-full rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
              />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
