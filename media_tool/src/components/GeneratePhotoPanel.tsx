"use client";

import { useState } from "react";

interface Props {
  manifestPath: string;
  itemId: string;
  spokenHint?: string;
  onAcquiredUpdated: () => Promise<void>;
}

export function GeneratePhotoPanel({
  manifestPath,
  itemId,
  spokenHint,
  onAcquiredUpdated,
}: Props) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const generate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/generate-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manifestPath,
          itemId,
          prompt: trimmed,
          autoSelect: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");

      setPreviewUrl(data.publicUrl as string);
      setMessage(
        `Saved ${data.filename} → library · selected as cue plate`,
      );
      await onAcquiredUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-sky-800/60 bg-sky-950/25 p-3">
      <p className="text-xs font-medium text-sky-200">
        Generate photoreal plate (OpenAI)
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        Landscape editorial still for the cue background — saved to the library and
        staged as the plate. Requires{" "}
        <span className="font-mono text-zinc-400">OPENAI_API_KEY</span> in
        .env.local.
      </p>

      <textarea
        className="mt-3 w-full rounded-lg border border-sky-900/50 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
        rows={3}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={
          spokenHint
            ? `e.g. ${spokenHint.slice(0, 100)}${spokenHint.length > 100 ? "…" : ""}`
            : "Describe the photoreal scene…"
        }
      />

      <button
        type="button"
        disabled={busy || !prompt.trim()}
        onClick={() => void generate()}
        className="mt-3 rounded-lg border border-sky-700 bg-sky-900/40 px-4 py-2 text-sm text-sky-100 hover:bg-sky-900/70 disabled:opacity-50"
      >
        {busy ? "Generating…" : "Generate photo"}
      </button>

      {previewUrl && (
        <div className="mt-3 overflow-hidden rounded-lg border border-zinc-800 bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Generated preview"
            className="max-h-48 w-full object-contain"
          />
        </div>
      )}

      {message && <p className="mt-2 text-xs text-sky-200/90">{message}</p>}
      {error && <p className="mt-2 text-xs text-red-400/90">{error}</p>}
    </div>
  );
}
