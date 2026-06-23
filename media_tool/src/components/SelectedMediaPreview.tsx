"use client";

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import {
  buildCuePreviewModel,
  selectionFilename,
} from "@/lib/overlay-media";
import {
  formatVideoTime,
  mediaKindFromUrl,
  resolveSelectionPreviewUrl,
  type SelectionMediaKind,
} from "@/lib/selection-media";
import type { ItemAcquisition, SelectedMedia } from "@/lib/types";
import { VideoInPointControls } from "./VideoInPointControls";
import { normalizeBackgroundColor } from "@/lib/background-color";
import { stickerOverlayLayout } from "@/lib/sticker-overlay-layout";
import { stickerMaxPercent, type StickerOverlaySize } from "@/lib/sticker-overlay-size";
import { StickerSizePicker } from "./StickerSizePicker";

interface Props {
  acquisition: ItemAcquisition;
  project: string;
  itemId: string;
  acquiredFiles: string[];
  durationSec: number;
  tStart?: number;
  tEnd?: number;
  /** Always show native video controls (for @inpoint playhead in command UI). */
  allowVideoScrub?: boolean;
  onStickerOverlayEnabledChange?: (enabled: boolean) => void;
  onStickerOverlaySizeChange?: (size: StickerOverlaySize) => void;
  onTitleOverlayEnabledChange?: (enabled: boolean) => void;
  onPlateStartFromSecChange?: (
    selection: SelectedMedia,
    startFromSec: number | undefined,
  ) => void;
}

export type SelectedMediaPreviewHandle = {
  getActivePlate: () => SelectedMedia | null;
  getActivePlateVideoTime: () => number | null;
};

function PreviewAsset({
  src,
  kind,
  title,
  autoPlayVideo,
  startFromSec,
  className = "max-h-full max-w-full object-contain",
  style,
}: {
  src: string;
  kind: SelectionMediaKind;
  title: string;
  autoPlayVideo: boolean;
  startFromSec?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const inSec = startFromSec ?? 0;

  useEffect(() => {
    const el = videoRef.current;
    if (!el || kind !== "video") return;

    const seekIn = () => {
      if (inSec > 0 && el.duration && inSec < el.duration) {
        el.currentTime = inSec;
      } else if (inSec > 0) {
        el.currentTime = inSec;
      } else {
        el.currentTime = 0;
      }
    };

    el.addEventListener("loadedmetadata", seekIn);
    seekIn();
    if (autoPlayVideo) void el.play().catch(() => {});

    return () => el.removeEventListener("loadedmetadata", seekIn);
  }, [src, kind, autoPlayVideo, inSec]);

  if (kind === "video") {
    return (
      <video
        ref={videoRef}
        key={src}
        src={src}
        className={className}
        style={style}
        controls={!autoPlayVideo}
        playsInline
        muted
        loop={autoPlayVideo}
        preload="metadata"
        aria-label={title}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={src} src={src} alt={title} className={className} style={style} />
  );
}

function OverlayToggle({
  label,
  enabled,
  onChange,
  hint,
}: {
  label: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-zinc-600"
      />
      <span>{label}</span>
      {hint && <span className="text-zinc-600">{hint}</span>}
    </label>
  );
}

export const SelectedMediaPreview = forwardRef<SelectedMediaPreviewHandle, Props>(
function SelectedMediaPreview(
  {
  acquisition,
  project,
  itemId,
  acquiredFiles,
  durationSec,
  tStart,
  tEnd,
  allowVideoScrub = false,
  onStickerOverlayEnabledChange,
  onStickerOverlaySizeChange,
  onTitleOverlayEnabledChange,
  onPlateStartFromSecChange,
}: Props,
  ref,
) {
  const plateVideoRef = useRef<HTMLVideoElement>(null);
  const model = useMemo(
    () => buildCuePreviewModel(acquisition),
    [acquisition],
  );

  const bg = normalizeBackgroundColor(acquisition.background_color);
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [segmentProgress, setSegmentProgress] = useState(0);

  const plateCount = model.platePlaylist.length;
  const count = Math.max(plateCount, 1);
  const cueSec = Math.max(durationSec, 0.12);
  const segmentSec = plateCount > 0 ? cueSec / plateCount : cueSec;

  useEffect(() => {
    setActiveIndex(0);
    setSegmentProgress(0);
    setPlaying(true);
  }, [itemId, plateCount, cueSec]);

  useEffect(() => {
    if (!playing || plateCount <= 1) {
      setSegmentProgress(plateCount <= 1 ? 0 : 1);
      return;
    }

    const tickMs = 50;
    const id = window.setInterval(() => {
      setSegmentProgress((p) => {
        const next = p + tickMs / (segmentSec * 1000);
        if (next >= 1) {
          setActiveIndex((i) => {
            if (i >= plateCount - 1) {
              setPlaying(false);
              return i;
            }
            return i + 1;
          });
          return 0;
        }
        return next;
      });
    }, tickMs);

    return () => window.clearInterval(id);
  }, [playing, plateCount, segmentSec]);

  const jumpTo = useCallback(
    (index: number) => {
      setActiveIndex(Math.max(0, Math.min(index, plateCount - 1)));
      setSegmentProgress(0);
    },
    [plateCount],
  );

  const hasStickerAsset = Boolean(model.sticker);
  const hasTitleAsset = Boolean(model.title);
  const canConfigurePreview =
    model.hasPlate || hasStickerAsset || hasTitleAsset;

  const activePlate = useMemo(
    () => (plateCount > 0 ? model.platePlaylist[activeIndex] : null),
    [model.platePlaylist, plateCount, activeIndex],
  );

  const plateSrc = useMemo(
    () =>
      activePlate
        ? resolveSelectionPreviewUrl(activePlate, project, itemId)
        : null,
    [activePlate, project, itemId],
  );
  const plateKind = plateSrc ? mediaKindFromUrl(plateSrc) : "unknown";

  useImperativeHandle(
    ref,
    () => ({
      getActivePlate: () => activePlate,
      getActivePlateVideoTime: () => {
        const el = plateVideoRef.current;
        if (!el || plateKind !== "video") return null;
        const t = el.currentTime;
        return Number.isFinite(t) ? t : null;
      },
    }),
    [activePlate, plateKind],
  );

  const plateInSec = activePlate?.start_from_sec ?? 0;

  useEffect(() => {
    const el = plateVideoRef.current;
    if (!el || plateKind !== "video" || !plateSrc) return;

    const seekIn = () => {
      el.currentTime = plateInSec;
    };

    el.addEventListener("loadedmetadata", seekIn);
    seekIn();
    if (plateCount > 1) void el.play().catch(() => {});

    return () => el.removeEventListener("loadedmetadata", seekIn);
  }, [plateSrc, plateKind, plateInSec, plateCount, activeIndex]);

  if (!canConfigurePreview) {
    return (
      <div
        className="mb-6 flex min-h-[140px] items-center justify-center rounded-xl border border-dashed border-zinc-700 bg-zinc-950/80 text-sm text-zinc-500"
        style={{ backgroundColor: bg }}
      >
        No plate media staged — search & download, pick from library, or paste a URL.
        Sticker/GIF layers still preview when selected above.
      </div>
    );
  }

  const stickerSrc =
    model.showSticker && model.sticker
      ? resolveSelectionPreviewUrl(model.sticker, project, itemId)
      : null;
  const titleSrc =
    model.showTitle && model.title
      ? resolveSelectionPreviewUrl(model.title, project, itemId)
      : null;

  const stickerName = model.sticker ? selectionFilename(model.sticker) : null;
  const titleName = model.title ? selectionFilename(model.title) : null;
  const stickerSelectedButHidden =
    Boolean(model.sticker) && !model.showSticker;
  const titleSelectedButHidden = Boolean(model.title) && !model.showTitle;
  const stickerPercent = stickerMaxPercent(acquisition);
  const stickerLayout = stickerOverlayLayout(
    stickerPercent,
    acquisition.sticker_overlay_position ?? "center",
  );

  const timelineProgress =
    plateCount > 1
      ? (activeIndex + segmentProgress) / plateCount
      : segmentProgress;

  const timingLabel =
    tStart != null && tEnd != null
      ? `${tStart.toFixed(2)}s – ${tEnd.toFixed(2)}s (${cueSec.toFixed(2)}s)`
      : `${cueSec.toFixed(2)}s cue`;

  const statusLine = [
    activePlate?.title || (plateCount === 0 ? "(no plate)" : ""),
    model.showSticker && stickerName ? `+ ${stickerName}` : "",
    stickerSelectedButHidden && stickerName ? `(sticker off: ${stickerName})` : "",
    model.showTitle && titleName ? `+ ${titleName}` : "",
    titleSelectedButHidden && titleName ? `(title off: ${titleName})` : "",
    activePlate?.start_from_sec != null && plateKind === "video"
      ? `in @ ${formatVideoTime(activePlate.start_from_sec)}`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-zinc-700/90 bg-zinc-950">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          Cue preview
          {plateCount > 1 ? " · plate sequence" : ""}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {hasStickerAsset && onStickerOverlayEnabledChange && (
            <OverlayToggle
              label="Sticker / GIF layer"
              enabled={model.showSticker}
              onChange={onStickerOverlayEnabledChange}
            />
          )}
          {hasStickerAsset && onStickerOverlaySizeChange && (
            <StickerSizePicker
              value={acquisition.sticker_overlay_size ?? "medium"}
              onChange={onStickerOverlaySizeChange}
              disabled={!model.showSticker}
            />
          )}
          {hasTitleAsset && onTitleOverlayEnabledChange && (
            <OverlayToggle
              label="Title layer"
              enabled={model.showTitle}
              onChange={onTitleOverlayEnabledChange}
            />
          )}
          {plateCount > 1 && (
            <>
              <span className="font-mono text-xs text-amber-400/90">
                {activeIndex + 1} / {plateCount}
              </span>
              <span className="text-xs text-zinc-500">
                {segmentSec.toFixed(2)}s each · {timingLabel}
              </span>
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                className="rounded border border-zinc-600 px-2 py-0.5 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                {playing ? "Pause" : "Play"}
              </button>
            </>
          )}
        </div>
      </div>

      <div
        className="relative flex min-h-[200px] max-h-[min(52vh,520px)] items-center justify-center overflow-hidden p-2 sm:min-h-[240px]"
        style={{ backgroundColor: bg }}
      >
        {plateSrc && plateKind === "video" ? (
          <video
            ref={plateVideoRef}
            key={plateSrc}
            src={plateSrc}
            className="max-h-full max-w-full object-contain"
            controls={allowVideoScrub || plateCount <= 1}
            playsInline
            muted
            loop={plateCount > 1}
            preload="metadata"
            aria-label={activePlate?.title ?? "Plate"}
          />
        ) : plateSrc ? (
          <PreviewAsset
            src={plateSrc}
            kind={plateKind}
            title={activePlate?.title ?? "Plate"}
            autoPlayVideo={false}
          />
        ) : (
          <p className="text-xs text-zinc-600">Blank plate (effect-only)</p>
        )}

        {stickerSrc && (
          <div style={stickerLayout.container}>
            <div style={stickerLayout.box} className="drop-shadow-lg">
              <PreviewAsset
                src={stickerSrc}
                kind="image"
                title={model.sticker?.title ?? "Sticker"}
                autoPlayVideo={false}
                className="object-contain"
                style={stickerLayout.img}
              />
            </div>
          </div>
        )}

        {titleSrc && (
          <div className="pointer-events-none absolute inset-x-0 bottom-[7%] flex justify-center px-4">
            <PreviewAsset
              src={titleSrc}
              kind="image"
              title={model.title?.title ?? "Title"}
              autoPlayVideo={false}
              className="max-h-[40%] w-[88%] object-contain"
            />
          </div>
        )}
      </div>

      <p className="truncate border-t border-zinc-800/80 px-3 py-1.5 font-mono text-[10px] text-zinc-500">
        {statusLine}
      </p>

      {plateKind === "video" && activePlate && onPlateStartFromSecChange && (
        <VideoInPointControls
          videoRef={plateVideoRef}
          startFromSec={activePlate.start_from_sec}
          onChange={(sec) => onPlateStartFromSecChange(activePlate, sec)}
        />
      )}

      {plateCount > 1 && (
        <>
          <div className="h-1 bg-zinc-900">
            <div
              className="h-full bg-amber-600/80 transition-[width] duration-75 ease-linear"
              style={{ width: `${timelineProgress * 100}%` }}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto border-t border-zinc-800 p-2">
            {model.platePlaylist.map((sel, i) => {
              const thumbSrc = resolveSelectionPreviewUrl(sel, project, itemId);
              const thumbKind = mediaKindFromUrl(thumbSrc);
              const isActive = i === activeIndex;
              return (
                <button
                  key={sel.result_id}
                  type="button"
                  onClick={() => jumpTo(i)}
                  className={`h-14 w-20 shrink-0 overflow-hidden rounded border bg-black transition ${
                    isActive
                      ? "border-amber-500 ring-1 ring-amber-500/60"
                      : "border-zinc-700 opacity-70 hover:opacity-100"
                  }`}
                  title={sel.title}
                >
                  {thumbKind === "video" ? (
                    <video
                      src={thumbSrc}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbSrc}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
});

SelectedMediaPreview.displayName = "SelectedMediaPreview";
