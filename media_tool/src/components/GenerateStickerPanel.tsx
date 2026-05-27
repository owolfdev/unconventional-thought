"use client";

import { useMemo, useState } from "react";
import {
  getActiveStickerSelection,
  selectionFilename,
  stickerOverlayEnabled,
} from "@/lib/overlay-media";
import type { GenerateVariant } from "@/lib/openai-image";
import type { ItemAcquisition } from "@/lib/types";
import {
  normalizeStickerOverlaySize,
  type StickerOverlaySize,
} from "@/lib/sticker-overlay-size";
import { StickerSizePicker } from "./StickerSizePicker";

interface Props {
  manifestPath: string;
  itemId: string;
  acquisition?: ItemAcquisition;
  spokenHint?: string;
  onAcquiredUpdated: () => Promise<void>;
  onStickerOverlayEnabledChange?: (enabled: boolean) => void;
  onStickerOverlaySizeChange?: (size: StickerOverlaySize) => void;
}

export function GenerateStickerPanel({
  manifestPath,
  itemId,
  acquisition,
  spokenHint,
  onAcquiredUpdated,
  onStickerOverlayEnabledChange,
  onStickerOverlaySizeChange,
}: Props) {
  const activeSticker = useMemo(
    () => (acquisition ? getActiveStickerSelection(acquisition) : null),
    [acquisition],
  );
  const activeStickerFilename = useMemo(
    () => (activeSticker ? selectionFilename(activeSticker) : null),
    [activeSticker],
  );
  const activeIsOpenAiSticker = Boolean(
    activeStickerFilename?.toLowerCase().startsWith("sticker-"),
  );
  const overlayOn = acquisition ? stickerOverlayEnabled(acquisition) : true;

  const [prompt, setPrompt] = useState("");
  const [variant, setVariant] = useState<GenerateVariant>("sticker");
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
      const res = await fetch("/api/generate-sticker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manifestPath,
          itemId,
          prompt: trimmed,
          variant,
          autoSelect: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");

      setPreviewUrl(data.publicUrl as string);
      setMessage(
        `Saved ${data.filename} → acquired/ (${variant === "title" ? "title overlay" : "sticker"}, selected)`,
      );
      if (variant === "sticker") {
        onStickerOverlayEnabledChange?.(true);
      }
      await onAcquiredUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-violet-800/60 bg-violet-950/25 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-xs font-medium text-violet-200">Generate with OpenAI</p>
        {activeIsOpenAiSticker && onStickerOverlayEnabledChange && (
          <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-violet-200/80">
            <input
              type="checkbox"
              checked={overlayOn}
              onChange={(e) => onStickerOverlayEnabledChange(e.target.checked)}
              className="rounded border-violet-700"
            />
            Layer {overlayOn ? "on" : "off"}
          </label>
        )}
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Transparent PNG for Remotion — sticker (centered) or title overlay (lower
        third). Requires{" "}
        <span className="font-mono text-zinc-400">OPENAI_API_KEY</span> in
        .env.local.
      </p>

      {activeIsOpenAiSticker && activeStickerFilename && (
        <p className="mt-2 text-[10px] text-violet-300/90">
          Active sticker:{" "}
          <span className="font-mono">{activeStickerFilename}</span>
          {!overlayOn && " (hidden until layer is on)"}
        </p>
      )}

      {activeIsOpenAiSticker && onStickerOverlaySizeChange && acquisition && (
        <div className="mt-2">
          <StickerSizePicker
            value={normalizeStickerOverlaySize(acquisition.sticker_overlay_size)}
            onChange={onStickerOverlaySizeChange}
            disabled={!overlayOn}
          />
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-300">
          <input
            type="radio"
            name={`gen-variant-${itemId}`}
            checked={variant === "sticker"}
            onChange={() => setVariant("sticker")}
            className="border-violet-600"
          />
          Sticker
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-300">
          <input
            type="radio"
            name={`gen-variant-${itemId}`}
            checked={variant === "title"}
            onChange={() => setVariant("title")}
            className="border-violet-600"
          />
          Title overlay
        </label>
      </div>

      <textarea
        className="mt-3 w-full rounded-lg border border-violet-900/50 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
        rows={3}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={
          spokenHint
            ? `e.g. ${spokenHint.slice(0, 80)}${spokenHint.length > 80 ? "…" : ""}`
            : "Describe the sticker or title graphic…"
        }
      />

      <button
        type="button"
        disabled={busy || !prompt.trim()}
        onClick={() => void generate()}
        className="mt-3 rounded-lg border border-violet-700 bg-violet-900/40 px-4 py-2 text-sm text-violet-100 hover:bg-violet-900/70 disabled:opacity-50"
      >
        {busy ? "Generating…" : variant === "title" ? "Generate title" : "Generate sticker"}
      </button>

      {previewUrl && (
        <div
          className="mt-3 flex min-h-[80px] items-center justify-center rounded-lg border border-zinc-800 p-2"
          style={{
            background:
              "repeating-conic-gradient(#27272a 0% 25%, #18181b 0% 50%) 50% / 16px 16px",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Generated preview"
            className="max-h-32 max-w-full object-contain"
          />
        </div>
      )}

      {message && (
        <p className="mt-2 text-xs text-violet-200/90">{message}</p>
      )}
      {error && <p className="mt-2 text-xs text-red-400/90">{error}</p>}
    </div>
  );
}
