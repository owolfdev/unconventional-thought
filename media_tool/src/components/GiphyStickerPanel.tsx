"use client";

import { useCallback, useMemo, useState } from "react";
import type { GiphyStickerHit } from "@/lib/giphy";
import {
  getActiveStickerSelection,
  selectionFilename,
  stickerOverlayEnabled,
} from "@/lib/overlay-media";
import type { ItemAcquisition } from "@/lib/types";
import { normalizeStickerOverlaySize } from "@/lib/sticker-overlay-size";
import type { StickerOverlaySize } from "@/lib/sticker-overlay-size";
import { StickerSizePicker } from "./StickerSizePicker";

interface Props {
  manifestPath: string;
  itemId: string;
  acquisition: ItemAcquisition | undefined;
  spokenHint?: string;
  onAcquiredUpdated: () => Promise<void>;
  onStickerOverlayEnabledChange?: (enabled: boolean) => void;
  onStickerOverlaySizeChange?: (size: StickerOverlaySize) => void;
}

function GiphyGalleryTile({
  hit,
  selected,
  overlayOn,
  disabled,
  importing,
  onImport,
  onHoverChange,
  isHovered,
}: {
  hit: GiphyStickerHit;
  selected: boolean;
  overlayOn: boolean;
  disabled: boolean;
  importing: boolean;
  onImport: () => void;
  onHoverChange: (hovered: boolean) => void;
  isHovered: boolean;
}) {
  const showAnimated =
    isHovered && hit.animatedPreviewUrl !== hit.stillPreviewUrl;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onImport}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      onFocus={() => onHoverChange(true)}
      onBlur={() => onHoverChange(false)}
      className={`group w-full overflow-hidden rounded-lg border-2 bg-zinc-950 text-left transition disabled:opacity-50 ${
        selected
          ? overlayOn
            ? "border-cyan-400 shadow-[0_0_0_1px_rgba(34,211,238,0.5)] ring-2 ring-cyan-400/70"
            : "border-zinc-500 ring-2 ring-zinc-500/50 opacity-75"
          : "border-cyan-900/50 hover:border-cyan-600"
      }`}
      title={
        selected
          ? `${hit.title} (selected${overlayOn ? "" : ", layer off"})`
          : `${hit.title} — hover to preview`
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={showAnimated ? hit.animatedPreviewUrl : hit.stillPreviewUrl}
        alt={hit.title}
        className="aspect-square w-full object-cover"
      />
      <span
        className={`block truncate px-1.5 py-1 text-[10px] ${
          selected
            ? "font-medium text-cyan-200"
            : "text-zinc-500 group-hover:text-cyan-200/90"
        }`}
      >
        {importing
          ? "Saving…"
          : selected
            ? "Selected"
            : showAnimated
              ? "Previewing…"
              : "Use as sticker"}
      </span>
    </button>
  );
}

function isHitSelected(hitId: string, activeSticker: ReturnType<typeof getActiveStickerSelection>): boolean {
  if (!activeSticker) return false;
  const name = selectionFilename(activeSticker);
  if (!name) return false;
  return name.toLowerCase() === `giphy-${hitId.toLowerCase()}.gif` || name.toLowerCase().startsWith(`giphy-${hitId.toLowerCase()}-`);
}

export function GiphyStickerPanel({
  manifestPath,
  itemId,
  acquisition,
  spokenHint,
  onAcquiredUpdated,
  onStickerOverlayEnabledChange,
  onStickerOverlaySizeChange,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GiphyStickerHit[]>([]);
  const [busy, setBusy] = useState<"search" | "import" | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const activeSticker = useMemo(
    () => (acquisition ? getActiveStickerSelection(acquisition) : null),
    [acquisition],
  );
  const activeStickerFilename = useMemo(
    () => (activeSticker ? selectionFilename(activeSticker) : null),
    [activeSticker],
  );
  const activeIsGiphy = Boolean(
    activeStickerFilename?.toLowerCase().startsWith("giphy-"),
  );
  const overlayOn = acquisition ? stickerOverlayEnabled(acquisition) : true;

  const search = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setBusy("search");
    setMessage(null);
    setError(null);
    setResults([]);
    try {
      const params = new URLSearchParams({ q: trimmed, limit: "16" });
      const res = await fetch(`/api/giphy/search?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setResults((data.results as GiphyStickerHit[]) ?? []);
      if (!(data.results as GiphyStickerHit[])?.length) {
        setMessage("No GIFs found — try another search.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setBusy(null);
    }
  }, [query]);

  const importGif = async (hit: GiphyStickerHit) => {
    setBusy("import");
    setImportingId(hit.id);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/giphy/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manifestPath,
          itemId,
          giphyId: hit.id,
          downloadUrl: hit.downloadUrl,
          title: hit.title,
          autoSelect: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");

      setMessage(`Saved ${data.filename} → acquired/ (GIF sticker, selected)`);
      onStickerOverlayEnabledChange?.(true);
      await onAcquiredUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(null);
      setImportingId(null);
    }
  };

  const disabled = busy !== null;

  return (
    <div className="rounded-lg border border-cyan-800/60 bg-cyan-950/25 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-xs font-medium text-cyan-200">GIPHY sticker</p>
        {activeSticker && onStickerOverlayEnabledChange && (
          <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-cyan-200/80">
            <input
              type="checkbox"
              checked={overlayOn}
              onChange={(e) => onStickerOverlayEnabledChange(e.target.checked)}
              className="rounded border-cyan-700"
            />
            Layer {overlayOn ? "on" : "off"}
          </label>
        )}
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Animated GIF overlay for Remotion — same centered sticker layer as OpenAI
        PNGs. Requires{" "}
        <span className="font-mono text-zinc-400">GIPHY_API_KEY</span> in
        .env.local.
      </p>

      {activeIsGiphy && activeStickerFilename && (
        <p className="mt-2 text-[10px] text-cyan-300/90">
          Active GIF:{" "}
          <span className="font-mono">{activeStickerFilename}</span>
          {!overlayOn && " (hidden until layer is on)"}
        </p>
      )}

      {activeSticker && onStickerOverlaySizeChange && acquisition && (
        <div className="mt-2">
          <StickerSizePicker
            value={normalizeStickerOverlaySize(acquisition.sticker_overlay_size)}
            onChange={onStickerOverlaySizeChange}
            disabled={!overlayOn}
          />
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <input
          type="search"
          className="min-w-0 flex-1 rounded-lg border border-cyan-900/50 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void search();
          }}
          placeholder={
            spokenHint
              ? `e.g. ${spokenHint.slice(0, 60)}${spokenHint.length > 60 ? "…" : ""}`
              : "Search GIPHY…"
          }
        />
        <button
          type="button"
          disabled={disabled || !query.trim()}
          onClick={() => void search()}
          className="shrink-0 rounded-lg border border-cyan-700 bg-cyan-900/40 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-900/70 disabled:opacity-50"
        >
          {busy === "search" ? "Searching…" : "Search"}
        </button>
      </div>

      {results.length > 0 && (
        <>
          <p className="mt-3 text-[10px] text-zinc-600">
            Hover a tile to preview animation.
          </p>
          <ul className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {results.map((hit) => {
              const selected = isHitSelected(hit.id, activeSticker);
              return (
                <li key={hit.id}>
                  <GiphyGalleryTile
                    hit={hit}
                    selected={selected}
                    overlayOn={overlayOn}
                    disabled={disabled}
                    importing={importingId === hit.id && busy === "import"}
                    isHovered={hoveredId === hit.id}
                    onHoverChange={(hovered) =>
                      setHoveredId(hovered ? hit.id : null)
                    }
                    onImport={() => void importGif(hit)}
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}

      {message && (
        <p className="mt-2 text-xs text-cyan-200/90">{message}</p>
      )}
      {error && <p className="mt-2 text-xs text-red-400/90">{error}</p>}

      <p className="mt-3 text-[10px] text-zinc-600">
        Powered by GIPHY. Confirm rights before broadcast; files save as{" "}
        <span className="font-mono text-zinc-500">giphy-*.gif</span> in
        acquired/.
      </p>
    </div>
  );
}
